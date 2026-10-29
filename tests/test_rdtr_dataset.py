"""Synthetic-only local preparation/release integration, isolated rollback SQL."""
import copy
import hashlib
import importlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'tools'), str(ROOT / 'tests'), str(ROOT)]
import psycopg
from psycopg.types.json import Jsonb
import dev_server as source
import display_geometry
from rdtr_connection import load_dsn
from rdtr_snapshot import read_snapshot_bytes
from rdtr_store import import_snapshot
from rdtrdb.migrations import migrate
from test_rdtr_snapshot import fixture, pack


class DatasetTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg.connect(load_dsn(ROOT / 'private/rdtr-db/connection.json', 'test'))
        self.addCleanup(self.conn.close)
        self.addCleanup(self.conn.rollback)
        if self.conn.execute('SELECT current_database()').fetchone()[0] != 'siap_izin_test':
            raise RuntimeError('isolated_test_database_required')
        self.conn.execute('SELECT pg_advisory_lock(%s)', (0x5244545254455354,))
        self.conn.execute("SET LOCAL statement_timeout='30s'")
        self.conn.execute("SET LOCAL lock_timeout='5s'")
        self.conn.execute('DROP SCHEMA IF EXISTS rdtr CASCADE')
        migrate(self.conn)
        self.temp = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.temp.cleanup)
        self.blobs = Path(self.temp.name) / 'blobs'
        self.raw = fixture()
        self.version = self.stage(self.raw)

    def stage(self, raw):
        snapshot = read_snapshot_bytes(pack(raw))
        result = import_snapshot(self.conn, snapshot, self.blobs, batch_key='synthetic-only')
        return result['plan_version_id']

    def subject(self):
        self.assertTrue((ROOT / 'tools/rdtr_dataset.py').exists(), 'local dataset preparation missing')
        return importlib.import_module('rdtr_dataset')

    def model(self, version=None):
        return self.conn.execute('SELECT layer_metadata FROM rdtr.plan_version WHERE id=%s', (version or self.version,)).fetchone()[0]['localReadModel']

    def test_hashes_are_invocation_local_and_once_per_invariant(self):
        module = self.subject()
        with patch.object(module, '_hash', wraps=module._hash) as hashes:
            module.prepare_version(self.conn, self.version, self.blobs)
        prepare_models = sum(isinstance(c.args[0], dict) and 'algorithmVersion' in c.args[0]
                             for c in hashes.call_args_list)
        version = module._version(self.conn, self.version)
        original = bytes(self.conn.execute('SELECT ST_AsEWKB(geom_original_4326) FROM rdtr.zone_feature').fetchone()[0])
        with patch.object(module, '_hash', wraps=module._hash) as hashes, patch.object(module.hashlib, 'sha256', wraps=hashlib.sha256) as digests:
            module._validate_prepared(self.conn, version)
        validate_models = sum(isinstance(c.args[0], dict) and 'algorithmVersion' in c.args[0]
                              for c in hashes.call_args_list)
        properties = sum(isinstance(c.args[0], dict) and 'zone_code' in c.args[0]
                         for c in hashes.call_args_list)
        original_digests = sum(c.args[0] == original for c in digests.call_args_list)
        self.assertEqual((prepare_models, validate_models, properties), (1, 1, 1))
        self.assertLessEqual(original_digests, 1)
        # A second invocation must hash again, never trust a cross-request cache.
        with patch.object(module, '_hash', wraps=module._hash) as hashes:
            module._validate_prepared(self.conn, version)
        self.assertEqual(sum(isinstance(c.args[0], dict) and 'zone_code' in c.args[0]
                             for c in hashes.call_args_list), 1)

    def test_digest_projection_preserves_sql_hashes_and_avoids_binary_validation_results(self):
        wkts = ['POLYGON((120 -4,120.001 -4,120.001 -3.999,120 -4))',
                'MULTIPOLYGON(((120 -4,120.001 -4,120.001 -3.999,120 -4)))',
                'POLYGON EMPTY', 'MULTIPOLYGON EMPTY']
        for wkt in wkts:
            binary, digest, srid, points = self.conn.execute('''SELECT ST_AsEWKB(g),
                encode(sha256(ST_AsEWKB(g)),'hex'),ST_SRID(g),ST_NPoints(g)
                FROM (SELECT ST_GeomFromText(%s,4326) g) s''', (wkt,)).fetchone()
            self.assertEqual(digest, hashlib.sha256(bytes(binary)).hexdigest())
            self.assertEqual(srid, 4326)
            self.assertEqual(points, 0 if 'EMPTY' in wkt else 4)
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        binaries = []
        digests = []
        conn = self.conn
        class Probe:
            def execute(_, sql, params=None):
                cursor = conn.execute(sql, params)
                if ('FROM rdtr.zone_feature WHERE plan_version_id' in sql and 'source_properties' in sql or
                        'FROM rdtr.zone_display WHERE plan_version_id' in sql):
                    rows = cursor.fetchall()
                    for row in rows:
                        binaries.extend(len(v) for v in row if isinstance(v, (bytes, memoryview)))
                        digests.extend(v for v in row if isinstance(v, str) and len(v) == 64)
                    return type('Rows', (), {'fetchall': lambda _: rows})()
                return cursor
        module._validate_prepared(Probe(), module._version(conn, self.version))
        self.assertEqual(sum(binaries), 0, 'digest-only validation must not transfer EWKB')
        self.assertGreaterEqual(len(digests), 4)
        rows = conn.execute('''SELECT qc_result,ST_AsEWKB(geom_display_4326),ST_NPoints(geom_display_4326)
            FROM rdtr.zone_display ORDER BY level''').fetchall()
        self.assertEqual(len(rows), 3)
        for qc, binary, points in rows:
            self.assertEqual(qc['displayEWKBHash'], hashlib.sha256(bytes(binary)).hexdigest())
            self.assertEqual(points, 4)

    def test_prepare_builds_three_batch_levels_retains_source_and_old_date(self):
        before = self.conn.execute('SELECT ST_AsEWKB(geom_original_4326),geometry_hash,source_properties FROM rdtr.zone_feature').fetchall()
        with patch.object(display_geometry.DisplayService, '_check_age', side_effect=AssertionError('TTL forbidden')), patch.object(display_geometry.DisplayService, 'get_display', side_effect=AssertionError('HTTP path forbidden')):
            result = self.subject().prepare_version(self.conn, self.version, self.blobs)
        self.assertEqual(result['display_rows'], 3)
        self.assertFalse(result['reused'])
        self.assertEqual(self.conn.execute('SELECT ST_AsEWKB(geom_original_4326),geometry_hash,source_properties FROM rdtr.zone_feature').fetchall(), before)
        model = self.model()
        self.assertEqual(set(model), {'schemaVersion', 'algorithmVersion', 'meta', 'sourceBounds', 'levels'})
        self.assertEqual(set(model['levels']), {'overview', 'regional', 'detail'})
        self.assertEqual(model['meta']['source']['retrievedAt'], '2001-01-01T00:00:00Z')
        self.assertEqual(model['meta']['source']['status'], 'local_dataset')
        self.assertNotIn('catalogUrl', model['meta']['source'])
        self.assertFalse(model['meta']['activity']['mappingReviewed'])
        self.assertEqual(self.conn.execute('SELECT published_at FROM rdtr.plan_version').fetchone(), (None,))

    def selections(self, version=None):
        version = version or self.version
        mapping = self.conn.execute('SELECT id FROM rdtr.kbli_activity_mapping WHERE plan_version_id=%s ORDER BY revision DESC', (version,)).fetchone()[0]
        return [{'plan_version_id': version, 'mapping_id': str(mapping)}]

    def test_publish_seals_explicit_partial_release_without_review_or_activation(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        kbli = self.conn.execute('SELECT description,source_reference,scope FROM rdtr.kbli_entry').fetchall()
        self.assertTrue(hasattr(module, 'publish_release'), 'release publication missing')
        receipt = module.publish_release(self.conn, self.selections(), channel='synthetic', activate=False, actor='synthetic-operator')
        release = self.conn.execute('SELECT manifest_hash,status,partial_release,manifest FROM rdtr.dataset_release').fetchone()
        self.assertEqual(release[0], hashlib.sha256(source.encoded(release[3])).hexdigest())
        self.assertEqual(receipt['release_hash'], release[0])
        self.assertEqual(release[1:3], ('published', True))
        self.assertEqual(release[3]['plans'][0]['mappingRevision'], 1)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.active_release').fetchone()[0], 0)
        self.assertIsNotNone(self.conn.execute('SELECT published_at FROM rdtr.plan_version').fetchone()[0])
        self.assertEqual(self.conn.execute('SELECT review_state,reviewer,reviewed_at FROM rdtr.kbli_activity_mapping').fetchone(), ('unreviewed', None, None))
        self.assertEqual(self.conn.execute('SELECT description,source_reference,scope FROM rdtr.kbli_entry').fetchall(), kbli)
        self.assertEqual(self.conn.execute('SELECT permission_status,review_state FROM rdtr.activity_zone_rule').fetchone(), ('unknown', 'unreviewed'))

    def test_publication_rejects_incomplete_or_tampered_preparation_atomically(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        mutations = [
            'DELETE FROM rdtr.zone_display WHERE level=2',
            "UPDATE rdtr.zone_display SET qc_state='unknown' WHERE level=1",
            "UPDATE rdtr.zone_display SET source_geometry_hash=repeat('0',64) WHERE level=0",
            'UPDATE rdtr.zone_display SET geom_display_4326=ST_Translate(geom_display_4326,0.001,0) WHERE level=0',
            'UPDATE rdtr.zone_feature SET geom_original_4326=ST_Translate(geom_original_4326,0.001,0)',
            "UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{localReadModel,meta,source,retrievedAt}','\"2026-01-01T00:00:00Z\"')",
            'UPDATE rdtr.plan_version SET valid_feature_count=2',
            "UPDATE rdtr.plan_version SET content_fingerprint=repeat('0',64)",
            'UPDATE rdtr.zone_feature SET source_object_id=9',
            "DELETE FROM rdtr.zone_match_key",
            "DELETE FROM rdtr.rule_target",
            "UPDATE rdtr.plan_version SET source_time='2026-01-01T00:00:00Z'",
        ]
        mutations += ["UPDATE rdtr.zone_display SET qc_result=jsonb_set(qc_result,'{" + key + "}',to_jsonb(repeat('0',64))) WHERE level=" + str(level)
                      for level in range(3)
                      for key in ('modelHash', 'contentFingerprint', 'originalEWKBHash', 'displayEWKBHash')]
        for sql in mutations:
            with self.subTest(sql=sql), self.conn.transaction(force_rollback=True):
                self.conn.execute(sql)
                with self.assertRaisesRegex(ValueError, 'preparation_invalid'):
                    module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
                self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.dataset_release').fetchone()[0], 0)
                self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.active_release').fetchone()[0], 0)
                self.assertEqual(self.conn.execute('SELECT published_at FROM rdtr.plan_version').fetchone(), (None,))

    def publication_state(self):
        return {table: self.conn.execute('SELECT to_jsonb(t) FROM rdtr.' + table + ' t ORDER BY to_jsonb(t)::text').fetchall()
                for table in ('plan_version', 'kbli_activity_mapping', 'dataset_release',
                              'release_plan_version', 'release_mapping', 'active_release')}

    def test_publication_rejects_nonstring_subzone_before_sealing(self):
        module = self.subject()
        changed = fixture()
        changed['data']['payload']['features'][0]['properties']['subzone_name'] = 123
        version = self.stage(changed)
        module.prepare_version(self.conn, version, self.blobs)
        module.prepare_version(self.conn, self.version, self.blobs)
        module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
        for activate in (False, True):
            with self.subTest(activate=activate):
                before = self.publication_state()
                with self.assertRaisesRegex(ValueError, '^preparation_invalid$'):
                    module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=activate, actor='synthetic')
                self.assertEqual(self.publication_state(), before)

    def test_publication_rejects_overlong_zone_labels_before_sealing(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
        for key in ('zone_name', 'zone_group'):
            for activate in (False, True):
                with self.subTest(key=key, activate=activate), self.conn.transaction(force_rollback=True):
                    changed = fixture()
                    changed['data']['payload']['features'][0]['properties'][key] = 'x' * 4001
                    version = self.stage(changed)
                    module.prepare_version(self.conn, version, self.blobs)
                    before = self.publication_state()
                    with self.assertRaisesRegex(ValueError, '^preparation_invalid$'):
                        module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=activate, actor='synthetic')
                    self.assertEqual(self.publication_state(), before)

    def test_unsupported_publication_states_rejected_without_any_writes(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        # Keep an existing pointer: failures must not switch or reseal anything.
        other = self.stage(fixture('7412000000:001'))
        module.prepare_version(self.conn, other, self.blobs)
        module.publish_release(self.conn, self.selections(other), channel='synthetic', activate=True, actor='synthetic')
        for mutation in (
            "UPDATE rdtr.kbli_activity_mapping SET review_state='reviewed',reviewer='synthetic',reviewed_at=now() WHERE plan_version_id=%s",
            "UPDATE rdtr.plan_version SET freshness_state='withdrawn' WHERE id=%s",
        ):
            for activate in (False, True):
                with self.subTest(mutation=mutation, activate=activate), self.conn.transaction(force_rollback=True):
                    self.conn.execute(mutation, (self.version,))
                    before = self.publication_state()
                    with self.assertRaisesRegex(ValueError, '^unsupported_publication_state$'):
                        module.publish_release(self.conn, self.selections(), channel='synthetic', activate=activate, actor='synthetic')
                    self.assertEqual(self.publication_state(), before)

    def test_repeat_release_deduplicates_and_activation_switch_preserves_old_release(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        first = module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic-one')
        self.assertEqual(str(self.conn.execute('SELECT release_id FROM rdtr.active_release').fetchone()[0]), first['release_id'])
        old = self.conn.execute('SELECT row_to_json(r) FROM rdtr.dataset_release r WHERE id=%s', (first['release_id'],)).fetchone()
        again = module.publish_release(self.conn, self.selections(), channel='other', activate=False, actor='synthetic-two')
        self.assertEqual(first['release_id'], again['release_id'])
        self.assertTrue(again['reused'])
        changed = fixture()
        changed['data']['payload']['features'][0]['properties']['zone_name'] = 'Synthetic revision'
        next_version = self.stage(changed)
        module.prepare_version(self.conn, next_version, self.blobs)
        second = module.publish_release(self.conn, self.selections(next_version), channel='synthetic', activate=True, actor='synthetic-three')
        self.assertNotEqual(second['release_hash'], first['release_hash'])
        self.assertEqual(str(self.conn.execute('SELECT release_id FROM rdtr.active_release').fetchone()[0]), second['release_id'])
        self.assertEqual(self.conn.execute('SELECT row_to_json(r) FROM rdtr.dataset_release r WHERE id=%s', (first['release_id'],)).fetchone(), old)
        self.assertTrue(module.prepare_version(self.conn, self.version, self.blobs)['reused'])
        with self.assertRaises(psycopg.Error), self.conn.transaction():
            self.conn.execute('DELETE FROM rdtr.release_mapping WHERE release_id=%s', (first['release_id'],))

    def test_conflicting_or_mismatched_explicit_selections_are_rejected_before_sealing(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        other = self.stage(fixture('7412000000:001'))
        module.prepare_version(self.conn, other, self.blobs)
        valid = self.selections()
        bads = [[], valid + valid,
                [{'plan_version_id': self.version, 'mapping_id': self.selections(other)[0]['mapping_id']}],
                [{'plan_version_id': self.version, 'mapping_id': '00000000-0000-0000-0000-000000000000'}],
                [{'plan_version_id': '{' + self.version + '}', 'mapping_id': valid[0]['mapping_id']}]]
        for selections in bads:
            with self.subTest(selections=selections), self.assertRaisesRegex(ValueError, 'invalid_selections'):
                module.publish_release(self.conn, selections, channel='synthetic', activate=False, actor='synthetic')
        for kwargs in ({'activate': 1}, {'actor': ''}, {'channel': 'bad channel'}):
            params = {'channel': 'synthetic', 'activate': False, 'actor': 'synthetic', **kwargs}
            with self.assertRaisesRegex(ValueError, 'invalid_release_parameters'):
                module.publish_release(self.conn, valid, **params)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.dataset_release').fetchone()[0], 0)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.plan_version WHERE published_at IS NOT NULL').fetchone()[0], 0)

    def test_secure_capture_rejects_corrupt_linked_or_nonprivate_artifacts(self):
        module = self.subject()
        artifact = self.conn.execute('SELECT blob_locator FROM rdtr.source_artifact').fetchone()[0]
        path = self.blobs / artifact
        raw = path.read_bytes()
        path.write_bytes(raw.replace(b'Synthetic', b'Synthetix'))
        with self.assertRaisesRegex(ValueError, 'artifact_sha256_mismatch'):
            module.prepare_version(self.conn, self.version, self.blobs)
        path.write_bytes(raw)
        path.chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'private_artifact_required'):
            module.prepare_version(self.conn, self.version, self.blobs)
        path.chmod(0o600)
        target = self.blobs / 'synthetic-target'
        path.rename(target)
        path.symlink_to(target)
        with self.assertRaises(OSError):
            module.prepare_version(self.conn, self.version, self.blobs)
        path.unlink()
        target.rename(path)
        os.link(path, target)
        with self.assertRaisesRegex(ValueError, 'private_artifact_required'):
            module.prepare_version(self.conn, self.version, self.blobs)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_display').fetchone()[0], 0)

    def test_empty_and_overlapping_coverage_keep_honest_original_preserved_metadata(self):
        module = self.subject()
        for kind in ('empty', 'overlap'):
            with self.subTest(kind=kind):
                raw = fixture()
                payload = raw['data']['payload']
                if kind == 'empty':
                    payload['features'] = []
                    payload['meta']['counts'] = {'matched': 0, 'returned': 0, 'excludedInvalid': 0}
                else:
                    extra = copy.deepcopy(payload['features'][0])
                    extra['id'] = extra['properties']['object_id'] = 8
                    payload['features'].append(extra)
                    payload['meta']['counts'] = {'matched': 2, 'returned': 2, 'excludedInvalid': 0}
                version = self.stage(raw)
                receipt = module.prepare_version(self.conn, version, self.blobs)
                self.assertEqual(receipt['display_rows'], 0 if kind == 'empty' else 6)
                model = self.model(version)
                self.assertEqual(model['sourceBounds'], None if kind == 'empty' else [120.0, -4.0, 120.001, -3.999])
                for info in model['levels'].values():
                    self.assertEqual(info['method'], 'original_preserved')
                    self.assertEqual(info['fallbackReason'], None if kind == 'empty' else 'coverage_invalid')
                    self.assertEqual(info['validation']['coverageValid'], None if kind == 'empty' else False)
                wrong = self.conn.execute('''SELECT count(*) FROM rdtr.zone_display d JOIN rdtr.zone_feature f ON f.id=d.zone_feature_id
                    WHERE d.plan_version_id=%s AND ST_AsEWKB(d.geom_display_4326)<>ST_AsEWKB(f.geom_original_4326)''', (version,)).fetchone()[0]
                self.assertEqual(wrong, 0)
                module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=False, actor='synthetic')

    def test_failed_preparation_and_activation_roll_back_all_job_changes(self):
        module = self.subject()
        self.conn.execute('''CREATE FUNCTION rdtr.synthetic_failure() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'synthetic failure' USING ERRCODE='23514'; END $$''')
        self.conn.execute('CREATE TRIGGER synthetic_failure BEFORE INSERT ON rdtr.zone_display FOR EACH ROW WHEN(NEW.level=1) EXECUTE FUNCTION rdtr.synthetic_failure()')
        with self.assertRaises(psycopg.Error):
            module.prepare_version(self.conn, self.version, self.blobs)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_display').fetchone()[0], 0)
        self.assertNotIn('localReadModel', self.conn.execute('SELECT layer_metadata FROM rdtr.plan_version').fetchone()[0])
        self.conn.execute('DROP TRIGGER synthetic_failure ON rdtr.zone_display')
        module.prepare_version(self.conn, self.version, self.blobs)
        self.conn.execute('CREATE TRIGGER synthetic_failure BEFORE INSERT ON rdtr.active_release FOR EACH ROW EXECUTE FUNCTION rdtr.synthetic_failure()')
        before = self.conn.execute('SELECT row_to_json(v) FROM rdtr.plan_version v').fetchall()
        with self.assertRaises(psycopg.Error):
            module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
        self.assertEqual(self.conn.execute('SELECT row_to_json(v) FROM rdtr.plan_version v').fetchall(), before)
        for table in ('dataset_release', 'release_plan_version', 'release_mapping', 'active_release'):
            self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.' + table).fetchone()[0], 0)
        self.assertEqual(self.conn.execute('SELECT published_at FROM rdtr.kbli_activity_mapping').fetchone(), (None,))

    def test_empty_preparation_cannot_publish_after_metadata_or_fingerprint_tampering(self):
        raw = fixture()
        raw['data']['payload']['features'] = []
        raw['data']['payload']['meta']['counts'] = {'matched': 0, 'returned': 0, 'excludedInvalid': 0}
        version = self.stage(raw)
        module = self.subject()
        module.prepare_version(self.conn, version, self.blobs)
        for sql in ("UPDATE rdtr.plan_version SET content_fingerprint=repeat('0',64) WHERE id=%s",
                    "UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{localReadModel,meta,source,retrievedAt}','\"2026-01-01T00:00:00Z\"') WHERE id=%s"):
            with self.conn.transaction(force_rollback=True):
                self.conn.execute(sql, (version,))
                with self.assertRaisesRegex(ValueError, 'preparation_invalid'):
                    module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=False, actor='synthetic')

    def test_explicit_mapping_revision_and_manifest_order_are_stable(self):
        module = self.subject()
        self.conn.execute('''INSERT INTO rdtr.kbli_activity_mapping(plan_version_id,local_activity_id,kbli_version,
            kbli_code,basis,scope_key,scope,assumptions,revision,review_state)
            SELECT plan_version_id,local_activity_id,kbli_version,kbli_code,basis,scope_key,scope,assumptions,2,review_state
            FROM rdtr.kbli_activity_mapping WHERE plan_version_id=%s''', (self.version,))
        other = self.stage(fixture('7412000000:001'))
        for version in (self.version, other):
            module.prepare_version(self.conn, version, self.blobs)
        selected = self.selections() + self.selections(other)
        first = module.publish_release(self.conn, selected, channel='synthetic', activate=False, actor='synthetic')
        second = module.publish_release(self.conn, list(reversed(selected)), channel='synthetic', activate=False, actor='different-synthetic-operator')
        self.assertEqual(first['release_hash'], second['release_hash'])
        self.assertEqual(first['release_id'], second['release_id'])
        plans = first['manifest']['plans']
        self.assertEqual([p['planId'] for p in plans], sorted(p['planId'] for p in plans))
        self.assertEqual(next(p for p in plans if p['planVersionId'] == self.version)['mappingRevision'], 2)
        self.assertEqual(self.conn.execute('SELECT revision,published_at IS NOT NULL FROM rdtr.kbli_activity_mapping WHERE plan_version_id=%s ORDER BY revision', (self.version,)).fetchall(), [(1, False), (2, True)])
        with self.assertRaisesRegex(ValueError, 'invalid_selections'):
            module.publish_release(self.conn, selected + self.selections(), channel='synthetic', activate=False, actor='synthetic')

    def test_synthetic_prepared_release_roundtrips_shared_sql_api(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        receipt = module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
        import rdtr_local_api as api
        catalog = api.get_catalog(self.conn, 'synthetic')
        self.assertEqual(catalog['localDataset']['releaseHash'], receipt['release_hash'])
        display = api.get_display(self.conn, source.PLAN_ID, 'detail', receipt['release_hash'])
        detail = api.get_feature_detail(self.conn, source.PLAN_ID, 7, display['meta']['snapshotId'], receipt['release_hash'])
        self.assertEqual(display['meta']['source']['retrievedAt'], '2001-01-01T00:00:00Z')
        self.assertEqual(display['meta']['sourceCounts'], self.raw['data']['payload']['meta']['counts'])
        self.assertNotIn('geometry', detail)
        self.assertEqual(detail['properties']['permission'], 'unknown')

    def quarantined_raw(self, *, all_quarantined=False):
        raw = fixture()
        raw['data']['quarantine'] = [{'object_id': 8, 'reason': 'synthetic invalid geometry',
            'feature': {'type': 'Feature', 'id': 8, 'properties': {'OBJECTID': 8, 'KODSZN': 'P-1',
                'NAMSZN': 'Synthetic', 'NAMZON': 'Synthetic', 'NOTHPR': None}, 'geometry': None}}]
        if all_quarantined:
            raw['data']['payload']['features'] = []
        count = len(raw['data']['payload']['features'])
        raw['data']['payload']['meta']['counts'] = {'matched': count + 1, 'returned': count, 'excludedInvalid': 1}
        return raw

    def test_all_quarantined_stays_unpublished_but_known_empty_roundtrips(self):
        module = self.subject()
        version = self.stage(self.quarantined_raw(all_quarantined=True))
        self.assertEqual(module.prepare_version(self.conn, version, self.blobs)['display_rows'], 0)
        before = self.publication_state()
        for activate in (False, True):
            with self.subTest(activate=activate), self.assertRaisesRegex(ValueError, '^no_publishable_features$'):
                module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=activate, actor='synthetic')
            self.assertEqual(self.publication_state(), before)
        raw = fixture()
        raw['data']['payload']['features'] = []
        raw['data']['payload']['meta']['counts'] = {'matched': 0, 'returned': 0, 'excludedInvalid': 0}
        empty = self.stage(raw)
        module.prepare_version(self.conn, empty, self.blobs)
        receipt = module.publish_release(self.conn, self.selections(empty), channel='synthetic', activate=True, actor='synthetic')
        import rdtr_local_api as api
        self.assertEqual(api.get_catalog(self.conn, 'synthetic')['localDataset']['releaseHash'], receipt['release_hash'])
        display = api.get_display(self.conn, source.PLAN_ID, 'detail', receipt['release_hash'])
        self.assertEqual(display['features'], [])
        self.assertEqual(display['meta']['sourceCounts'], {'matched': 0, 'returned': 0, 'excludedInvalid': 0})

    def test_quarantine_proof_detects_changes_after_preparation_atomically(self):
        module = self.subject()
        version = self.stage(self.quarantined_raw())
        module.prepare_version(self.conn, version, self.blobs)
        for mutation in (
            'DELETE FROM rdtr.quarantined_feature',
            "UPDATE rdtr.quarantined_feature SET reason='tampered'",
            "UPDATE rdtr.quarantined_feature SET feature_locator='/wrong'",
            "UPDATE rdtr.quarantined_feature SET details='{\"tampered\":true}'",
            "UPDATE rdtr.quarantined_feature SET error_code='wrong'",
            'UPDATE rdtr.quarantined_feature SET source_object_id=9',
        ):
            with self.subTest(mutation=mutation), self.conn.transaction(force_rollback=True):
                self.conn.execute(mutation)
                before = self.publication_state()
                with self.assertRaisesRegex(ValueError, '^preparation_invalid$'):
                    module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=True, actor='synthetic')
                self.assertEqual(self.publication_state(), before)

    def test_quarantine_raw_provenance_reconciles_before_preparation(self):
        module = self.subject()
        version = self.stage(self.quarantined_raw())
        for mutation in (
            "UPDATE rdtr.quarantined_feature SET feature_locator='/wrong'",
            "UPDATE rdtr.quarantined_feature SET details='{\"tampered\":true}'",
            "UPDATE rdtr.quarantined_feature SET error_code='wrong'",
            "UPDATE rdtr.quarantined_feature SET source_artifact_id=(SELECT id FROM rdtr.source_artifact WHERE import_run_id=(SELECT created_from_run_id FROM rdtr.plan_version WHERE id='" + self.version + "'))",
        ):
            with self.subTest(mutation=mutation), self.conn.transaction(force_rollback=True):
                # Cross-run provenance already fails the existing FK; the other
                # cases must fail byte-to-SQL preparation reconciliation.
                if 'source_artifact_id' in mutation:
                    with self.assertRaises(psycopg.errors.ForeignKeyViolation):
                        with self.conn.transaction():
                            self.conn.execute(mutation)
                    continue
                self.conn.execute(mutation)
                with self.assertRaisesRegex(ValueError, '^source_sql_mismatch$'):
                    module.prepare_version(self.conn, version, self.blobs)
                self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_display').fetchone()[0], 0)

    def test_published_origin_quarantine_is_sealed_but_later_observations_work(self):
        module = self.subject()
        raw = self.quarantined_raw()
        version = self.stage(raw)
        module.prepare_version(self.conn, version, self.blobs)
        module.publish_release(self.conn, self.selections(version), channel='synthetic', activate=True, actor='synthetic')
        # An ordinary content_same retrieval still owns its own quarantine rows.
        later = import_snapshot(self.conn, read_snapshot_bytes(pack(raw)), self.blobs, batch_key='synthetic-later')
        self.assertFalse(later['created_version'])
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.quarantined_feature WHERE import_run_id=%s', (later['run_id'],)).fetchone()[0], 1)
        self.conn.execute("UPDATE rdtr.import_run SET validation_result='{\"progress\":true}' WHERE id=%s", (later['run_id'],))
        origin = self.conn.execute('SELECT created_from_run_id FROM rdtr.plan_version WHERE id=%s', (version,)).fetchone()[0]
        artifact = self.conn.execute('SELECT id FROM rdtr.source_artifact WHERE import_run_id=%s', (origin,)).fetchone()[0]
        later_artifact = self.conn.execute('SELECT id FROM rdtr.source_artifact WHERE import_run_id=%s', (later['run_id'],)).fetchone()[0]
        before = self.conn.execute('SELECT to_jsonb(q) FROM rdtr.quarantined_feature q ORDER BY id').fetchall()
        mutations = [
            ('DELETE FROM rdtr.quarantined_feature WHERE import_run_id=%s', (origin,)),
            ("UPDATE rdtr.quarantined_feature SET reason='tampered' WHERE import_run_id=%s", (origin,)),
            ('UPDATE rdtr.quarantined_feature SET import_run_id=%s,source_artifact_id=%s WHERE import_run_id=%s', (later['run_id'], later_artifact, origin)),
            ('UPDATE rdtr.quarantined_feature SET import_run_id=%s,source_artifact_id=%s WHERE import_run_id=%s', (origin, artifact, later['run_id'])),
            ("INSERT INTO rdtr.quarantined_feature(import_run_id,source_artifact_id,source_object_id,feature_locator,error_code,reason) VALUES(%s,%s,9,'/late','source_geometry_invalid','late')", (origin, artifact)),
            ('TRUNCATE rdtr.quarantined_feature', ()),
        ]
        for sql, params in mutations:
            with self.subTest(sql=sql):
                with self.assertRaises(psycopg.errors.ObjectNotInPrerequisiteState) as error:
                    with self.conn.transaction():
                        self.conn.execute(sql, params)
                self.assertEqual(error.exception.sqlstate, '55000')
                self.assertEqual(self.conn.execute('SELECT to_jsonb(q) FROM rdtr.quarantined_feature q ORDER BY id').fetchall(), before)
        import rdtr_local_api as api
        self.assertEqual(api.get_catalog(self.conn, 'synthetic')['localDataset']['sourceKind'], 'local_dataset')

    def test_q0_preparation_hash_is_legacy_compatible_and_late_insert_is_rejected(self):
        module = self.subject()
        module.prepare_version(self.conn, self.version, self.blobs)
        # Independently reconstruct the exact pre-fix proof format.
        legacy = {}
        for table in ('zone_feature', 'zone_match_key', 'local_activity', 'activity_zone_rule', 'rule_target', 'rule_evidence'):
            legacy[table] = self.conn.execute('SELECT to_jsonb(t) FROM rdtr.' + table + ' t WHERE plan_version_id=%s ORDER BY to_jsonb(t)::text', (self.version,)).fetchall()
        legacy['version'] = self.conn.execute("""SELECT jsonb_build_object('sourceTime',extract(epoch from source_time),
            'nativeSrid',native_srid,'outputSrid',output_srid,'geometryScope',geometry_scope,
            'rulesScope',rules_scope,'sourceFilter',source_filter,'layerPath',layer_path)
            FROM rdtr.plan_version WHERE id=%s""", (self.version,)).fetchone()[0]
        proof = self.conn.execute("SELECT layer_metadata->'localReadPreparation'->>'sourceRowsHash' FROM rdtr.plan_version WHERE id=%s", (self.version,)).fetchone()[0]
        self.assertEqual(proof, hashlib.sha256(source.encoded(legacy)).hexdigest())
        run, artifact = self.conn.execute('SELECT import_run_id,id FROM rdtr.source_artifact').fetchone()
        sql = "INSERT INTO rdtr.quarantined_feature(import_run_id,source_artifact_id,source_object_id,feature_locator,error_code,reason) VALUES(%s,%s,9,'/late','source_geometry_invalid','late')"
        with self.conn.transaction(force_rollback=True):
            self.conn.execute(sql, (run, artifact))
            with self.assertRaisesRegex(ValueError, '^preparation_invalid$'):
                module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
        module.publish_release(self.conn, self.selections(), channel='synthetic', activate=True, actor='synthetic')
        with self.assertRaises(psycopg.errors.ObjectNotInPrerequisiteState):
            with self.conn.transaction():
                self.conn.execute(sql, (run, artifact))

    def test_quarantine_original_ids_and_reasons_reconcile_before_preparation(self):
        raw = fixture()
        raw['data']['quarantine'] = [{'object_id': 8, 'reason': 'synthetic invalid geometry',
            'feature': {'type': 'Feature', 'id': 8, 'properties': {'OBJECTID': 8, 'KODSZN': 'P-1',
                'NAMSZN': 'Synthetic', 'NAMZON': 'Synthetic', 'NOTHPR': None}, 'geometry': None}}]
        raw['data']['payload']['meta']['counts'] = {'matched': 2, 'returned': 1, 'excludedInvalid': 1}
        version = self.stage(raw)
        self.conn.execute("UPDATE rdtr.quarantined_feature SET reason='tampered'")
        with self.assertRaisesRegex(ValueError, 'source_sql_mismatch'):
            self.subject().prepare_version(self.conn, version, self.blobs)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_display').fetchone()[0], 0)

    def test_repeat_prepare_reuses_identical_rows_without_writes(self):
        module = self.subject()
        first = module.prepare_version(self.conn, self.version, self.blobs)
        before = self.conn.execute('SELECT row_to_json(d) FROM rdtr.zone_display d ORDER BY level').fetchall()
        second = module.prepare_version(self.conn, self.version, self.blobs)
        self.assertTrue(second['reused'])
        self.assertEqual(second['display_rows'], first['display_rows'])
        self.assertEqual(self.conn.execute('SELECT row_to_json(d) FROM rdtr.zone_display d ORDER BY level').fetchall(), before)

    def test_prepare_rejects_mismatched_original_sql_atomically(self):
        mutations = [
            "UPDATE rdtr.zone_feature SET geometry_hash=repeat('0',64)",
            "UPDATE rdtr.zone_feature SET geom_original_4326=ST_Translate(geom_original_4326,0.001,0)",
            "UPDATE rdtr.zone_feature SET source_properties=jsonb_set(source_properties,'{zone_name}','\"changed\"')",
            "UPDATE rdtr.zone_feature SET source_object_id=8",
            "UPDATE rdtr.plan_version SET content_fingerprint=repeat('0',64)",
            "UPDATE rdtr.plan_version SET source_id_count=9",
            "DELETE FROM rdtr.zone_match_key",
            "UPDATE rdtr.local_activity SET source_activity_id='099'",
            "UPDATE rdtr.plan_version SET source_time='2026-01-01T00:00:00Z'",
            "UPDATE rdtr.plan_version SET native_srid=9999",
            "DELETE FROM rdtr.rule_target",
        ]
        for sql in mutations:
            with self.subTest(sql=sql):
                with self.conn.transaction(force_rollback=True):
                    self.conn.execute(sql)
                    with self.assertRaisesRegex(ValueError, 'source_sql_mismatch'):
                        self.subject().prepare_version(self.conn, self.version, self.blobs)
                    self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_display').fetchone()[0], 0)
                    self.assertNotIn('localReadModel', self.conn.execute('SELECT layer_metadata FROM rdtr.plan_version').fetchone()[0])


if __name__ == '__main__':
    unittest.main()
