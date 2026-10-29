"""Strict offline HTTP vertical slices; ephemeral port, no official requests."""
import copy
import http.client
import json
import threading
import unittest

from test_display_geometry import FixtureService
from test_zone_server import load_server


class DisplayHTTPTests(unittest.TestCase):
    def setUp(self):
        self.server = load_server()
        self.source = FixtureService()
        self.httpd = self.server.make_server(port=0, service=self.source)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = 'plan=' + self.server.PLAN_ID + '&kbli=01273'

    def tearDown(self):
        self.httpd.shutdown()
        self.thread.join(5)
        self.httpd.server_close()

    def request(self, path, method='GET', headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=10)
        conn.request(method, path, headers=headers or {})
        response = conn.getresponse()
        body = response.read()
        result = (response.status, dict(response.getheaders()), json.loads(body) if body else None)
        if method != 'HEAD':
            self.assertEqual(int(response.getheader('Content-Length')), len(body))
        conn.close()
        return result

    def test_display_query_rejects_nonliteral_duplicate_unknown_and_unsafe_bbox_before_source(self):
        valid = self.base + '&level=overview'
        bad = ['', self.base, valid + '&level=detail', valid + '&x=1', valid + '&bbox=1,2,3,4&bbox=1,2,3,4',
               valid.replace(':', '%3A'), valid.replace('01273', '%30%31%32%37%33'), valid + '&',
               valid.replace('overview', '100'), valid.replace('01273', '1273')]
        for bbox in ['NaN,0,1,1', '-Inf,0,1,1', '1e1,0,11,1', '1,1,1,2', '2,1,1,2',
                     '0,0,181,1', '0,-91,1,0', '1,2,3', '0%2C0%2C1%2C1', '+0,0,1,1',
                     '%200,0,1,1', '.1,0,1,1', '0,0,1,2,3', '0.' + '1' * 100 + ',0,1,1']:
            bad.append(valid + '&bbox=' + bbox)
        for query in bad:
            with self.subTest(query=query):
                self.assertEqual(self.request('/api/display?' + query)[0], 400)
        self.assertEqual(self.source.calls, 0)
        self.assertEqual(self.request('/api/display?' + valid + '&bbox=-180,-90,180,90')[0], 200)

    def test_detail_query_uses_safe_literal_oid_and_lowercase_sha256(self):
        valid = self.base + '&objectId=1&snapshot=' + 'a' * 64
        bad = [valid + '&objectId=2', valid + '&snapshot=' + 'a' * 64, valid + '&level=detail',
               valid.replace('objectId=1', 'objectId=-1'), valid.replace('objectId=1', 'objectId=1.0'),
               valid.replace('objectId=1', 'objectId=01'), valid.replace('objectId=1', 'objectId=9007199254740992'),
               valid.replace('objectId=1', 'objectId=%31'), valid.replace('snapshot=' + 'a' * 64, 'snapshot=' + 'A' * 64),
               valid[:-1], valid.replace('objectId', 'objectid')]
        for query in bad:
            with self.subTest(query=query):
                self.assertEqual(self.request('/api/feature-detail?' + query)[0], 400)
        self.assertEqual(self.source.calls, 0)
        self.assertEqual(self.request('/api/feature-detail?' + valid)[0], 409)

    def test_http_final_age_checkpoint_includes_json_serialization(self):
        from datetime import datetime
        from unittest.mock import patch
        from test_display_geometry import Clock
        timestamp = datetime.fromisoformat(self.source.payload['meta']['source']['retrievedAt'].replace('Z', '+00:00')).timestamp()
        display = self.httpd.display_services[self.server.PLAN_ID]
        clock = Clock(timestamp + 299)
        display.clock = clock
        encode = self.server.encoded
        def slow_encode(payload):
            body = encode(payload)
            if 'meta' in payload:
                clock.value = timestamp + 301
            return body
        with patch.object(self.server, 'encoded', side_effect=slow_encode):
            result = self.request('/api/display?' + self.base + '&level=overview')
        self.assertEqual(result[::2], (503, {'error': {'code': 'source_snapshot_expired'}}))

    def test_host_origin_get_only_and_missing_activity_apply_to_new_routes(self):
        no_activity = next(pid for pid, ctx in self.server.PLANS.items() if ctx.activity_id is None)
        for endpoint, tail in [('display', '&level=overview'), ('feature-detail', '&objectId=1&snapshot=' + 'a' * 64)]:
            path = '/api/' + endpoint + '?' + self.base + tail
            self.assertEqual(self.request(path, headers={'Host': 'evil.example'})[0], 403)
            self.assertEqual(self.request(path, headers={'Origin': 'https://evil.example'})[0], 403)
            for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'):
                with self.subTest(endpoint=endpoint, method=method):
                    self.assertEqual(self.request(path, method)[0], 405)
            self.assertEqual(self.request(path.replace(self.server.PLAN_ID, no_activity))[0], 422)
        self.assertEqual(self.source.calls, 0)

    def test_replay_bypass_requires_explicit_trusted_adapter_injection_not_payload_flag(self):
        from datetime import datetime
        from test_display_geometry import Clock
        self.source.payload['meta']['benchmarkReplay'] = True
        self.source.payload['meta']['source'].update(status='cached_snapshot', cacheReason='benchmark_replay')
        timestamp = datetime.fromisoformat(self.source.payload['meta']['source']['retrievedAt'].replace('Z', '+00:00')).timestamp()
        self.httpd.display_services[self.server.PLAN_ID].clock = Clock(timestamp + 7200)
        path = '/api/display?' + self.base + '&level=overview'
        self.assertEqual(self.request(path)[0], 503)
        self.source.benchmark_replay = True  # Trusted Python adapter, not a query or payload option.
        self.assertEqual(self.request(path)[0], 503, 'opt-in must be captured during server injection')
        replay = self.server.make_server(port=0, service=self.source)
        try:
            display = replay.display_services[self.server.PLAN_ID]
            display.clock = Clock(timestamp + 7200)
            result = display.get_display('overview')
            self.assertEqual(result['meta']['source']['retrievedAt'], self.source.payload['meta']['source']['retrievedAt'])
            self.assertTrue(result['meta']['benchmarkReplay'])
            self.assertEqual(result['meta']['source']['status'], 'cached_snapshot')
            self.source.payload['meta']['source']['status'] = 'live'
            with self.assertRaises(self.server.APIError):
                display.get_display('overview')
        finally:
            replay.server_close()

    def test_display_detail_and_legacy_original_are_separate_contracts(self):
        original = copy.deepcopy(self.source.payload)
        status, headers, result = self.request('/api/display?' + self.base + '&level=overview')
        self.assertEqual(status, 200)
        self.assertIn('application/geo+json', headers['Content-Type'])
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(result['meta']['display']['toleranceMeters'], 100)
        self.assertEqual(set(self.httpd.display_services), {self.server.PLAN_ID})
        snapshot = result['meta']['snapshotId']
        detail_path = '/api/feature-detail?' + self.base + '&objectId=1&snapshot=' + snapshot
        status, headers, detail = self.request(detail_path)
        self.assertEqual(status, 200)
        self.assertIn('application/json', headers['Content-Type'])
        self.assertEqual(detail['properties'], original['features'][0]['properties'])
        self.assertNotIn('geometry', detail)
        self.assertEqual(self.request(detail_path.replace('objectId=1', 'objectId=999'))[0], 404)
        self.source.payload['features'][0]['properties']['regulation'] = 'source changed'
        self.assertEqual(self.request(detail_path)[::2], (409, {'error': {'code': 'snapshot_changed'}}))
        self.assertEqual(self.request('/api/zones?' + self.base)[2], self.source.payload)
        self.assertEqual(self.request('/api/display?' + self.base + '&level=detail&bbox=122,-5,123,-4')[2]['features'], [])


if __name__ == '__main__':
    unittest.main()
