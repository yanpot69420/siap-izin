"""Display-only, coverage-aware derivatives. Never used for analysis or export."""
import copy
import hashlib
import json
import time
import threading
from functools import wraps
from datetime import datetime

import shapely
from shapely.geometry import mapping, shape
from pyproj import Transformer
from pyproj.exceptions import ProjError

LEVELS = {'overview': 100, 'regional': 10, 'detail': 1}
PROPERTY_KEYS = ('object_id', 'plan_id', 'zone_name', 'zone_code', 'zone_group',
                 'subzone_name', 'filter_value', 'activity_id', 'activity_name')


def encoded(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True,
                      separators=(',', ':')).encode('utf-8')


def plan_locked(method):
    @wraps(method)
    def locked(self, *args, **kwargs):
        if not self.lock.acquire(blocking=False):
            raise self.error_type('plan_busy', 503)
        try:
            return method(self, *args, **kwargs)
        finally:
            self.lock.release()
    return locked


class DisplayService:
    def __init__(self, source, clock=time.time, error_type=None, benchmark_replay=False):
        if error_type is None:
            from dev_server import APIError
            error_type = APIError
        self.error_type = error_type
        self.benchmark_replay = benchmark_replay is True
        self.source = source
        self.context = source.context
        self.clock = clock
        self.lock = threading.Lock()
        self._snapshot_id = None
        self._levels = {}

    def _check_age(self, payload):
        source = payload['meta']['source']
        if (self.benchmark_replay and payload['meta'].get('benchmarkReplay') is True and
                source['status'] == 'cached_snapshot' and source.get('cacheReason') == 'benchmark_replay'):
            return
        timestamp = datetime.fromisoformat(source['retrievedAt'].replace('Z', '+00:00')).timestamp()
        age = self.clock() - timestamp
        status, reason = source['status'], source.get('cacheReason')
        limit = 300
        if status == 'cached_snapshot':
            if reason == 'fresh_cache_ttl':
                limit = min(300, getattr(self.source, 'ttl', 300))
            elif reason in ('upstream_network', 'upstream_http', 'upstream_deadline'):
                limit = min(3600, getattr(self.source, 'max_stale', 3600))
            else:
                limit = 0
        elif status != 'live':
            limit = 0
        if not 0 <= age < limit:
            raise self.error_type('source_snapshot_expired', 503)

    def validate_response_age(self, payload):
        """Final handler checkpoint, including time spent serializing the body."""
        self._check_age(payload)

    def _source_shapes(self, payload):
        from dev_server import geometry_problem
        try:
            features, meta = payload['features'], payload['meta']
            counts = meta['counts']
            if (payload['type'] != 'FeatureCollection' or meta['plan']['id'] != self.context.id or
                    not isinstance(features, list) or
                    any(type(counts[key]) is not int or counts[key] < 0
                        for key in ('matched', 'returned', 'excludedInvalid')) or
                    counts['returned'] != len(features) or
                    counts['matched'] != len(features) + counts['excludedInvalid']):
                raise ValueError('source counts/context')
            seen = set()
            for feature in features:
                oid, properties = feature['id'], feature['properties']
                if (type(oid) is not int or not 0 <= oid <= 9007199254740991 or oid in seen or
                        feature['type'] != 'Feature' or type(properties['object_id']) is not int or
                        properties['object_id'] != oid or properties['plan_id'] != self.context.id or
                        geometry_problem(feature['geometry']) is not None):
                    raise ValueError('source identity/geometry')
                seen.add(oid)
            return [shape(feature['geometry']) for feature in features]
        except (ValueError, KeyError, TypeError, AttributeError):
            raise self.error_type('source_snapshot_invalid') from None

    def _snapshot(self, payload):
        content = {**payload, 'meta': {**payload['meta'], 'source': {
            key: value for key, value in payload['meta']['source'].items()
            if key not in ('status', 'cacheReason')}}}
        snapshot_id = hashlib.sha256(encoded({'context': self.context._asdict(), 'source': content})).hexdigest()
        if snapshot_id != self._snapshot_id:
            original = self._source_shapes(payload)
            projected, reverse, coverage, fallback = None, None, None, None
            if original:
                try:
                    forward = Transformer.from_crs(4326, 32751, always_xy=True).transform
                    reverse = Transformer.from_crs(32751, 4326, always_xy=True).transform
                    projected = shapely.transform(original, forward, interleaved=False)
                    coverage = bool(shapely.coverage_is_valid(original)) and bool(shapely.coverage_is_valid(projected))
                    if not coverage:
                        fallback = 'coverage_invalid'
                except (shapely.errors.GEOSException, ProjError, ValueError, TypeError):
                    fallback = 'quality_validation_failed'
            self._reverse, self._projected = reverse, projected
            self._coverage, self._base_fallback = coverage, fallback
            self._original = original
            self._bounds = list(shapely.total_bounds(original)) if original else None
            self._vertices = int(shapely.get_num_coordinates(original).sum())
            self._levels = {}
            self._snapshot_id = snapshot_id
        return snapshot_id

    def _build_level(self, payload, level):
        from dev_server import geometry_problem
        fallback = self._base_fallback
        output = self._original
        geometries = None
        if self._coverage:
            try:
                simplified = shapely.coverage_simplify(self._projected, LEVELS[level], simplify_boundary=True)
                candidate = shapely.transform(simplified, self._reverse, interleaved=False)
                if (len(candidate) != len(self._original) or
                        any(g is None or g.is_empty or not g.is_valid or g.geom_type not in ('Polygon', 'MultiPolygon')
                            for g in candidate) or not bool(shapely.coverage_is_valid(candidate))):
                    raise ValueError('invalid whole-level output')
                serialized = [json.loads(json.dumps(mapping(g), allow_nan=False)) for g in candidate]
                if (any(geometry_problem(g) is not None for g in serialized) or
                        not bool(shapely.coverage_is_valid([shape(g) for g in serialized]))):
                    raise ValueError('invalid serialized output')
                geometries = serialized
                output = candidate
            except (shapely.errors.GEOSException, ProjError, ValueError, TypeError):
                fallback = 'quality_validation_failed'
        if geometries is None:
            geometries = [copy.deepcopy(feature['geometry']) for feature in payload['features']]
        features = []
        for source, geometry, original in zip(payload['features'], geometries, self._original):
            properties = {key: source['properties'].get(key) for key in PROPERTY_KEYS}
            properties.update(permission='unknown', evidence_status='unreviewed_mapping',
                              source_bounds=list(original.bounds))
            features.append({'type': 'Feature', 'id': source['id'], 'properties': properties,
                             'geometry': geometry})
        source_ids = [feature['id'] for feature in payload['features']]
        if ([feature['id'] for feature in features] != source_ids or
                [feature['properties']['object_id'] for feature in features] != source_ids):
            raise self.error_type('source_snapshot_invalid')
        info = {
            'algorithmVersion': 'coverage-lod-v1', 'purpose': 'display-only-not-analysis-or-export',
            'level': level, 'toleranceMeters': LEVELS[level],
            'method': 'coverage_simplify' if self._coverage and fallback is None else 'original_preserved',
            'fallbackReason': fallback,
            'sourceFeatureCount': len(self._original), 'returnedFeatureCount': len(features),
            'originalVertices': self._vertices,
            'returnedVertices': int(shapely.get_num_coordinates(output).sum()), 'bbox': None,
            'validation': {'featureIdsPreserved': True, 'geometryValid': True, 'coverageValid': self._coverage}}
        return features, info

    @plan_locked
    def get_feature_detail(self, object_id, snapshot_id):
        payload = self.source.get_zones()
        self._check_age(payload)
        current_id = self._snapshot(payload)
        if snapshot_id != current_id:
            raise self.error_type('snapshot_changed', 409)
        for feature, original in zip(payload['features'], self._original):
            if feature['id'] == object_id:
                meta = copy.deepcopy(payload['meta'])
                meta.update(snapshotId=current_id, sourceCounts=copy.deepcopy(meta['counts']))
                self._check_age(payload)
                return {'schemaVersion': 1, 'planId': self.context.id, 'objectId': object_id,
                        'snapshotId': current_id, 'properties': copy.deepcopy(feature['properties']),
                        'sourceBounds': list(original.bounds), 'meta': meta}
        raise self.error_type('feature_not_found', 404)

    @plan_locked
    def get_display(self, level, bbox=None):
        payload = self.source.get_zones()
        self._check_age(payload)
        snapshot_id = self._snapshot(payload)
        if level not in self._levels:
            self._levels[level] = self._build_level(payload, level)
        features, info = self._levels[level]
        if bbox is not None:
            viewport = shapely.box(*bbox)
            features = [feature for feature, original in zip(features, self._original)
                        if original.intersects(viewport)]
        features, info = copy.deepcopy((features, info))
        # Ring lengths count closure positions and holes without rebuilding GEOS.
        # The reader's private recursive walker would add a SQL-only dependency.
        if bbox is not None:
            info.update(bbox=list(bbox), returnedFeatureCount=len(features),
                        returnedVertices=sum(len(ring) for feature in features
                            for polygon in ([feature['geometry']['coordinates']]
                                if feature['geometry']['type'] == 'Polygon'
                                else feature['geometry']['coordinates'])
                            for ring in polygon))
        meta = copy.deepcopy(payload['meta'])
        meta.update(snapshotId=snapshot_id, sourceCounts=copy.deepcopy(meta['counts']),
                    sourceBounds=copy.deepcopy(self._bounds), display=info)
        self._check_age(payload)
        return {'type': 'FeatureCollection', 'features': features, 'meta': meta}
