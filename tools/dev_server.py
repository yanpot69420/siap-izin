"""Loopback-only prototype server and bounded, plan-specific Sultra RDTR adapters."""
PLAN_ID = '7411000000:001'
KBLI = '01273'
MAX_SNAPSHOT_BYTES = 128 * 1024 * 1024


class APIError(Exception):
    def __init__(self, code, status=502):
        self.code = code
        self.status = status
        super().__init__(code)


def parse_zone_query(query):
    # Match raw tokens, not decoded, stripped, padded or coerced identifiers.
    pairs = query.split('&')
    if len(pairs) == 2 and 'kbli=' + KBLI in pairs:
        plans = [p[5:] for p in pairs if p.startswith('plan=')]
        if len(plans) == 1 and plans[0] in PLANS:
            return plans[0], KBLI
    raise APIError('unsupported_query', 400)


import json
from datetime import datetime, timezone

ACTIVITIES_URL = ('https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/'
                  'activities?id_wilayah=7411000000&id_rtr=001')
LAYER_URL = ('https://gistaru.atrbpn.go.id/arcgis/rest/services/'
             '071_RDTR_PROVINSI_SULAWESI_TENGGARA/'
             '_RDTR_74A8_KAWASAN_PERKOTAAN_TIRAWUTA/MapServer/0')
PROXY = 'https://gistaru-proxy.atrbpn.go.id/proxy.ashx?'
METADATA_URL = PROXY + LAYER_URL + '?f=pjson'
GEOMETRY_QUERY_URL = PROXY + LAYER_URL + '/query'
LIMITATIONS = [
    'ID/nama aktivitas lokal dan kolom filter berbeda per rencana; relasinya bukan izin KBLI spesifik.',
    'Pemetaan exact KBLI 01273 versi 2025 dan cakupan budidaya kakao belum direview/dikonfirmasi.',
    'ITBX seluruh bidang belum diperiksa; tidak ada ekstrapolasi izin dari titik.',
    'Sorotan bukan persetujuan OSS, bukti hak tanah, ketersediaan lahan, atau kelayakan agronomi.',
]


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


import time
import socket
import http.client
import ssl
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode


def strict_json(raw):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate JSON key')
            result[key] = value
        return result
    def invalid_constant(value):
        raise ValueError('non-finite JSON')
    return json.loads(raw, object_pairs_hook=unique_pairs, parse_constant=invalid_constant)


class NoRedirect(urlrequest.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class LiveTransport:
    """Fixed public endpoints only; no redirects, credentials or client URL input."""
    def __init__(self, opener=None, max_bytes=16 * 1024 * 1024, total_timeout=90, plan_id=PLAN_ID,
                 max_total_bytes=MAX_SNAPSHOT_BYTES):
        self.context = context_for(plan_id)
        self.allowed_urls = frozenset((self.context.catalog_url, self.context.activities_url,
                                       self.context.metadata_url, self.context.query_url))
        self.opener = opener or urlrequest.build_opener(NoRedirect(),
                                    urlrequest.HTTPSHandler(context=ssl.create_default_context()))
        self.max_bytes = min(16 * 1024 * 1024, max_bytes)
        self.max_total_bytes = min(MAX_SNAPSHOT_BYTES, max_total_bytes)
        self.deadline = time.monotonic() + min(90, total_timeout)
        self.total_bytes = 0
        self.records = []

    def __call__(self, url, params=None):
        require(url in self.allowed_urls, 'source_not_allowlisted')
        full_url = url + ('?' + urlencode(params) if params else '')
        require(len(full_url.encode('ascii')) <= 1900, 'upstream_url_budget')
        remaining = self.deadline - time.monotonic()
        require(remaining > 0, 'upstream_deadline')
        req = urlrequest.Request(full_url, headers={
            'Referer': 'https://gistaru.atrbpn.go.id/rdtrinteraktif/',
            'Accept': 'application/json, application/geo+json',
            'Accept-Encoding': 'identity', 'User-Agent': 'siap-izin-local-prototype/1.0'})
        try:
            with self.opener.open(req, timeout=min(20, remaining)) as response:
                require(not 300 <= response.status < 400, 'upstream_redirect')
                require(response.status == 200, 'upstream_http')
                content_type = response.headers.get('Content-Type', '').split(';')[0].lower()
                require(content_type in ('application/json', 'application/geo+json', 'text/json', 'text/plain'),
                        'upstream_content_type')
                require(response.headers.get('Content-Encoding', 'identity') == 'identity', 'upstream_encoding')
                length = response.headers.get('Content-Length')
                if length is not None:
                    require(length.isdecimal() and int(length) <= self.max_bytes, 'upstream_size')
                chunks, size = [], 0
                while True:
                    require(time.monotonic() < self.deadline, 'upstream_deadline')
                    chunk = response.read1(min(65536, self.max_bytes + 1 - size))
                    if not chunk:
                        break
                    size += len(chunk)
                    self.total_bytes += len(chunk)
                    require(size <= self.max_bytes and self.total_bytes <= self.max_total_bytes, 'upstream_size')
                    chunks.append(chunk)
                require(length is None or size == int(length), 'upstream_truncated')
                require(time.monotonic() < self.deadline, 'upstream_deadline')
                data = checked(strict_json(b''.join(chunks).decode('utf-8-sig')))
                self.records.append({'url': full_url, 'retrievedAt': utc_now(),
                                     'status': response.status, 'bytes': size})
                return data
        except APIError:
            raise
        except HTTPError as error:
            raise APIError('upstream_redirect' if 300 <= error.code < 400 else 'upstream_http') from None
        except (URLError, TimeoutError, socket.timeout, OSError, http.client.HTTPException):
            raise APIError('upstream_network') from None
        except (ValueError, UnicodeError, RecursionError):
            raise APIError('upstream_json_invalid') from None


import re
import math
from shapely.geometry import shape
from shapely.validation import explain_validity

REQUIRED_FIELDS = {'OBJECTID': 'esriFieldTypeOID', **{
    name: 'esriFieldTypeString' for name in ('KODSZN', 'NAMSZN', 'NAMZON', 'NOTHPR')}}
MAX_IDS = 10000


def checked(data):
    if not isinstance(data, dict) or 'error' in data or data.get('exceededTransferLimit'):
        raise APIError('upstream_incomplete_or_error')
    return data


def require(condition, code='upstream_schema_invalid'):
    if not condition:
        raise APIError(code)


def geometry_problem(geometry):
    try:
        require(isinstance(geometry, dict))
        require(geometry.get('type') in ('Polygon', 'MultiPolygon'))
        def valid_coordinates(coords):
            if not isinstance(coords, (list, tuple)) or not coords:
                return False
            if isinstance(coords[0], (int, float)):
                return (len(coords) in (2, 3) and all(type(v) in (int, float) and math.isfinite(v)
                        for v in coords) and -180 <= coords[0] <= 180 and -90 <= coords[1] <= 90)
            return all(valid_coordinates(c) for c in coords)
        require(valid_coordinates(geometry.get('coordinates')))
        polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
        require(all(isinstance(polygon, list) and polygon and
                    all(isinstance(ring, list) and len(ring) >= 4 and ring[0] == ring[-1]
                        for ring in polygon) for polygon in polygons))
        parsed = shape(geometry)
        if parsed.is_empty:
            return 'empty_geometry'
        if not parsed.is_valid:
            return explain_validity(parsed)
        return None
    except Exception:
        return 'invalid_empty_or_non_polygon_geometry'


def load_live(fetch, plan_id=PLAN_ID):
    try:
        return _load_live(fetch, context_for(plan_id))
    except APIError:
        raise
    except (KeyError, TypeError, ValueError, StopIteration, AttributeError, RecursionError):
        raise APIError('upstream_schema_invalid') from None


def _load_live(fetch, ctx):
    retrieved_at = utc_now()  # Source acquisition time, never cache read time.
    if ctx.activity_id is None:
        raise APIError('activity_mapping_unavailable', 422)
    catalog = checked(fetch(ctx.catalog_url))
    require(catalog.get('status') == 200 and isinstance(catalog['data'], list))
    entries = [p for p in catalog['data'] if p.get('id_wilayah') == ctx.region_id and p.get('id_rtr') == ctx.rtr]
    require(len(entries) == 1, 'source_context_changed')
    entry = entries[0]
    require(entry.get('rtr') == ctx.name and entry.get('url_mapserver') == ctx.service_path
            and type(entry.get('sublayer_mapserver')) is int and entry['sublayer_mapserver'] == ctx.sublayer
            and entry.get('kolom_unik') == ctx.filter_field, 'source_context_changed')
    activities = checked(fetch(ctx.activities_url))
    require(activities.get('status') == 200 and isinstance(activities['data'], list))
    matches = [a for a in activities['data'] if a.get('id_kegiatan') == ctx.activity_id]
    require(len(matches) == 1)
    activity = matches[0]
    require(activity['kegiatan'] == ctx.activity_name, 'activity_context_changed')
    zones = strict_json(activity['nilai_kolom_unik'])['data']
    require(isinstance(zones, list) and 0 < len(zones) <= 100)
    require(all(isinstance(z, str) and re.fullmatch(r'[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)*', z) for z in zones))
    require(len(zones) == len(set(zones)))
    metadata = checked(fetch(ctx.metadata_url))
    require(metadata['geometryType'] == 'esriGeometryPolygon')
    fields = {f['name']: f['type'] for f in metadata['fields']}
    require(len(fields) == len(metadata['fields']))
    require(all(fields.get(k) == v for k, v in REQUIRED_FIELDS.items()))
    require(fields.get(ctx.filter_field) == 'esriFieldTypeString')
    references = [metadata['extent']['spatialReference']]
    if 'spatialReference' in metadata:
        references.append(metadata['spatialReference'])
    require(all(c.get('wkid') == ctx.native_wkid and c.get('latestWkid', ctx.native_wkid) == ctx.native_wkid
                for c in references), 'native_crs_changed')
    where = ctx.filter_field + ' IN (' + ','.join("'" + z + "'" for z in zones) + ')'
    id_data = checked(fetch(ctx.query_url, {'f': 'json', 'where': where, 'returnIdsOnly': 'true'}))
    require(id_data.get('objectIdFieldName') == 'OBJECTID')
    ids = id_data['objectIds']
    require(isinstance(ids, list) and len(ids) <= MAX_IDS)
    require(all(type(i) is int and i >= 0 for i in ids))
    require(len(ids) == len(set(ids)), 'upstream_id_mismatch')
    count = checked(fetch(ctx.query_url, {'f': 'json', 'where': where, 'returnCountOnly': 'true'}))['count']
    require(type(count) is int and count == len(ids), 'upstream_count_mismatch')
    features, quarantine, seen = [], [], set()
    ids = sorted(ids)
    offset = 0
    while offset < len(ids):
        batch = []
        params = {'f': 'geojson', 'where': where, 'objectIds': '', 'outSR': '4326',
                  'outFields': ','.join(dict.fromkeys(['OBJECTID', 'KODSZN', 'NAMSZN', 'NAMZON', 'NOTHPR', ctx.filter_field])),
                  'returnGeometry': 'true'}
        for oid in ids[offset:offset + ctx.batch_size]:
            candidate = ','.join(map(str, [*batch, oid]))
            if len((ctx.query_url + '?' + urlencode(dict(params, objectIds=candidate))).encode('ascii')) > 1900:
                break
            batch.append(oid)
            params['objectIds'] = candidate
        require(bool(batch), 'upstream_url_budget')
        offset += len(batch)
        data = checked(fetch(ctx.query_url, params))
        require(data.get('type') == 'FeatureCollection' and isinstance(data['features'], list))
        require('crs' not in data or data['crs'].get('properties', {}).get('name') in
                ('EPSG:4326', 'urn:ogc:def:crs:OGC:1.3:CRS84'))
        batch_seen = set()
        for feature in data['features']:
            require(feature.get('type') == 'Feature')
            p = feature['properties']
            oid = p['OBJECTID']
            require(type(oid) is int and oid in batch and oid not in seen, 'upstream_id_mismatch')
            require('id' not in feature or (type(feature['id']) is int and feature['id'] == oid), 'upstream_id_mismatch')
            seen.add(oid)
            batch_seen.add(oid)
            require(p[ctx.filter_field] in zones)
            require(isinstance(p['KODSZN'], str) and bool(p['KODSZN'].strip()))
            require(all(isinstance(p[k], str) and bool(p[k].strip()) for k in ('NAMSZN', 'NAMZON')))
            require(p.get('NOTHPR') is None or isinstance(p['NOTHPR'], str))
            problem = geometry_problem(feature.get('geometry'))
            if problem:
                quarantine.append({'object_id': oid, 'reason': problem, 'feature': feature})
                continue
            features.append({'type': 'Feature', 'id': oid,
                             'geometry': feature['geometry'], 'properties': {
                'object_id': oid, 'zone_code': p['KODSZN'], 'filter_value': p[ctx.filter_field],
                'zone_name': p['NAMSZN'], 'zone_group': p['NAMZON'],
                'regulation': p.get('NOTHPR'), 'plan_id': ctx.id,
                'activity_id': ctx.activity_id, 'activity_name': ctx.activity_name,
                'evidence_status': 'unreviewed_mapping', 'permission': 'unknown'}})
        require(batch_seen == set(batch), 'upstream_id_mismatch')
    require(seen == set(ids), 'upstream_id_mismatch')
    return {'type': 'FeatureCollection', 'features': features, 'meta': {
        'plan': {'id': ctx.id, 'name': ctx.name, 'regionId': ctx.region_id},
        'activity': {'id': ctx.activity_id, 'name': ctx.activity_name,
                     'filterField': ctx.filter_field, 'mappingReviewed': False},
        'kbli': {'code': KBLI, 'version': '2025', 'scope': 'budidaya-kakao',
                 'scopeConfirmed': False, 'mappingReviewed': False},
        'filterZoneCodes': zones,
        'counts': {'matched': len(ids), 'returned': len(features), 'excludedInvalid': len(quarantine)},
        'source': {'status': 'live', 'retrievedAt': retrieved_at, 'activitiesUrl': ctx.activities_url,
                   'catalogUrl': ctx.catalog_url, 'metadataUrl': ctx.metadata_url, 'geometryQueryUrl': ctx.query_url,
                   'nativeWkid': ctx.native_wkid, 'outputWkid': 4326},
        'coverage': 'loaded-plan-matching-zones-only', 'geometryPurpose': 'display',
        'limitations': LIMITATIONS.copy()}}, quarantine


import copy
import hashlib
import os
from pathlib import Path
import tempfile
import threading

LIVE_SLOTS = threading.BoundedSemaphore(3)


def encoded(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'),
                      sort_keys=True).encode('utf-8')


def validate_snapshot(payload, quarantine, plan_id=PLAN_ID):
    ctx = context_for(plan_id)
    require(ctx.activity_id is not None)
    require(payload['type'] == 'FeatureCollection')
    meta = payload['meta']
    require(meta['plan'] == {'id': ctx.id, 'name': ctx.name, 'regionId': ctx.region_id})
    require(meta['activity'] == {'id': ctx.activity_id, 'name': ctx.activity_name,
                                'filterField': ctx.filter_field, 'mappingReviewed': False})
    require(meta['kbli'] == {'code': KBLI, 'version': '2025', 'scope': 'budidaya-kakao',
                            'scopeConfirmed': False, 'mappingReviewed': False})
    require(meta['coverage'] == 'loaded-plan-matching-zones-only' and meta['geometryPurpose'] == 'display')
    require(meta['limitations'] == LIMITATIONS)
    zones = meta['filterZoneCodes']
    require(isinstance(zones, list) and 0 < len(zones) <= 100)
    require(all(isinstance(z, str) and re.fullmatch(r'[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)*', z) for z in zones))
    require(len(zones) == len(set(zones)))
    source = meta['source']
    require(source['status'] == 'live')
    require(source['activitiesUrl'] == ctx.activities_url and source['metadataUrl'] == ctx.metadata_url
            and source['geometryQueryUrl'] == ctx.query_url and source['catalogUrl'] == ctx.catalog_url)
    require(source['nativeWkid'] == ctx.native_wkid and source['outputWkid'] == 4326)
    require(source['retrievedAt'].endswith('Z'))
    timestamp = datetime.fromisoformat(source['retrievedAt'].replace('Z', '+00:00'))
    age = (datetime.now(timezone.utc) - timestamp).total_seconds()
    require(age >= 0)
    require(isinstance(payload['features'], list) and isinstance(quarantine, list))
    seen = set()
    for f in payload['features']:
        p = f['properties']
        oid = p['object_id']
        require(type(oid) is int and oid >= 0 and oid not in seen and type(f['id']) is int and f['id'] == oid)
        seen.add(oid)
        require(f['type'] == 'Feature' and geometry_problem(f['geometry']) is None)
        require(p['filter_value'] in zones and p['plan_id'] == ctx.id and p['activity_id'] == ctx.activity_id)
        require(p['activity_name'] == ctx.activity_name)
        require(isinstance(p['zone_code'], str) and bool(p['zone_code'].strip()))
        require(ctx.filter_field != 'KODSZN' or p['zone_code'] == p['filter_value'])
        require(p['permission'] == 'unknown' and p['evidence_status'] == 'unreviewed_mapping')
        require(all(isinstance(p[k], str) and p[k].strip() for k in ('activity_name', 'zone_name', 'zone_group')))
        require(p['regulation'] is None or isinstance(p['regulation'], str))
    for q in quarantine:
        oid = q['object_id']
        require(type(oid) is int and oid >= 0 and oid not in seen)
        require(q['feature']['properties']['OBJECTID'] == oid and bool(q['reason']))
        require(q['feature']['properties'][ctx.filter_field] in zones)
        require(q['feature'].get('type') == 'Feature')
        require(geometry_problem(q['feature'].get('geometry')) is not None)
        seen.add(oid)
    counts = meta['counts']
    require(all(type(counts[k]) is int for k in ('matched', 'returned', 'excludedInvalid')))
    require(counts == {'matched': len(seen), 'returned': len(payload['features']),
                       'excludedInvalid': len(quarantine)} and len(seen) <= MAX_IDS)
    age = (datetime.now(timezone.utc) - timestamp).total_seconds()
    require(age >= 0)
    return age


class ZoneService:
    def __init__(self, cache_dir, fetch_factory=None, ttl=300, max_stale=3600, plan_id=PLAN_ID):
        self.context = context_for(plan_id)
        self.cache_dir = Path(cache_dir)
        token = 'tirawuta' if plan_id == PLAN_ID else plan_id.replace(':', '-')
        self.cache_path = self.cache_dir / (token + '-01273.json')
        self.fetch_factory = fetch_factory or (lambda: LiveTransport(plan_id=self.context.id))
        self.context_hash = hashlib.sha256(encoded(self.context._asdict())).hexdigest()
        self.ttl = min(300, max(0, ttl))
        self.max_stale = min(3600, max(0, max_stale))
        self.lock = threading.Lock()

    def _read_cache(self):
        try:
            if any(p.is_symlink() for p in (self.cache_path, self.cache_dir, *self.cache_dir.parents)):
                return None
            if self.cache_path.stat().st_size > MAX_SNAPSHOT_BYTES:
                return None
            envelope = strict_json(self.cache_path.read_text(encoding='utf-8'))
            require(envelope['version'] == 2 and envelope['contextHash'] == self.context_hash)
            data = envelope['data']
            require(hashlib.sha256(encoded(data)).hexdigest() == envelope['sha256'])
            age = validate_snapshot(data['payload'], data['quarantine'], self.context.id)
            return data['payload'], age
        except (OSError, APIError, ValueError, TypeError, KeyError, AttributeError, RecursionError):
            return None

    def _write_cache(self, payload, quarantine):
        validate_snapshot(payload, quarantine, self.context.id)
        data = {'payload': payload, 'quarantine': quarantine}
        envelope = {'version': 2, 'contextHash': self.context_hash,
                    'sha256': hashlib.sha256(encoded(data)).hexdigest(), 'data': data}
        if any(p.is_symlink() for p in (self.cache_path, self.cache_dir, *self.cache_dir.parents)):
            raise APIError('cache_unavailable', 503)
        self.cache_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.cache_dir, 0o700)
        fd, name = tempfile.mkstemp(prefix='.snapshot-', dir=self.cache_dir)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(encoded(envelope))
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name, self.cache_path)
        finally:
            if os.path.exists(name):
                os.unlink(name)

    @staticmethod
    def _cached(payload, reason):
        result = copy.deepcopy(payload)
        result['meta']['source'].update(status='cached_snapshot', cacheReason=reason)
        return result

    def get_zones(self, force_live=False, allow_fallback=True):
        if not self.lock.acquire(blocking=False):
            raise APIError('plan_busy', 503)
        try:
            cached = self._read_cache()
            if not force_live and cached and cached[1] < self.ttl:
                return self._cached(cached[0], 'fresh_cache_ttl')
            if not LIVE_SLOTS.acquire(blocking=False):
                raise APIError('upstream_busy', 503)
            try:
                fetch = self.fetch_factory()
                payload, quarantine = load_live(fetch, self.context.id)
                payload['meta']['source']['transfers'] = getattr(fetch, 'records', [])
                self._write_cache(payload, quarantine)
                return payload
            except APIError as error:
                if allow_fallback and error.code in ('upstream_network', 'upstream_http', 'upstream_deadline'):
                    cached = self._read_cache()
                    if cached and cached[1] < self.max_stale:
                        return self._cached(cached[0], error.code)
                raise
            except OSError:
                raise APIError('cache_unavailable', 503) from None
            finally:
                LIVE_SLOTS.release()
        finally:
            self.lock.release()


import mimetypes
import stat
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote

from collections import namedtuple
from types import MappingProxyType

REPO_ROOT = Path(__file__).resolve().parents[1]
# Keep curated bytes fixed for this process; no request can supply source URLs.
CATALOG_BYTES = (REPO_ROOT / 'tools' / 'rdtr-plans.json').read_bytes()
PlanContext = namedtuple('PlanContext', 'id name region_id rtr service_path sublayer filter_field native_wkid '
                         'activity_id activity_name catalog_url activities_url metadata_url query_url batch_size')


def _registry_contexts():
    result = {}
    for p in strict_json(CATALOG_BYTES)['plans']:
        layer = ('https://gistaru.atrbpn.go.id/arcgis/rest/services/' + p['servicePath'] + '/' + str(p['sublayer']))
        activity = p['activity'] or {}
        result[p['id']] = PlanContext(p['id'], p['name'], p['regionId'], p['rtr'], p['servicePath'],
            p['sublayer'], p['filterField'], p['nativeWkid'], activity.get('id'), activity.get('name'),
            p['catalogUrl'], p['activitiesUrl'], PROXY + layer + '?f=pjson', PROXY + layer + '/query',
            p.get('geometryBatchSize', 200))
    return MappingProxyType(result)


PLANS = _registry_contexts()


def context_for(plan_id):
    if not isinstance(plan_id, str) or plan_id not in PLANS:
        raise APIError('unsupported_query', 400)
    return PLANS[plan_id]


def read_static(root, raw_path):
    # Reject encoded separators/traversal rather than normalizing them away.
    path = unquote(raw_path, errors='strict')
    if (not path.startswith('/prototype/') or '%' in path or '\\' in path or
            any(ord(c) < 32 or ord(c) == 127 for c in path)):
        raise APIError('not_found', 404)
    relative = path[len('/prototype/'):]
    if not relative:
        relative = 'index.html'
    parts = relative.split('/')
    if any(not p or p.startswith('.') for p in parts):
        raise APIError('not_found', 404)
    fd = None
    try:
        # openat + O_NOFOLLOW protects each component, not just resolved paths.
        fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        for index, component in enumerate(parts):
            flags = os.O_RDONLY | os.O_NOFOLLOW
            if index < len(parts) - 1:
                flags |= os.O_DIRECTORY
            child = os.open(component, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > 16 * 1024 * 1024:
            raise APIError('not_found', 404)
        with os.fdopen(fd, 'rb') as stream:
            fd = None
            body = stream.read(16 * 1024 * 1024 + 1)
        if len(body) > 16 * 1024 * 1024:
            raise APIError('not_found', 404)
        content_type = mimetypes.guess_type(parts[-1])[0] or 'application/octet-stream'
        return body, content_type
    except (OSError, UnicodeError, ValueError):
        raise APIError('not_found', 404) from None
    finally:
        if fd is not None:
            os.close(fd)


class ZoneHandler(BaseHTTPRequestHandler):
    server_version = 'LocalPrototype/1.0'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, format, *args):
        pass  # Never echo tokens, private filesystem paths, or upstream responses.

    def send_body(self, status, body, content_type='application/json; charset=utf-8', extra=None):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Connection', 'close')
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.close_connection = True
        if self.command != 'HEAD':
            self.wfile.write(body)

    def send_error(self, code, message=None, explain=None):
        self.send_body(code, encoded({'error': {'code': 'http_error'}}))

    def unsupported(self):
        self.send_body(405, encoded({'error': {'code': 'method_not_allowed'}}), extra={'Allow': 'GET'})

    do_POST = unsupported
    do_PUT = unsupported
    do_PATCH = unsupported
    do_DELETE = unsupported
    do_OPTIONS = unsupported
    do_HEAD = unsupported
    do_TRACE = unsupported
    do_CONNECT = unsupported

    def do_GET(self):
        try:
            hosts = self.headers.get_all('Host', [])
            allowed_hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            if len(hosts) != 1 or hosts[0] not in allowed_hosts:
                raise APIError('host_not_allowed', 403)
            origins = self.headers.get_all('Origin', [])
            if origins and (len(origins) != 1 or origins[0] not in {'http://' + h for h in allowed_hosts}):
                raise APIError('origin_not_allowed', 403)
            if len(self.path) > 2048:
                raise APIError('unsupported_query', 400)
            target = urlsplit(self.path)
            if target.scheme or target.netloc or target.fragment:
                raise APIError('not_found', 404)
            if target.path == '/api/catalog':
                if target.query != 'kbli=' + KBLI:
                    raise APIError('unsupported_query', 400)
                self.send_body(200, CATALOG_BYTES)
            elif target.path == '/api/zones':
                plan_id, _ = parse_zone_query(target.query)
                if context_for(plan_id).activity_id is None:
                    raise APIError('activity_mapping_unavailable', 422)
                service = self.server.zone_services.get(plan_id)
                if service is None:
                    raise APIError('unsupported_query', 400)
                payload = service.get_zones()
                self.send_body(200, encoded(payload), 'application/geo+json; charset=utf-8')
            elif target.path == '/' and not target.query:
                self.send_body(302, b'', extra={'Location': '/prototype/'})
            elif not target.query:
                body, content_type = read_static(self.server.prototype_dir, target.path)
                self.send_body(200, body, content_type)
            else:
                raise APIError('not_found', 404)
        except APIError as error:
            self.send_body(error.status, encoded({'error': {'code': error.code}}))
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:
            self.send_body(500, encoded({'error': {'code': 'internal_error'}}))


def make_server(port=8765, prototype_dir=None, service=None, services=None):
    if service is not None and services is not None:
        raise ValueError('choose service or services')
    if services is None:
        services = ({service.context.id: service} if service is not None else
                    {plan_id: ZoneService(REPO_ROOT / 'private' / 'rdtr-cache', plan_id=plan_id) for plan_id in PLANS})
    require(all(context_for(key) == item.context for key, item in services.items()), 'service_context_mismatch')
    server = ThreadingHTTPServer(('127.0.0.1', port), ZoneHandler)
    server.daemon_threads = True
    server.prototype_dir = Path(prototype_dir) if prototype_dir else REPO_ROOT / 'prototype'
    server.zone_services = MappingProxyType(dict(services))
    server.zone_service = server.zone_services.get(PLAN_ID)  # Legacy injected Tirawuta fixture API only.
    return server


def probe_live(service=None):
    """One complete GET on an ephemeral loopback port; never touch port 8765."""
    service = service or ZoneService(REPO_ROOT / 'private' / 'rdtr-cache', ttl=0, max_stale=0)
    server = make_server(port=0, service=service)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        conn = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=120)
        try:
            conn.request('GET', '/api/zones?plan=' + PLAN_ID + '&kbli=' + KBLI)
            response = conn.getresponse()
            body = response.read(64 * 1024 * 1024 + 1)
            require(response.status == 200, 'probe_http_failure')
            require(len(body) == int(response.getheader('Content-Length', '-1')), 'probe_truncated')
            payload = strict_json(body)
            require(payload['type'] == 'FeatureCollection' and payload['meta']['source']['status'] == 'live',
                    'probe_not_live')
            counts = payload['meta']['counts']
            require(counts['returned'] == len(payload['features']) and
                    counts['matched'] == counts['returned'] + counts['excludedInvalid'], 'probe_count_mismatch')
            require(all(geometry_problem(f['geometry']) is None and f['id'] == f['properties']['object_id']
                        and f['properties']['permission'] == 'unknown'
                        and f['properties']['evidence_status'] == 'unreviewed_mapping' for f in payload['features']))
            return {'status': response.status, 'source': payload['meta']['source'],
                    'counts': counts, 'filterZoneCodes': payload['meta']['filterZoneCodes'],
                    'responseBytes': len(body), 'responseSha256': hashlib.sha256(body).hexdigest(),
                    'completeResponseVerified': True}
        finally:
            conn.close()
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--probe-live', action='store_true', help='one complete live GET, ephemeral port, no fallback')
    args = parser.parse_args()
    try:
        if args.probe_live:
            print(json.dumps(probe_live(), ensure_ascii=False, indent=2))
        else:
            server = make_server(port=args.port)
            print(f'Prototype: http://127.0.0.1:{server.server_port}/prototype/', flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
            finally:
                server.server_close()
        return 0
    except (APIError, OSError) as error:
        code = error.code if isinstance(error, APIError) else 'server_unavailable'
        print(json.dumps({'error': {'code': code}}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
