"""Offline synthetic replay guards; no official source/cache files are changed."""
import copy
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_zone_server import FixtureSource

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('map_replay', ROOT / 'tests/map-performance-replay.py')
assert SPEC is not None and SPEC.loader is not None
replay = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(replay)


class ReplayTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='replay-fixture-')
        self.addCleanup(self.directory.cleanup)
        self.cache = Path(self.directory.name).resolve() / 'cache'
        self.cache.mkdir()
        self.server = replay.server
        self.original = self.server.ZoneService(self.cache)
        self.path = self.original.cache_path
        self.payload, self.quarantine = self.server.load_live(FixtureSource(self.server, 1))
        self.payload['meta']['source']['retrievedAt'] = '2020-01-01T00:00:00Z'
        network = patch.object(self.server, 'LiveTransport', side_effect=AssertionError('network forbidden'))
        network.start()
        self.addCleanup(network.stop)

    def envelope(self, payload=None):
        data = {'payload': copy.deepcopy(self.payload if payload is None else payload),
                'quarantine': copy.deepcopy(self.quarantine)}
        return {'version': 2, 'contextHash': self.original.context_hash,
                'sha256': hashlib.sha256(self.server.encoded(data)).hexdigest(), 'data': data}

    def test_atomic_refresh_after_validation_keeps_manifest_bound_to_replayed_bytes(self):
        raw_a = self.server.encoded(self.envelope()) + b'\n'
        payload_b = copy.deepcopy(self.payload)
        payload_b['features'][0]['properties']['regulation'] = 'Distinct synthetic replacement B'
        raw_b = self.server.encoded(self.envelope(payload_b)) + b'\n\n'
        self.path.write_bytes(raw_a)
        replacement = self.cache / 'replacement.json'
        replacement.write_bytes(raw_b)
        validate = self.server.validate_snapshot

        def refresh_after_validation(*args, **kwargs):
            age = validate(*args, **kwargs)
            os.replace(replacement, self.path)
            return age

        with patch.object(self.server, 'validate_snapshot', side_effect=refresh_after_validation) as checked:
            service = replay.ReplayService(self.server.PLAN_ID, self.cache)
        self.assertEqual(checked.call_count, 1)
        self.assertEqual(self.path.read_bytes(), raw_b, 'atomic refresh must actually happen')
        self.assertEqual(service.payload['features'], self.payload['features'])
        self.assertEqual(service.record['cacheFileSha256'], hashlib.sha256(raw_a).hexdigest())
        self.assertEqual(service.record['cacheFileBytes'], len(raw_a))
    def test_read_only_capture_preserves_source_time_and_explicit_replay_markers(self):
        raw = self.server.encoded(self.envelope()) + b'\n\n'
        self.path.write_bytes(raw)
        before = self.path.stat()
        with patch.object(self.server.ZoneService, '_write_cache', side_effect=AssertionError('write forbidden')):
            service = replay.ReplayService(self.server.PLAN_ID, self.cache)
        self.assertEqual(self.path.read_bytes(), raw)
        self.assertEqual(self.path.stat().st_mtime_ns, before.st_mtime_ns)
        self.assertEqual(sorted(p.name for p in self.cache.iterdir()), [self.path.name])
        expected = copy.deepcopy(self.payload)
        expected['meta']['source'].update(status='cached_snapshot', cacheReason='benchmark_replay')
        expected['meta']['benchmarkReplay'] = True
        self.assertEqual(service.get_zones(), expected)
        self.assertTrue(service.benchmark_replay)
        self.assertEqual(service.record['retrievedAt'], '2020-01-01T00:00:00Z')
        self.assertEqual(service.record['originalSourceStatus'], 'live')
        self.assertEqual(service.record['cacheFileBytes'], len(raw))
        self.assertEqual(service.record['cacheFileSha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(service.record['httpBodyBytes'], len(self.server.encoded(expected)))
        self.assertIn(b'benchmarkReplayBanner', replay.BANNER)
        self.assertIn(b'BENCHMARK REPLAY / TEST ONLY', replay.BANNER)

    def test_rejects_invalid_envelope_version_context_checksum_and_missing_fields(self):
        mutations = {
            'version': lambda e: e.update(version=1),
            'context': lambda e: e.update(contextHash='0' * 64),
            'checksum': lambda e: e.update(sha256='0' * 64),
            'missing_version': lambda e: e.pop('version'),
            'missing_context': lambda e: e.pop('contextHash'),
            'missing_checksum': lambda e: e.pop('sha256'),
            'missing_data': lambda e: e.pop('data'),
            'non_object_data': lambda e: e.update(data=[]),
        }
        for name, mutate in mutations.items():
            with self.subTest(case=name):
                envelope = self.envelope()
                mutate(envelope)
                raw = self.server.encoded(envelope)
                self.path.write_bytes(raw)
                with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
                    replay.ReplayService(self.server.PLAN_ID, self.cache)
                self.assertEqual(self.path.read_bytes(), raw)

    def test_strict_json_rejects_duplicate_keys_nonfinite_invalid_utf8_and_malformed_input(self):
        raw = self.server.encoded(self.envelope())
        for invalid in (b'{"version":2,' + raw[1:], raw[:-1] + b',"extra":NaN}',
                        b'\xff', b'{', b'[]', b'null'):
            with self.subTest(raw=invalid[:40]):
                self.path.write_bytes(invalid)
                with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
                    replay.ReplayService(self.server.PLAN_ID, self.cache)

    def test_rechecks_payload_protocol_and_topology_even_with_valid_envelope_checksum(self):
        mutations = {
            'cached_status': lambda p: p['meta']['source'].update(status='cached_snapshot'),
            'source_url': lambda p: p['meta']['source'].update(metadataUrl='https://invalid.example/'),
            'future_time': lambda p: p['meta']['source'].update(retrievedAt='9999-01-01T00:00:00Z'),
            'activity': lambda p: p['meta']['activity'].update(id='invalid'),
            'plan': lambda p: p['meta']['plan'].update(id='invalid'),
            'kbli_version': lambda p: p['meta']['kbli'].update(version='2020'),
            'counts': lambda p: p['meta']['counts'].update(returned=2),
            'permission': lambda p: p['features'][0]['properties'].update(permission='allowed'),
            'topology': lambda p: p['features'][0]['geometry'].update(coordinates=[
                [[121, -4], [122, -3], [122, -4], [121, -3], [121, -4]]]),
        }
        for name, mutate in mutations.items():
            with self.subTest(case=name):
                payload = copy.deepcopy(self.payload)
                mutate(payload)
                self.path.write_bytes(self.server.encoded(self.envelope(payload)))
                with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
                    replay.ReplayService(self.server.PLAN_ID, self.cache)

    def test_rejects_invalid_quarantine_with_valid_envelope_checksum(self):
        envelope = self.envelope()
        envelope['data']['quarantine'] = [{'object_id': 99, 'reason': 'invalid fixture'}]
        envelope['sha256'] = hashlib.sha256(self.server.encoded(envelope['data'])).hexdigest()
        self.path.write_bytes(self.server.encoded(envelope))
        with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
            replay.ReplayService(self.server.PLAN_ID, self.cache)

    def test_size_limit_checks_both_descriptor_size_and_bounded_captured_bytes(self):
        from types import SimpleNamespace
        raw = self.server.encoded(self.envelope())
        self.path.write_bytes(raw)
        with patch.object(self.server, 'MAX_SNAPSHOT_BYTES', len(raw) - 1):
            with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
                replay.ReplayService(self.server.PLAN_ID, self.cache)
            # A growing file can exceed its descriptor's initial size: the bounded
            # read must still reject its captured MAX+1 bytes, not just trust fstat.
            with patch.object(self.server.os, 'fstat', return_value=SimpleNamespace(st_size=0)):
                with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
                    replay.ReplayService(self.server.PLAN_ID, self.cache)
        with patch.object(self.server, 'MAX_SNAPSHOT_BYTES', len(raw)):
            self.assertEqual(replay.ReplayService(self.server.PLAN_ID, self.cache).record['cacheFileBytes'], len(raw))

    def test_rejects_symlink_file_cache_directory_and_ancestor(self):
        raw = self.server.encoded(self.envelope())
        target = self.cache / 'target.json'
        target.write_bytes(raw)
        self.path.symlink_to(target)
        with self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
            replay.ReplayService(self.server.PLAN_ID, self.cache)
        self.path.unlink()
        self.path.write_bytes(raw)
        alias = self.cache.parent / 'alias'
        alias.symlink_to(self.cache, target_is_directory=True)
        parent_alias = self.cache.parent / 'parent-alias'
        parent_alias.symlink_to(self.cache.parent, target_is_directory=True)
        for directory in (alias, parent_alias / self.cache.name):
            with self.subTest(directory=directory), self.assertRaisesRegex(RuntimeError, 'Original snapshot rejected:'):
                replay.ReplayService(self.server.PLAN_ID, directory)
        self.assertEqual(self.path.read_bytes(), raw)


if __name__ == '__main__':
    unittest.main()
