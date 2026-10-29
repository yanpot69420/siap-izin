"""Offline synthetic display-only coverage tests; no live RDTR requests."""
import copy
import hashlib
from datetime import datetime, timezone
import importlib
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import dev_server as server
from test_zone_server import FixtureSource


def display_module():
    assert importlib.util.find_spec('display_geometry'), 'display geometry implementation missing'
    return importlib.import_module('display_geometry')


def payload_fixture(total=2):
    fixture = FixtureSource(server, total)
    shared = [[121.01, -4], [121.01005, -3.998], [121.01, -3.996],
              [121.01005, -3.994], [121.01, -3.99]]
    polygons = [shared + [[121, -3.99], [121, -4], shared[0]],
                list(reversed(shared)) + [[121.02, -4], [121.02, -3.99], shared[-1]]]
    for oid, ring in enumerate(polygons[:total], 1):
        fixture.features[oid]['geometry'] = {'type': 'Polygon', 'coordinates': [ring]}
    return server.load_live(fixture)[0]


class Clock:
    def __init__(self, value):
        self.value = value
    def __call__(self):
        return self.value


class FixtureService:
    def __init__(self, payload=None):
        self.context = server.context_for(server.PLAN_ID)
        self.payload = payload if payload is not None else payload_fixture()
        self.ttl, self.max_stale, self.calls = 300, 3600, 0
    def get_zones(self):
        self.calls += 1
        return copy.deepcopy(self.payload)


def make_display(payload=None, **kwargs):
    module = display_module()
    source = FixtureService(payload)
    timestamp = datetime.fromisoformat(source.payload['meta']['source']['retrievedAt'].replace('Z', '+00:00')).timestamp()
    clock = Clock(timestamp + 1)
    return module.DisplayService(source, clock=clock, **kwargs), source, clock


class GeometryCopyProbe(list):
    """Count deepcopies of original coordinates without timing-dependent checks."""
    def __init__(self, values):
        super().__init__(values)
        self.copies = 0

    def __deepcopy__(self, memo):
        self.copies += 1
        return copy.deepcopy(list(self), memo)


class DisplayGeometryTests(unittest.TestCase):
    def test_snapshot_hash_matches_canonical_without_copying_original_geometry(self):
        module = display_module()
        display, source, _ = make_display()
        payload = source.payload
        # Nonvolatile data, including similarly named keys elsewhere, stays hashed.
        payload['meta']['status'] = 'retained metadata'
        payload['meta']['source']['extra'] = {'cacheReason': 'retained nested provenance'}
        payload['features'][0]['properties']['regulation'] = 'aturan café 水'
        geometry = payload['features'][0]['geometry']
        probe = geometry['coordinates'] = GeometryCopyProbe(geometry['coordinates'])
        for status, reason in [('live', None), ('cached_snapshot', 'fresh_cache_ttl')]:
            with self.subTest(status=status):
                payload['meta']['source']['status'] = status
                if reason is not None:
                    payload['meta']['source']['cacheReason'] = reason
                before = module.encoded(payload)
                # Reference the exact pre-optimization canonicalization algorithm.
                canonical = copy.deepcopy(payload)
                canonical['meta']['source'].pop('status', None)
                canonical['meta']['source'].pop('cacheReason', None)
                expected = hashlib.sha256(module.encoded({
                    'context': display.context._asdict(), 'source': canonical})).hexdigest()
                probe.copies = 0
                self.assertEqual(display._snapshot(payload), expected)
                self.assertEqual(module.encoded(payload), before, 'hashing must not mutate the source')
                self.assertEqual(probe.copies, 0, 'hashing must not deepcopy original coordinates')

    def test_successful_generalization_never_copies_original_coordinates_and_detaches_cache(self):
        module = display_module()
        display, source, _ = make_display()
        probes = []
        for feature in source.payload['features']:
            geometry = feature['geometry']
            probe = geometry['coordinates'] = GeometryCopyProbe(geometry['coordinates'])
            probes.append(probe)
        # Exercise the display service against a shared, read-only source object;
        # FixtureService's normal defensive copy must not hide service allocations.
        source.get_zones = lambda: source.payload
        before = module.encoded(source.payload)
        for level in module.LEVELS:
            with self.subTest(level=level):
                result = display.get_display(level)
                self.assertEqual(result['meta']['display']['method'], 'coverage_simplify')
                expected = module.encoded(result)
                self.assertEqual([probe.copies for probe in probes], [0, 0],
                                 'successful generalization must not deepcopy original coordinates')
                result['features'][0]['geometry']['coordinates'][0][0][0] = 0
                result['meta']['source']['status'] = 'mutated response'
                self.assertEqual(module.encoded(display.get_display(level)), expected,
                                 'returned geometry and metadata must be detached from the cache')
                self.assertEqual(module.encoded(source.payload), before)

    def test_overview_preserves_inventory_and_projects_properties_without_source_mutation(self):
        display, source, clock = make_display()
        original = copy.deepcopy(source.payload)
        result = display.get_display('overview')
        self.assertEqual(result['type'], 'FeatureCollection')
        self.assertEqual([f['id'] for f in result['features']], [1, 2])
        meta = result['meta']
        self.assertEqual(meta['counts'], original['meta']['counts'])
        self.assertEqual(meta['sourceCounts'], original['meta']['counts'])
        self.assertEqual(meta['source'], original['meta']['source'])
        self.assertEqual(meta['sourceBounds'], [121.0, -4.0, 121.02, -3.99])
        self.assertRegex(meta['snapshotId'], r'^[0-9a-f]{64}$')
        info = meta['display']
        self.assertEqual(info['algorithmVersion'], 'coverage-lod-v1')
        self.assertEqual(info['purpose'], 'display-only-not-analysis-or-export')
        self.assertEqual((info['level'], info['toleranceMeters']), ('overview', 100))
        self.assertEqual((info['sourceFeatureCount'], info['returnedFeatureCount']), (2, 2))
        self.assertEqual(info['method'], 'coverage_simplify')
        self.assertIsNone(info['fallbackReason'])
        self.assertIsNone(info['bbox'])
        self.assertLess(info['returnedVertices'], info['originalVertices'])
        self.assertEqual(info['validation'], {'featureIdsPreserved': True, 'geometryValid': True, 'coverageValid': True})
        for feature in result['features']:
            self.assertEqual(set(feature['properties']), {'object_id', 'plan_id', 'zone_name', 'zone_code',
                'zone_group', 'subzone_name', 'filter_value', 'activity_id', 'activity_name',
                'permission', 'evidence_status', 'source_bounds'})
            self.assertEqual(feature['properties']['permission'], 'unknown')
            self.assertEqual(feature['properties']['evidence_status'], 'unreviewed_mapping')
        self.assertEqual(source.payload, original)

    def test_invalid_coverage_preserves_exact_original_coordinates_without_simplification(self):
        from unittest.mock import patch
        payload = payload_fixture()
        payload['features'][1]['geometry'] = copy.deepcopy(payload['features'][0]['geometry'])
        display, source, clock = make_display(payload)
        with patch('display_geometry.shapely.coverage_simplify', side_effect=AssertionError('unsafe simplify')):
            result = display.get_display('overview')
        self.assertEqual([f['geometry'] for f in result['features']], [f['geometry'] for f in payload['features']])
        self.assertEqual(result['meta']['display']['method'], 'original_preserved')
        self.assertEqual(result['meta']['display']['fallbackReason'], 'coverage_invalid')
        self.assertFalse(result['meta']['display']['validation']['coverageValid'])
        self.assertEqual(result['meta']['display']['originalVertices'], result['meta']['display']['returnedVertices'])

    def test_empty_source_is_not_synthesized_and_has_no_bounds(self):
        from unittest.mock import patch
        display, source, clock = make_display(payload_fixture(0))
        with patch('display_geometry.shapely.coverage_simplify', side_effect=AssertionError('empty simplify')):
            result = display.get_display('overview')
        self.assertEqual(result['features'], [])
        self.assertEqual(result['meta']['display']['method'], 'original_preserved')
        self.assertIsNone(result['meta']['sourceBounds'])
        self.assertEqual(result['meta']['display']['returnedVertices'], 0)
        self.assertEqual(result['meta']['display']['originalVertices'], 0)
        self.assertIsNone(result['meta']['display']['validation']['coverageValid'])

    def test_levels_are_lazy_cached_by_full_snapshot_with_current_provenance(self):
        from unittest.mock import patch
        import shapely
        display, source, clock = make_display()
        simplify = shapely.coverage_simplify
        with patch('display_geometry.shapely.coverage_simplify', wraps=simplify) as operation:
            first = display.get_display('overview')
            self.assertEqual(operation.call_count, 1)
            source.payload['meta']['source'].update(status='cached_snapshot', cacheReason='fresh_cache_ttl')
            second = display.get_display('overview')
            self.assertEqual(operation.call_count, 1, 'same level must reuse derived geometry')
            self.assertEqual(first['meta']['snapshotId'], second['meta']['snapshotId'])
            self.assertEqual(second['meta']['source']['status'], 'cached_snapshot')
            self.assertEqual(first['meta']['source']['status'], 'live')
            regional = display.get_display('regional')
            self.assertEqual(operation.call_count, 2, 'levels must be built on demand only')
            self.assertEqual(regional['meta']['snapshotId'], first['meta']['snapshotId'])
            source.payload['features'][0]['properties']['regulation'] = 'changed detail attribute'
            changed = display.get_display('overview')
            self.assertEqual(operation.call_count, 3)
            self.assertNotEqual(changed['meta']['snapshotId'], first['meta']['snapshotId'])
            source.payload['features'][0]['geometry']['coordinates'][0][1][0] += .000001
            changed_geometry = display.get_display('overview')
            self.assertNotEqual(changed_geometry['meta']['snapshotId'], changed['meta']['snapshotId'])
        self.assertEqual(source.calls, 5)
        # Returned JSON is detached from the derived cache as well as from the source.
        second['features'][0]['geometry']['coordinates'] = []
        self.assertTrue(display.get_display('overview')['features'][0]['geometry']['coordinates'])

    def test_viewport_copies_only_matches_with_identical_bytes_and_detached_metadata(self):
        from unittest.mock import patch
        from shapely.geometry import box
        module = display_module()
        display, source, _ = make_display()
        source.get_zones = lambda: source.payload
        original = module.encoded(source.payload)
        whole = display.get_display('overview')
        cached, info = display._levels['overview']
        probes = []
        for feature in cached:
            coords = feature['geometry']['coordinates']
            feature['geometry']['coordinates'] = GeometryCopyProbe(coords)
            probes.append(feature['geometry']['coordinates'])
        for bbox in ((121.001, -3.999, 121.002, -3.998), (122, -5, 123, -4)):
            selected = [f for f, g in zip(whole['features'], display._original) if g.intersects(box(*bbox))]
            expected = copy.deepcopy(whole)
            expected['features'] = selected
            expected['meta']['display'].update(bbox=list(bbox), returnedFeatureCount=len(selected),
                returnedVertices=sum(int(module.shapely.get_num_coordinates(module.shape(f['geometry']))) for f in selected))
            for probe in probes:
                probe.copies = 0
            result = display.get_display('overview', bbox)
            self.assertEqual(module.encoded(result), module.encoded(expected))
            self.assertEqual([p.copies for p in probes], [int(f in selected) for f in whole['features']])
            with patch.object(module, 'shape', side_effect=AssertionError('GEOS only to count vertices')):
                self.assertEqual(module.encoded(display.get_display('overview', bbox)), module.encoded(expected))
            result['meta']['display']['validation']['geometryValid'] = False
            result['meta']['source']['status'] = 'mutated'
            if result['features']:
                result['features'][0]['geometry']['coordinates'].clear()
            self.assertEqual(module.encoded(display.get_display('overview', bbox)), module.encoded(expected))
        self.assertEqual(module.encoded(source.payload), original)

    def test_bbox_inside_polygon_hole_remains_empty(self):
        payload = payload_fixture(1)
        payload['features'][0]['geometry']['coordinates'] = [
            [[121, -4], [121.02, -4], [121.02, -3.98], [121, -3.98], [121, -4]],
            [[121.005, -3.995], [121.005, -3.985], [121.015, -3.985], [121.015, -3.995], [121.005, -3.995]]]
        for kind in ('Polygon', 'MultiPolygon'):
            with self.subTest(kind=kind):
                candidate = copy.deepcopy(payload)
                if kind == 'MultiPolygon':
                    geom = candidate['features'][0]['geometry']
                    geom.update(type=kind, coordinates=[geom['coordinates']])
                display, source, _ = make_display(candidate)
                before = display_module().encoded(source.payload)
                whole = display.get_display('overview')
                result = display.get_display('overview', [121.008, -3.992, 121.012, -3.988])
                self.assertEqual(result['features'], [])
                self.assertEqual(result['meta']['display']['returnedVertices'], 0)
                selected = display.get_display('overview', [121, -4, 121.02, -3.98])
                self.assertEqual(selected['meta']['display']['returnedVertices'], whole['meta']['display']['returnedVertices'])
                self.assertEqual(display_module().encoded(source.payload), before)

    def test_bbox_uses_original_intersection_not_simplified_shape_or_bounds(self):
        from shapely.geometry import box, shape
        display, source, clock = make_display()
        whole = display.get_display('overview')
        bbox = [121.01002, -3.9981, 121.01004, -3.9979]
        self.assertTrue(shape(source.payload['features'][0]['geometry']).intersects(box(*bbox)))
        self.assertFalse(shape(whole['features'][0]['geometry']).intersects(box(*bbox)))
        result = display.get_display('overview', bbox=bbox)
        self.assertIn(1, [f['id'] for f in result['features']])
        self.assertEqual(result['meta']['sourceCounts']['returned'], 2)
        self.assertEqual(result['meta']['snapshotId'], whole['meta']['snapshotId'])
        self.assertEqual(result['meta']['display']['bbox'], bbox)
        empty = display.get_display('detail', bbox=[122, -5, 123, -4])
        self.assertEqual(empty['features'], [])
        self.assertEqual(empty['meta']['display']['sourceFeatureCount'], 2)
        self.assertEqual(empty['meta']['display']['returnedFeatureCount'], 0)
        self.assertEqual(empty['meta']['display']['returnedVertices'], 0)
        # Inside the envelope of a triangle, but outside its true geometry.
        one = payload_fixture(1)
        one['features'][0]['geometry']['coordinates'] = [[[121, -4], [121.02, -4], [121, -3.98], [121, -4]]]
        triangle, _, _ = make_display(one)
        self.assertEqual(triangle.get_display('overview', bbox=[121.018, -3.982, 121.019, -3.981])['features'], [])

    def test_detail_attributes_are_bound_to_plan_oid_and_snapshot_without_geometry(self):
        from unittest.mock import patch
        display, source, clock = make_display()
        source.payload['features'][0]['properties']['regulation'] = '<script>literal source text</script>'
        inventory = display.get_display('overview')
        snapshot = inventory['meta']['snapshotId']
        with patch('display_geometry.shapely.coverage_simplify', side_effect=AssertionError('detail must not build level')):
            result = display.get_feature_detail(1, snapshot)
        self.assertEqual(set(result), {'schemaVersion', 'planId', 'objectId', 'snapshotId', 'properties', 'sourceBounds', 'meta'})
        self.assertEqual(result['schemaVersion'], 1)
        self.assertEqual((result['planId'], result['objectId'], result['snapshotId']), (server.PLAN_ID, 1, snapshot))
        self.assertEqual(result['properties'], source.payload['features'][0]['properties'])
        self.assertEqual(result['meta']['sourceCounts'], source.payload['meta']['counts'])
        self.assertEqual(result['sourceBounds'], inventory['features'][0]['properties']['source_bounds'])
        self.assertNotIn('geometry', result)
        self.assertNotIn('coordinates', result)
        with self.assertRaises(server.APIError) as missing:
            display.get_feature_detail(999, snapshot)
        self.assertEqual(missing.exception.status, 404)
        source.payload['features'][0]['properties']['regulation'] = 'new source attributes'
        with self.assertRaises(server.APIError) as conflict:
            display.get_feature_detail(1, snapshot)
        self.assertEqual((conflict.exception.status, conflict.exception.code), (409, 'snapshot_changed'))

    def test_source_age_is_checked_after_compute_reuse_and_detail_without_extension(self):
        from unittest.mock import patch
        import shapely
        for kind, initial_age, elapsed, status, reason in [
                ('compute', 299, 1, 'live', None),
                ('reuse', 299, 1, 'cached_snapshot', 'fresh_cache_ttl'),
                ('compute', 3599, 1, 'cached_snapshot', 'upstream_network'),
                ('detail', 3599, 1, 'cached_snapshot', 'upstream_http')]:
            with self.subTest(kind=kind, status=status):
                display, source, clock = make_display()
                result = display.get_display('overview')
                timestamp = clock.value - 1
                clock.value = timestamp + initial_age
                source.payload['meta']['source']['status'] = status
                if reason:
                    source.payload['meta']['source']['cacheReason'] = reason
                simplify = shapely.coverage_simplify
                if kind == 'compute':
                    def delayed(*args, **kwargs):
                        candidate = simplify(*args, **kwargs)
                        clock.value += elapsed
                        return candidate
                    guard = patch('display_geometry.shapely.coverage_simplify', side_effect=delayed)
                    action = lambda: display.get_display('regional')
                else:
                    original_encoded = display_module().encoded
                    def delayed(value):
                        encoded = original_encoded(value)
                        clock.value = timestamp + initial_age + elapsed
                        return encoded
                    guard = patch('display_geometry.encoded', side_effect=delayed)
                    action = (lambda: display.get_display('overview')) if kind == 'reuse' else (
                        lambda: display.get_feature_detail(1, result['meta']['snapshotId']))
                with guard, self.assertRaises(server.APIError) as expired:
                    action()
                self.assertEqual((expired.exception.status, expired.exception.code), (503, 'source_snapshot_expired'))
                self.assertEqual(source.payload['meta']['source']['retrievedAt'], result['meta']['source']['retrievedAt'])
        display, source, clock = make_display()
        original = display.get_display('overview')
        timestamp = clock.value - 1
        source.payload['meta']['source'].update(status='cached_snapshot', cacheReason='upstream_network')
        clock.value = timestamp + 3599
        self.assertEqual(display.get_display('overview')['meta']['source']['cacheReason'], 'upstream_network')
        clock.value = timestamp + 3600
        with self.assertRaises(server.APIError):
            display.get_display('overview')
        source.payload['meta']['source'].update(retrievedAt=datetime.fromtimestamp(clock.value, timezone.utc).isoformat().replace('+00:00', 'Z'), status='live')
        self.assertEqual(display.get_display('overview')['meta']['source']['status'], 'live')

    def test_plan_lock_fails_independently_and_recovers_after_source_error(self):
        from concurrent.futures import ThreadPoolExecutor
        import threading
        display, source, _ = make_display()
        other, _, _ = make_display()
        entered, release = threading.Event(), threading.Event()
        get_zones = source.get_zones
        def slow_source():
            entered.set()
            self.assertTrue(release.wait(5))
            return get_zones()
        source.get_zones = slow_source
        with ThreadPoolExecutor(2) as pool:
            first = pool.submit(display.get_display, 'overview')
            self.assertTrue(entered.wait(5))
            try:
                with self.assertRaises(server.APIError) as busy:
                    display.get_display('overview')
                self.assertEqual((busy.exception.code, busy.exception.status), ('plan_busy', 503))
                self.assertEqual(len(other.get_display('overview')['features']), 2)
            finally:
                release.set()
            self.assertEqual(len(first.result(5)['features']), 2)
        def failed():
            raise server.APIError('upstream_network')
        source.get_zones = failed
        with self.assertRaises(server.APIError):
            display.get_display('overview')
        source.get_zones = get_zones
        self.assertEqual(len(display.get_display('overview')['features']), 2)

    def test_untrusted_source_id_count_and_topology_fail_closed_without_repair(self):
        mutations = [lambda p: p['features'][1].update(id=1),
                     lambda p: p['features'][0]['properties'].update(object_id=99),
                     lambda p: p['meta']['counts'].update(returned=99),
                     lambda p: p['features'][0]['properties'].update(plan_id='other-plan'),
                     lambda p: p['features'][0]['geometry'].update(coordinates=[])]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                payload = payload_fixture()
                mutation(payload)
                display, source, _ = make_display(payload)
                with self.assertRaises(server.APIError) as invalid:
                    display.get_display('overview')
                self.assertEqual(invalid.exception.code, 'source_snapshot_invalid')

    def test_serialized_output_is_validated_before_success_not_only_geos_candidate(self):
        from unittest.mock import patch
        bad_geometry = {'type': 'Polygon', 'coordinates': [[[999, -4], [1000, -4], [999, -3], [999, -4]]]}
        display, source, _ = make_display()
        with patch('display_geometry.mapping', return_value=bad_geometry):
            result = display.get_display('overview')
        self.assertEqual(result['meta']['display']['fallbackReason'], 'quality_validation_failed')
        self.assertEqual([f['geometry'] for f in result['features']], [f['geometry'] for f in source.payload['features']])

    def test_failed_initial_coverage_validation_preserves_source_with_unknown_coverage(self):
        from unittest.mock import patch
        import shapely
        display, source, _ = make_display()
        with patch('display_geometry.shapely.coverage_is_valid', side_effect=shapely.errors.GEOSException('validation failure')):
            result = display.get_display('overview')
        self.assertEqual(result['meta']['display']['fallbackReason'], 'quality_validation_failed')
        self.assertIsNone(result['meta']['display']['validation']['coverageValid'])
        self.assertEqual([f['geometry'] for f in result['features']], [f['geometry'] for f in source.payload['features']])

    def test_failed_whole_level_quality_validation_falls_back_not_repairs(self):
        from unittest.mock import patch
        import shapely
        from shapely.geometry import Polygon
        cases = [[], [None, None], [Polygon(), Polygon()],
                 [Polygon([(0, 0), (1, 1), (1, 0), (0, 1), (0, 0)])] * 2,
                 [Polygon([(0, 0), (1, 0), (1, 1), (0, 0)])] * 2,
                 shapely.errors.GEOSException('synthetic failure')]
        for candidate in cases:
            with self.subTest(candidate=str(candidate)[:100]):
                display, source, clock = make_display()
                kwargs = {'side_effect': candidate} if isinstance(candidate, Exception) else {'return_value': candidate}
                with patch('display_geometry.shapely.coverage_simplify', **kwargs):
                    result = display.get_display('overview')
                self.assertEqual(result['meta']['display']['method'], 'original_preserved')
                self.assertEqual(result['meta']['display']['fallbackReason'], 'quality_validation_failed')
                self.assertEqual([f['geometry'] for f in result['features']], [f['geometry'] for f in source.payload['features']])
                self.assertTrue(result['meta']['display']['validation']['coverageValid'])


if __name__ == '__main__':
    unittest.main()
