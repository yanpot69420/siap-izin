"""Portable codec unit tests. All fixtures here are explicitly SYNTHETIC."""
import copy
import hashlib
import sys
import tempfile
import unittest
from unittest.mock import patch
import io
from dataclasses import FrozenInstanceError
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import dev_server as source
import rdtr_snapshot as codec


def fixture(plan_id=source.PLAN_ID):
    """Synthetic polygon + normalized properties, not a real source response."""
    ctx = source.context_for(plan_id)
    zone = 'P-1' if ctx.filter_field == 'KODSZN' else 'P.1.001'
    feature = {'type': 'Feature', 'id': 7,
               'geometry': {'type': 'Polygon', 'coordinates': [[[120, -4], [120.001, -4],
                             [120.001, -3.999], [120, -4]]]},
               'properties': {'object_id': 7, 'zone_code': 'P-1', 'filter_value': zone,
                              'zone_name': 'Synthetic', 'zone_group': 'Synthetic',
                              'regulation': None, 'plan_id': ctx.id, 'activity_id': ctx.activity_id,
                              'activity_name': ctx.activity_name, 'permission': 'unknown',
                              'evidence_status': 'unreviewed_mapping'}}
    payload = {'type': 'FeatureCollection', 'features': [feature], 'meta': {
        'plan': {'id': ctx.id, 'name': ctx.name, 'regionId': ctx.region_id},
        'activity': {'id': ctx.activity_id, 'name': ctx.activity_name,
                     'filterField': ctx.filter_field, 'mappingReviewed': False},
        'kbli': {'code': '01273', 'version': '2025', 'scope': 'budidaya-kakao',
                 'scopeConfirmed': False, 'mappingReviewed': False},
        'filterZoneCodes': [zone], 'counts': {'matched': 1, 'returned': 1, 'excludedInvalid': 0},
        'source': {'status': 'live', 'retrievedAt': '2001-01-01T00:00:00Z',
                   'activitiesUrl': ctx.activities_url, 'metadataUrl': ctx.metadata_url,
                   'geometryQueryUrl': ctx.query_url, 'catalogUrl': ctx.catalog_url,
                   'nativeWkid': ctx.native_wkid, 'outputWkid': 4326},
        'coverage': 'loaded-plan-matching-zones-only', 'geometryPurpose': 'display',
        'limitations': source.LIMITATIONS.copy()}}
    return {'version': 2, 'contextHash': hashlib.sha256(source.encoded(ctx._asdict())).hexdigest(),
            'data': {'payload': payload, 'quarantine': []}, 'sha256': ''}


def pack(envelope):
    envelope['sha256'] = hashlib.sha256(source.encoded(envelope['data'])).hexdigest()
    return source.encoded(envelope)


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'synthetic.json'

    def read(self, envelope=None, **kwargs):
        raw = pack(envelope if envelope is not None else fixture())
        self.path.write_bytes(raw)
        return codec.read_snapshot(self.path, **kwargs)

    def test_captured_bytes_can_be_revalidated_without_reopening_a_file(self):
        self.assertTrue(hasattr(codec, 'read_snapshot_bytes'), 'captured-byte validation API missing')
        raw = pack(fixture())
        baseline = self.read()
        with patch.object(Path, 'open', side_effect=AssertionError('unexpected file reopen')):
            actual = codec.read_snapshot_bytes(raw, expected_sha256=hashlib.sha256(raw).hexdigest(),
                                               expected_plan_id=source.PLAN_ID)
        self.assertEqual(actual, baseline)
        self.assertIs(actual.raw_bytes, raw)

    def test_captured_bytes_require_immutable_bytes_and_bound_size(self):
        raw = pack(fixture())
        for mutable in (bytearray(raw), memoryview(raw), raw.decode('utf-8'), None):
            with self.subTest(kind=type(mutable).__name__), self.assertRaisesRegex(ValueError, '^invalid_snapshot_bytes$'):
                codec.read_snapshot_bytes(mutable)
        with patch.object(codec, 'MAX_SNAPSHOT_BYTES', len(raw)-1):
            with self.assertRaisesRegex(ValueError, '^snapshot_size$'):
                codec.read_snapshot_bytes(raw)
        with self.assertRaisesRegex(ValueError, '^artifact_sha256_mismatch$'):
            codec.read_snapshot_bytes(raw, expected_sha256='0'*64)

    def test_expected_tokens_are_literal_and_checked_before_open(self):
        for token in (' ' + source.PLAN_ID, source.PLAN_ID + '\n', '7411000000%3A001',
                      '7411000000:1', 7411000000001, True):
            with self.subTest(plan=token), self.assertRaises(ValueError):
                codec.read_snapshot(self.path, expected_plan_id=token)
        for token in ('A' * 64, 'a' * 63, 'a' * 64 + '\n', ' a' * 32, 1, True):
            with self.subTest(hash=token), self.assertRaises(ValueError):
                codec.read_snapshot(self.path, expected_sha256=token)
        raw = pack(fixture())
        self.path.write_bytes(raw)
        self.assertEqual(codec.read_snapshot(self.path, hashlib.sha256(raw).hexdigest(),
                                           source.PLAN_ID).raw_bytes, raw)
        with self.assertRaises(ValueError):
            codec.read_snapshot(self.path, expected_sha256='0' * 64)
        with self.assertRaises(ValueError):
            codec.read_snapshot(self.path, expected_plan_id='7402000000:003')

    def test_envelope_integrity_is_strict(self):
        baseline = fixture()
        pack(baseline)
        cases = []
        for key, value in (('sha256', '0' * 64), ('contextHash', '0' * 64),
                           ('version', 2.0), ('version', True), ('extra', 'hidden')):
            bad = copy.deepcopy(baseline)
            bad[key] = value
            cases.append(source.encoded(bad))
        bad = copy.deepcopy(baseline)
        bad['data']['payload']['features'][0]['properties']['zone_name'] = 'tampered'
        cases.append(source.encoded(bad))
        cases.extend((b'{"version":2,"version":2}', b'{"x":NaN}', b'{"x":1e999}',
                      b'[]', b'{}', b'null', b'{', b'\xff'))
        for raw in cases:
            with self.subTest(case=cases.index(raw)), self.assertRaises(ValueError):
                self.path.write_bytes(raw)
                codec.read_snapshot(self.path)

    def test_strict_fields_reject_mismatch_duplicates_and_permission_promotion(self):
        def mutate(path, value):
            bad = fixture()
            target = bad['data']['payload']
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            return bad
        cases = [
            (('meta', 'plan', 'name'), 'other plan'),
            (('meta', 'plan', 'regionId'), '7402000000'),
            (('meta', 'activity', 'id'), 'other'),
            (('meta', 'activity', 'mappingReviewed'), 0),
            (('meta', 'kbli', 'scopeConfirmed'), 0),
            (('meta', 'source', 'outputWkid'), 4326.0),
            (('meta', 'source', 'retrievedAt'), 'not-a-dateZ'),
            (('meta', 'counts', 'returned'), 0),
            (('meta', 'counts', 'matched'), True),
            (('features', 0, 'id'), True),
            (('features', 0, 'properties', 'object_id'), '7'),
            (('features', 0, 'properties', 'object_id'), 8),
            (('features', 0, 'properties', 'permission'), 'allowed'),
            (('features', 0, 'properties', 'evidence_status'), 'reviewed'),
            (('features', 0, 'properties', 'filter_value'), 'UNKNOWN'),
            (('features', 0, 'properties', 'activity_id'), 'other'),
            (('features', 0, 'geometry', 'type'), 'Point'),
        ]
        for path, value in cases:
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.read(mutate(path, value))
        bad = fixture()
        bad['data']['payload']['features'] *= 2
        bad['data']['payload']['meta']['counts'].update(matched=2, returned=2)
        with self.assertRaises(ValueError):
            self.read(bad)
        bad = fixture()
        bad['data']['quarantine'] = [{'object_id': True, 'reason': 'invalid',
                                     'feature': {'type': 'Feature', 'id': 2,
                                                 'properties': {'OBJECTID': 1, 'KODSZN': 'P-1'},
                                                 'geometry': None}}]
        bad['data']['payload']['meta']['counts'].update(matched=2, excludedInvalid=1)
        with self.assertRaises(ValueError):
            self.read(bad)

    def test_archive_has_no_ttl_or_wall_clock_validation(self):
        archived = fixture()
        archived['data']['payload']['meta']['source']['retrievedAt'] = '2999-01-01T00:00:00Z'
        self.assertEqual(self.read(archived).source_observed_at, '2999-01-01T00:00:00Z')
        archived['data']['payload']['meta']['source']['status'] = 'cached_snapshot'
        self.assertEqual(self.read(archived).source_metadata['status'], 'local_dataset')

    def test_fingerprint_excludes_only_observation_transport_not_source_content(self):
        baseline = fixture()
        fingerprint = self.read(baseline).content_fingerprint
        observed = copy.deepcopy(baseline)
        observed['data']['payload']['meta']['source'].update(
            retrievedAt='2002-02-02T01:02:03Z', checkedAt='2003-03-03T00:00:00Z',
            status='cached_snapshot', cacheReason='archive', transfers=[{'status': 200}], jobId='new')
        observed['data']['payload']['meta']['jobId'] = 'new-run'
        changed = self.read(observed)
        self.assertEqual(changed.content_fingerprint, fingerprint)
        self.assertNotEqual(changed.artifact_sha256, self.read(baseline).artifact_sha256)
        for kind in ('coordinate', 'property', 'rules', 'source_context', 'property_timestamp'):
            actual = copy.deepcopy(baseline)
            payload = actual['data']['payload']
            if kind == 'coordinate':
                payload['features'][0]['geometry']['coordinates'][0][1][0] = 120.002
            elif kind == 'property':
                payload['features'][0]['properties']['zone_name'] = 'Changed'
            elif kind == 'rules':
                payload['meta']['rules'] = {'rawCategory': 'unparsed', 'condition': 'changed'}
            elif kind == 'source_context':
                payload['meta']['source']['sourceRevision'] = 'changed'
            else:
                payload['features'][0]['properties']['retrievedAt'] = 'meaningful attribute'
            with self.subTest(kind=kind):
                self.assertNotEqual(self.read(actual).content_fingerprint, fingerprint)
        self.assertNotEqual(self.read(fixture('7402000000:003')).content_fingerprint, fingerprint)

    def test_leading_zero_literals_and_dotted_filter_are_not_coerced(self):
        tirawuta = self.read()
        self.assertEqual(tirawuta.activity['id'], '041')
        self.assertEqual(tirawuta.kbli['code'], '01273')
        langara = self.read(fixture('7412000000:001'))
        self.assertEqual(langara.layer_context['filter_field'], 'KODUNK')
        self.assertEqual(langara.filter_zone_codes, ['P.1.001'])
        self.assertEqual(langara.features[0]['properties']['filter_value'], 'P.1.001')

    def test_all_expected_formats_checked_before_catalog_lookup(self):
        with patch.object(source, 'context_for', side_effect=AssertionError('lookup too early')):
            with self.assertRaises(ValueError):
                codec.read_snapshot(self.path, expected_plan_id=source.PLAN_ID, expected_sha256='bad')

    def test_single_bounded_capture_drives_all_values_and_hashes(self):
        raw = pack(fixture())
        class Capture(io.BytesIO):
            reads = []
            def read(self, size=-1):
                self.reads.append(size)
                return super().read(size)
        stream = Capture(raw)
        with patch.object(Path, 'open', return_value=stream) as opened:
            result = codec.read_snapshot(self.path)
        opened.assert_called_once_with('rb')
        self.assertEqual(stream.reads, [128 * 1024 * 1024 + 1])
        self.assertEqual(result.artifact_sha256, hashlib.sha256(raw).hexdigest())
        self.assertEqual(result.raw_bytes, raw)
        self.path.write_bytes(raw)
        with patch.object(codec, 'MAX_SNAPSHOT_BYTES', len(raw) - 1), self.assertRaises(ValueError):
            codec.read_snapshot(self.path)

    def test_quarantine_is_preserved_and_included_in_fingerprint(self):
        envelope = fixture()
        q = {'object_id': 8, 'reason': 'invalid_geometry', 'feature': {'type': 'Feature', 'id': 8,
             'properties': {'OBJECTID': 8, 'KODSZN': 'P-1', 'NAMSZN': 'Synthetic',
                            'NAMZON': 'Synthetic', 'NOTHPR': None}, 'geometry': None}}
        envelope['data']['quarantine'] = [q]
        envelope['data']['payload']['meta']['counts'].update(matched=2, excludedInvalid=1)
        result = self.read(envelope)
        self.assertEqual(result.quarantine, [q])
        q['reason'] = 'other invalid reason'
        self.assertNotEqual(self.read(envelope).content_fingerprint, result.content_fingerprint)
        for oid in (True, '8', 7, -1):
            bad = copy.deepcopy(envelope)
            bad['data']['quarantine'][0]['object_id'] = oid
            with self.subTest(oid=oid), self.assertRaises(ValueError):
                self.read(bad)
        bad = copy.deepcopy(envelope)
        bad['data']['quarantine'][0]['feature']['properties']['OBJECTID'] = 9
        with self.assertRaises(ValueError):
            self.read(bad)
        bad = fixture()
        bad['data']['payload']['features'][0]['properties']['OBJECTID'] = True
        with self.assertRaises(ValueError):
            self.read(bad)

    def test_geometry_tree_is_not_copied_or_repaired(self):
        envelope = fixture()
        raw = pack(envelope)
        self.path.write_bytes(raw)
        with patch.object(source, 'strict_json', return_value=envelope):
            result = codec.read_snapshot(self.path)
        original = envelope['data']['payload']['features']
        self.assertIs(result.features, original)
        self.assertIs(result.features[0]['geometry'], original[0]['geometry'])
        self.assertEqual(result.features[0]['geometry']['type'], 'Polygon')
        multi = fixture()
        geometry = multi['data']['payload']['features'][0]['geometry']
        geometry['type'] = 'MultiPolygon'
        geometry['coordinates'] = [geometry['coordinates']]
        self.assertEqual(self.read(multi).features[0]['geometry'], geometry)

    def test_archived_snapshot_api_preserves_geometry_time_and_scopes(self):
        self.assertIsNotNone(codec, 'standalone snapshot codec not implemented')
        envelope = fixture()
        result = self.read(envelope)
        self.assertIsInstance(result, codec.NormalizedSnapshot)
        self.assertEqual(result.plan_id, source.PLAN_ID)
        self.assertEqual(result.features, envelope['data']['payload']['features'])
        self.assertEqual(result.source_observed_at, '2001-01-01T00:00:00Z')
        self.assertEqual(result.source_metadata['status'], 'local_dataset')
        self.assertEqual(result.source_metadata['originalSourceStatus'], 'live')
        self.assertEqual(result.geometry_scope, 'filtered_subset')
        self.assertEqual(result.rules_scope, 'filter_membership_only')
        self.assertEqual(result.raw_bytes, self.path.read_bytes())
        self.assertEqual(result.artifact_sha256, hashlib.sha256(result.raw_bytes).hexdigest())
        self.assertRegex(result.content_fingerprint, r'^[a-f0-9]{64}$')
        with self.assertRaises(FrozenInstanceError):
            result.plan_id = 'changed'


if __name__ == '__main__':
    unittest.main()
