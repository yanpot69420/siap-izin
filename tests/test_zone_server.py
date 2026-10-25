"""Offline synthetic fixtures, never official/real RDTR evidence."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / 'tools' / 'dev_server.py'


def load_server():
    spec = importlib.util.spec_from_file_location('zone_server', MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class QueryTests(unittest.TestCase):
    def test_literal_allowlist(self):
        self.assertTrue(MODULE.exists(), 'zone server implementation missing')
        server = load_server()
        self.assertEqual(server.parse_zone_query('plan=7411000000:001&kbli=01273'),
                         ('7411000000:001', '01273'))
        for query in ['', 'plan=7411000000:001', 'plan=7411000000:001&kbli=1273',
                      'plan=7411000000:001&kbli=01273&kbli=01273',
                      'plan=7411000000:001&plan=7411000000:001&kbli=01273',
                      'plan=7411000000:002&kbli=01273',
                      'plan=7411000000:001&kbli=01273&url=https://example.org',
                      'plan=7411000000:001&kbli=+01273',
                      'plan=7411000000:001&kbli=%30%31%32%37%33',
                      'plan=7411000000%3A001&kbli=01273',
                      'plan=7411000000:001&kbli=01273&',
                      'PLAN=7411000000:001&kbli=01273']:
            with self.subTest(query=query), self.assertRaises(server.APIError):
                server.parse_zone_query(query)


# All fixture coordinates and records below are invented for offline tests.
import copy
import json
from urllib.parse import parse_qs


def fixture_feature(oid):
    return {'type': 'Feature', 'id': oid, 'properties': {
        'OBJECTID': oid, 'KODSZN': 'P-3', 'NAMSZN': 'Fixture subzone',
        'NAMZON': 'Fixture group', 'NOTHPR': None}, 'geometry': {
        'type': 'Polygon', 'coordinates': [[[121, -4], [122, -4],
                                           [122, -3], [121, -3], [121, -4]]]}}


class FixtureSource:
    """Synthetic transport fixture, not a real source response."""
    def __init__(self, server, total=201):
        self.server = server
        self.ids = list(range(1, total + 1))
        self.calls = []
        self.activities = {'status': 200, 'data': [
            {'id_kegiatan': '041', 'kegiatan': 'Fixture broad activity',
             'nilai_kolom_unik': json.dumps({'data': ['P-3']})}]}
        self.metadata = {'name': 'Fixture Tirawuta layer',
                         'geometryType': 'esriGeometryPolygon',
                         'extent': {'spatialReference': {'wkid': 4326}},
                         'fields': [{'name': n, 'type': 'esriFieldTypeOID' if n == 'OBJECTID'
                                     else 'esriFieldTypeString'} for n in
                                    ['OBJECTID', 'KODSZN', 'NAMSZN', 'NAMZON', 'NOTHPR']]}
        self.features = {i: fixture_feature(i) for i in self.ids}
        self.transform = lambda data, params: data

    def __call__(self, url, params=None):
        self.calls.append((url, params))
        if url == self.server.ACTIVITIES_URL:
            data = self.activities
        elif url == self.server.METADATA_URL:
            data = self.metadata
        elif params.get('returnIdsOnly') == 'true':
            data = {'objectIdFieldName': 'OBJECTID', 'objectIds': self.ids}
        elif params.get('returnCountOnly') == 'true':
            data = {'count': len(self.ids)}
        else:
            data = {'type': 'FeatureCollection', 'features': [self.features[int(i)]
                    for i in params['objectIds'].split(',')]}
        return copy.deepcopy(self.transform(data, params or {}))


class SourceTests(unittest.TestCase):
    def test_rejects_incomplete_or_corrupt_fixture_source(self):
        server = load_server()
        mutations = {
            'missing_activity': lambda f: f.activities.update(data=[]),
            'numeric_activity_not_exact': lambda f: f.activities['data'][0].update(id_kegiatan=41),
            'duplicate_activity': lambda f: f.activities['data'].append(copy.deepcopy(f.activities['data'][0])),
            'activity_error': lambda f: f.activities.update(status=500),
            'invalid_zone_json': lambda f: f.activities['data'][0].update(nilai_kolom_unik='{'),
            'empty_zones': lambda f: f.activities['data'][0].update(nilai_kolom_unik='{"data":[]}'),
            'injection_zone': lambda f: f.activities['data'][0].update(nilai_kolom_unik='{"data":["P-3\' OR 1=1"]}'),
            'duplicate_zone': lambda f: f.activities['data'][0].update(nilai_kolom_unik='{"data":["P-3","P-3"]}'),
            'missing_field': lambda f: f.metadata.update(fields=[]),
            'wrong_native_crs': lambda f: f.metadata['extent'].update(spatialReference={'wkid': 32751}),
            'wrong_oid_type': lambda f: f.metadata['fields'][0].update(type='esriFieldTypeString'),
            'duplicate_ids': lambda f: f.ids.append(1),
            'string_oid': lambda f: f.ids.append('2'),
            'wrong_zone': lambda f: f.features[1]['properties'].update(KODSZN='R-1'),
            'missing_property': lambda f: f.features[1]['properties'].pop('NAMSZN'),
        }
        for name, mutate in mutations.items():
            with self.subTest(case=name):
                fixture = FixtureSource(server, 2)
                mutate(fixture)
                with self.assertRaises(server.APIError):
                    server.load_live(fixture)
        for case in ['error', 'transfer', 'count', 'missing', 'duplicate', 'unexpected', 'wrong_type']:
            fixture = FixtureSource(server, 2)
            def transform(data, params):
                if case == 'error':
                    return {'error': {'code': 500}}
                if case == 'transfer':
                    return dict(data, exceededTransferLimit=True)
                if case == 'count' and params.get('returnCountOnly') == 'true':
                    return {'count': 3}
                if 'features' in data:
                    if case == 'missing':
                        data['features'].pop()
                    if case == 'duplicate':
                        data['features'].append(copy.deepcopy(data['features'][0]))
                    if case == 'unexpected':
                        data['features'][0]['properties']['OBJECTID'] = 999
                    if case == 'wrong_type':
                        data['type'] = 'NotGeoJSON'
                return data
            fixture.transform = transform
            with self.subTest(case=case), self.assertRaises(server.APIError):
                server.load_live(fixture)

    def test_invalid_fixture_geometries_quarantined_without_repair(self):
        server = load_server()
        fixture = FixtureSource(server, 6)
        geometries = [None, {'type': 'Polygon', 'coordinates': []},
                      {'type': 'Polygon', 'coordinates': [[[121, -4], [122, -3],
                                                          [122, -4], [121, -3], [121, -4]]]},
                      {'type': 'Point', 'coordinates': [121, -4]},
                      {'type': 'Polygon', 'coordinates': [[[999, 0], [1000, 0],
                                                           [1000, 1], [999, 1], [999, 0]]]}]
        for oid, geometry in enumerate(geometries, 2):
            fixture.features[oid]['geometry'] = geometry
        result, quarantine = server.load_live(fixture)
        self.assertEqual(result['meta']['counts'], {'matched': 6, 'returned': 1, 'excludedInvalid': 5})
        self.assertEqual([f['id'] for f in result['features']], [1])
        self.assertEqual([f['object_id'] for f in quarantine], [2, 3, 4, 5, 6])
        self.assertEqual(quarantine[2]['feature']['geometry'], geometries[2])
        self.assertTrue(all(q['reason'] for q in quarantine))

    def test_unclosed_fixture_ring_is_not_silently_closed_by_shapely(self):
        server = load_server()
        fixture = FixtureSource(server, 1)
        original = fixture.features[1]['geometry']['coordinates'][0]
        original.pop()  # Shapely shape() normally closes this ring: do not permit repair.
        result, quarantine = server.load_live(fixture)
        self.assertEqual(result['meta']['counts'], {'matched': 1, 'returned': 0, 'excludedInvalid': 1})
        self.assertEqual(quarantine[0]['feature']['geometry']['coordinates'][0], original)

    def test_conflicting_fixture_native_crs_fails_closed(self):
        server = load_server()
        fixture = FixtureSource(server, 1)
        fixture.metadata['extent']['spatialReference'] = {'wkid': 32751, 'latestWkid': 4326}
        with self.assertRaises(server.APIError):
            server.load_live(fixture)

    def test_complete_fixture_pipeline_contract_and_batches(self):
        server = load_server()
        self.assertTrue(hasattr(server, 'load_live'), 'live loader missing')
        fixture = FixtureSource(server)
        result, quarantine = server.load_live(fixture)
        self.assertEqual(quarantine, [])
        self.assertEqual(result['type'], 'FeatureCollection')
        meta = result['meta']
        self.assertEqual(meta['counts'], {'matched': 201, 'returned': 201, 'excludedInvalid': 0})
        self.assertEqual(meta['plan'], {'id': '7411000000:001',
                         'name': 'RDTR Kawasan Perkotaan Tirawuta', 'regionId': '7411000000'})
        self.assertEqual(meta['kbli'], {'code': '01273', 'version': '2025',
                         'scope': 'budidaya-kakao', 'scopeConfirmed': False, 'mappingReviewed': False})
        self.assertEqual(meta['filterZoneCodes'], ['P-3'])
        self.assertEqual(meta['coverage'], 'loaded-plan-matching-zones-only')
        self.assertEqual(meta['geometryPurpose'], 'display')
        self.assertGreaterEqual(len(meta['limitations']), 4)
        self.assertEqual(meta['source']['status'], 'live')
        self.assertTrue(meta['source']['retrievedAt'].endswith('Z'))
        feature = result['features'][0]
        self.assertEqual(feature['id'], 1)
        self.assertEqual(feature['properties'], {
            'object_id': 1, 'zone_code': 'P-3', 'zone_name': 'Fixture subzone',
            'zone_group': 'Fixture group', 'regulation': None,
            'plan_id': '7411000000:001', 'activity_id': '041',
            'activity_name': 'Fixture broad activity',
            'evidence_status': 'unreviewed_mapping', 'permission': 'unknown'})
        batches = [p for u, p in fixture.calls if p and 'objectIds' in p]
        self.assertEqual([len(p['objectIds'].split(',')) for p in batches], [200, 1])
        self.assertTrue(all(p['f'] == 'geojson' and p['outSR'] == '4326' for p in batches))
        queries = [p for u, p in fixture.calls if u == server.GEOMETRY_QUERY_URL]
        self.assertTrue(all(p['where'] == "KODSZN IN ('P-3')" for p in queries))


import io
from unittest.mock import Mock


class TransportTests(unittest.TestCase):
    def test_bounded_fixture_transport_and_fixed_allowlist(self):
        server = load_server()
        self.assertTrue(hasattr(server, 'LiveTransport'), 'bounded transport missing')
        class FixtureReply(io.BytesIO):
            def __init__(self, body, status=200, headers=None):
                super().__init__(body)
                self.status = status
                self.headers = headers or {'Content-Type': 'application/json',
                                          'Content-Length': str(len(body))}
            def read1(self, size=-1):
                return self.read(size)
        opener = Mock()
        opener.open.return_value = FixtureReply(b'{"fixture":true}')
        transport = server.LiveTransport(opener=opener, max_bytes=100)
        self.assertEqual(transport(server.ACTIVITIES_URL), {'fixture': True})
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, server.ACTIVITIES_URL)
        self.assertIn('rdtrinteraktif', request.get_header('Referer'))
        self.assertGreater(opener.open.call_args.kwargs['timeout'], 0)
        self.assertLessEqual(opener.open.call_args.kwargs['timeout'], 20)
        self.assertEqual(transport.records[0]['bytes'], 16)
        with self.assertRaises(server.APIError):
            transport('https://example.org/')
        self.assertEqual(opener.open.call_count, 1)
        for name, reply in [
            ('http', FixtureReply(b'{}', status=500)),
            ('redirect', FixtureReply(b'{}', status=302)),
            ('invalid_json', FixtureReply(b'{')),
            ('error_json', FixtureReply(b'{"error":{"code":500}}')),
            ('html', FixtureReply(b'{}', headers={'Content-Type': 'text/html'})),
            ('declared_oversize', FixtureReply(b'{}', headers={'Content-Length': '1000'})),
            ('stream_oversize', FixtureReply(b' ' * 101, headers={'Content-Type': 'application/json'})),
            ('truncated', FixtureReply(b'{}', headers={'Content-Type': 'application/json', 'Content-Length': '5'})),
            ('non_object', FixtureReply(b'[]')),
            ('nan', FixtureReply(b'{"fixture":NaN}')),
            ('duplicate_key', FixtureReply(b'{"fixture":1,"fixture":2}')),
        ]:
            opener.open.return_value = reply
            with self.subTest(case=name), self.assertRaises(server.APIError):
                server.LiveTransport(opener=opener, max_bytes=100)(server.METADATA_URL)
        opener.open.side_effect = TimeoutError('fixture private path')
        with self.assertRaises(server.APIError) as error:
            server.LiveTransport(opener=opener)(server.ACTIVITIES_URL)
        self.assertNotIn('private path', str(error.exception))
        transport = server.LiveTransport(opener=opener, total_timeout=0)
        with self.assertRaises(server.APIError):
            transport(server.ACTIVITIES_URL)


import os
import tempfile


class CacheTests(unittest.TestCase):
    def test_fixture_cache_atomic_provenance_ttl_and_network_fallback(self):
        server = load_server()
        self.assertTrue(hasattr(server, 'ZoneService'), 'validated private cache missing')
        with tempfile.TemporaryDirectory(prefix='zone-fixture-') as directory:
            cache = Path(directory).resolve() / 'private' / 'rdtr-cache'
            fixture = FixtureSource(server, 2)
            service = server.ZoneService(cache, fetch_factory=lambda: fixture)
            first = service.get_zones()
            self.assertEqual(first['meta']['source']['status'], 'live')
            self.assertEqual(len(list(cache.iterdir())), 1)
            path = cache / 'tirawuta-01273.json'
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            second = service.get_zones()
            self.assertEqual(second['meta']['source']['status'], 'cached_snapshot')
            self.assertEqual(second['meta']['source']['cacheReason'], 'fresh_cache_ttl')
            stamp = first['meta']['source']['retrievedAt']
            self.assertEqual(second['meta']['source']['retrievedAt'], stamp)
            self.assertEqual(len(fixture.calls), 5)
            def network_failure(*args):
                raise server.APIError('upstream_network')
            fallback = server.ZoneService(cache, fetch_factory=lambda: network_failure, ttl=0)
            stale = fallback.get_zones()
            self.assertEqual(stale['meta']['source']['cacheReason'], 'upstream_network')
            self.assertEqual(stale['meta']['source']['retrievedAt'], stamp)
            expired = server.ZoneService(cache, fetch_factory=lambda: network_failure, ttl=0, max_stale=0)
            with self.assertRaises(server.APIError):
                expired.get_zones()
            bad_fixture = FixtureSource(server, 2)
            bad_fixture.transform = lambda data, p: {'error': {'code': 500}}
            with self.assertRaises(server.APIError):
                server.ZoneService(cache, fetch_factory=lambda: bad_fixture, ttl=0).get_zones()
            # A failed refresh must not overwrite the validated cache.
            self.assertEqual(server.ZoneService(cache, fetch_factory=lambda: network_failure).get_zones()
                             ['meta']['source']['retrievedAt'], stamp)
            with self.assertRaises(server.APIError):
                expired.get_zones(force_live=True, allow_fallback=False)

    def test_fixture_cache_corruption_rejected_and_no_partial_write(self):
        server = load_server()
        self.assertTrue(hasattr(server, 'ZoneService'), 'validated private cache missing')
        with tempfile.TemporaryDirectory(prefix='zone-fixture-') as directory:
            cache = Path(directory).resolve() / 'cache'
            fixture = FixtureSource(server, 1)
            service = server.ZoneService(cache, fetch_factory=lambda: fixture)
            service.get_zones()
            path = cache / 'tirawuta-01273.json'
            original = path.read_text()
            for broken in ['{', original.replace('unknown', 'allowed'), '{"version":1}']:
                path.write_text(broken)
                def fail(*args):
                    raise server.APIError('upstream_network')
                with self.assertRaises(server.APIError):
                    server.ZoneService(cache, fetch_factory=lambda: fail).get_zones()
            path.unlink()
            fixture.features[1]['properties'].pop('OBJECTID')
            with self.assertRaises(server.APIError):
                service.get_zones()
            self.assertEqual(list(cache.iterdir()), [])


import http.client
import threading


class HTTPTests(unittest.TestCase):
    def test_fixture_http_static_api_security_and_json_errors(self):
        server = load_server()
        self.assertTrue(hasattr(server, 'make_server'), 'loopback HTTP adapter missing')
        with tempfile.TemporaryDirectory(prefix='zone-fixture-') as directory:
            base = Path(directory).resolve()
            prototype = base / 'prototype'
            prototype.mkdir()
            (prototype / 'index.html').write_text('<h1>Fixture prototype</h1>')
            (prototype / 'app.js').write_text('/* fixture */')
            (prototype / 'nested').mkdir()
            (base / 'secret.txt').write_text('fixture secret')
            (prototype / 'leak.txt').symlink_to(base / 'secret.txt')
            (prototype / 'linked').symlink_to(base, target_is_directory=True)
            (prototype / '.hidden').write_text('fixture hidden')
            fixture = FixtureSource(server, 2)
            service = server.ZoneService(base / 'cache', fetch_factory=lambda: fixture)
            httpd = server.make_server(port=0, prototype_dir=prototype, service=service)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            def request(path, method='GET', headers=None):
                conn = http.client.HTTPConnection('127.0.0.1', httpd.server_port, timeout=5)
                conn.request(method, path, headers=headers or {})
                response = conn.getresponse()
                body = response.read()
                status, content_type = response.status, response.getheader('Content-Type', '')
                self.assertEqual(int(response.getheader('Content-Length', '0')), len(body))
                conn.close()
                return status, content_type, body
            try:
                self.assertEqual(request('/')[0], 302)
                self.assertIn(b'Fixture prototype', request('/prototype/')[2])
                self.assertEqual(request('/prototype/app.js')[0], 200)
                status, content_type, body = request('/api/zones?plan=7411000000:001&kbli=01273')
                self.assertEqual(status, 200)
                self.assertIn('application/geo+json', content_type)
                self.assertEqual(json.loads(body)['meta']['counts']['returned'], 2)
                for path in ['/private/rdtr-cache/tirawuta-01273.json', '/docs/PRD.md',
                             '/prototype/../secret.txt', '/prototype/%2e%2e/secret.txt',
                             '/prototype/%252e%252e/secret.txt', '/prototype/leak.txt',
                             '/prototype/linked/secret.txt', '/prototype/nested/',
                             '/prototype/.hidden', '/api/other', '/prototype/%00',
                             '/api/zones?plan=7411000000:001&kbli=01273&kbli=01273']:
                    with self.subTest(path=path):
                        status, content_type, body = request(path)
                        self.assertGreaterEqual(status, 400)
                        self.assertIn('application/json', content_type)
                        self.assertIn('error', json.loads(body))
                        self.assertNotIn(str(base).encode(), body)
                        self.assertNotIn(b'fixture secret', body)
                self.assertEqual(request('/api/zones?plan=7411000000:001&kbli=01273', 'POST')[0], 405)
                self.assertEqual(request('/prototype/', 'OPTIONS')[0], 405)
                self.assertEqual(request('/prototype/', headers={'Host': 'evil.example'})[0], 403)
                def failed():
                    raise server.APIError('upstream_network')
                service.get_zones = failed
                status, content_type, body = request('/api/zones?plan=7411000000:001&kbli=01273')
                self.assertEqual(status, 502)
                self.assertEqual(json.loads(body), {'error': {'code': 'upstream_network'}})
                def unexpected():
                    raise RuntimeError(str(base))
                service.get_zones = unexpected
                self.assertEqual(json.loads(request('/api/zones?plan=7411000000:001&kbli=01273')[2]),
                                 {'error': {'code': 'internal_error'}})
            finally:
                httpd.shutdown()
                thread.join(timeout=5)
                httpd.server_close()


class CLITests(unittest.TestCase):
    def test_fixture_one_shot_probe_reads_complete_http_response(self):
        server = load_server()
        self.assertTrue(hasattr(server, 'probe_live'), 'one-shot live probe missing')
        with tempfile.TemporaryDirectory(prefix='zone-fixture-') as directory:
            fixture = FixtureSource(server, 2)
            service = server.ZoneService(Path(directory).resolve() / 'cache', fetch_factory=lambda: fixture, ttl=0, max_stale=0)
            report = server.probe_live(service=service)
            self.assertEqual(report['status'], 200)
            self.assertEqual(report['source']['status'], 'live')
            self.assertEqual(report['counts']['matched'], 2)
            self.assertGreater(report['responseBytes'], 500)
            self.assertTrue(report['completeResponseVerified'])
            self.assertEqual(len(fixture.calls), 5)


if __name__ == '__main__':
    unittest.main()
