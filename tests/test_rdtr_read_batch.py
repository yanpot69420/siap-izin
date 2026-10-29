"""Rollback-only synthetic SQL proof batching and response parity regressions."""
import hashlib
import json
import os
from pathlib import Path
from unittest.mock import patch

import test_rdtr_local_api as fixture
from test_rdtr_local_api import SQLFixture, PLAN, seed, digest, legacy
from psycopg.types.json import Jsonb

OTHER = '7406000000:001'


def combined(conn, *, empty=False):
    first = seed(conn, activate=False)
    with patch.object(fixture, 'PLAN', OTHER):
        second = seed(conn, activate=False, fingerprint='b'*64, empty=empty)
    manifests = conn.execute('SELECT manifest FROM rdtr.dataset_release WHERE id=ANY(%s::uuid[])',
                             ([first['release'], second['release']],)).fetchall()
    manifest = dict(manifests[0][0])
    manifest['plans'] = sorted([p for row in manifests for p in row[0]['plans']], key=lambda p:p['planId'])
    release_hash = digest(manifest)
    rid = conn.execute('INSERT INTO rdtr.dataset_release(manifest_hash,manifest,partial_release) VALUES(%s,%s,true) RETURNING id',
                       (release_hash, Jsonb(manifest))).fetchone()[0]
    conn.execute('''INSERT INTO rdtr.release_plan_version
        SELECT %s,plan_id,plan_version_id,geometry_scope,rules_scope,ingest_state,mapping_review_state,
        freshness_state,known_available_feature_count FROM rdtr.release_plan_version WHERE release_id=ANY(%s::uuid[])''',
                 (rid, [first['release'], second['release']]))
    conn.execute('''INSERT INTO rdtr.release_mapping SELECT %s,mapping_id,plan_id,plan_version_id
        FROM rdtr.release_mapping WHERE release_id=ANY(%s::uuid[])''', (rid, [first['release'],second['release']]))
    conn.execute("UPDATE rdtr.dataset_release SET status='published',published_at=now(),published_by='synthetic-test' WHERE id=%s", (rid,))
    return release_hash, first, second


class ReadBatchTests(SQLFixture):
    def record(self, value):
        target = os.environ.get('RDTR_BATCH_ARTIFACT')
        if target:
            Path(target).parent.mkdir(parents=True, exist_ok=True)
            Path(target).write_text(json.dumps(value, indent=2)+'\n')

    def test_all_member_proof_query_count_is_constant(self):
        release_hash, first, second = combined(self.conn)
        api = self.api()
        self.conn.execute("SET LOCAL statement_timeout='3s'")
        observed = []
        for plan in (PLAN, OTHER):
            for level in api.LEVELS:
                with patch.object(api, '_rows', wraps=api._rows) as reads:
                    response = api.get_display(self.conn, plan, level, release_hash)
                body = legacy.encoded(response)
                observed.append({'plan':plan,'level':level,'queries':reads.call_count,
                                 'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
        self.record({'phase':os.environ.get('RDTR_BATCH_PHASE'),'synthetic':True,'responses':observed})
        self.assertEqual([r['queries'] for r in observed], [5]*6,
                         'all release members must be proved with two grouped SQL reads, not two per member')

    def test_batched_responses_are_byte_identical_to_single_member_reads(self):
        import importlib.util
        from contextlib import nullcontext
        release_hash, first, second = combined(self.conn)
        api = self.api()
        reference_path = os.environ.get('RDTR_BATCH_REFERENCE')
        if reference_path:
            spec = importlib.util.spec_from_file_location('rdtr_before_batch', reference_path)
            assert spec is not None and spec.loader is not None
            reference = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(reference)
            reference_context = nullcontext
        else:
            reference = api
            grouped = api._prepared_rows
            def per_member(conn, members):
                return {m['planVersionId']:grouped(conn,[m])[m['planVersionId']] for m in members}
            reference_context = lambda: patch.object(api, '_prepared_rows', side_effect=per_member)
        self.conn.execute("SET LOCAL statement_timeout='3s'")
        self.conn.execute('SET LOCAL ROLE siap_izin_readonly')
        observed = []
        for pin, plans in ((release_hash,(PLAN,OTHER)), (first['release_hash'],(PLAN,))):
            for plan in plans:
                for level in api.LEVELS:
                    for bbox in (None,[120.15,-3.97,120.16,-3.96]):
                        with reference_context():
                            before = legacy.encoded(reference.get_display(self.conn,plan,level,pin,bbox))
                        result = api.get_display(self.conn,plan,level,pin,bbox)
                        after = legacy.encoded(result)
                        self.assertEqual(after,before)
                        observed.append({'kind':'display','plan':plan,'pin':pin,'level':level,'bbox':bbox,
                                         'bytes':len(after),'beforeSHA256':hashlib.sha256(before).hexdigest(),
                                         'afterSHA256':hashlib.sha256(after).hexdigest()})
                snapshot = api.get_display(self.conn,plan,'overview',pin)['meta']['snapshotId']
                with reference_context():
                    before = legacy.encoded(reference.get_feature_detail(self.conn,plan,7,snapshot,pin))
                after = legacy.encoded(api.get_feature_detail(self.conn,plan,7,snapshot,pin))
                self.assertEqual(after,before)
                observed.append({'kind':'detail','plan':plan,'pin':pin,'bytes':len(after),
                                 'beforeSHA256':hashlib.sha256(before).hexdigest(),
                                 'afterSHA256':hashlib.sha256(after).hexdigest()})
        target = os.environ.get('RDTR_BATCH_PARITY')
        if target:
            Path(target).write_text(json.dumps({'synthetic':True,'reference':reference_path or 'single-member SQL',
                                                'statementTimeout':'3s','responses':observed},indent=2)+'\n')

    def test_unrequested_member_tamper_is_rechecked_after_success(self):
        release_hash, first, second = combined(self.conn)
        api = self.api()
        api.get_display(self.conn, PLAN, 'overview', release_hash)
        cases = [
            ('zone_feature', 'UPDATE rdtr.zone_feature SET geom_original_4326=ST_Reverse(geom_original_4326) WHERE plan_version_id=%s'),
            ('zone_display', "UPDATE rdtr.zone_display SET source_geometry_hash=repeat('f',64) WHERE plan_version_id=%s"),
            ('zone_display', "UPDATE rdtr.zone_display SET parameters='{}' WHERE plan_version_id=%s"),
            ('zone_display', "UPDATE rdtr.zone_display SET qc_state='unknown' WHERE plan_version_id=%s"),
            ('zone_display', "UPDATE rdtr.zone_display SET qc_result=jsonb_set(qc_result,'{modelHash}',to_jsonb(repeat('f',64))) WHERE plan_version_id=%s"),
            ('zone_display', "UPDATE rdtr.zone_display SET geom_display_4326=ST_Translate(geom_display_4326,0.001,0) WHERE plan_version_id=%s"),
            ('zone_display', 'DELETE FROM rdtr.zone_display WHERE plan_version_id=%s AND level=2'),
            ('plan_version', "UPDATE rdtr.plan_version SET source_time=source_time+interval '1 day' WHERE id=%s"),
        ]
        for table, sql in cases:
            with self.subTest(sql=sql), self.conn.transaction(force_rollback=True):
                self.conn.execute('ALTER TABLE rdtr.'+table+' DISABLE TRIGGER USER')
                self.conn.execute(sql, (second['version'],))
                with self.assertRaises(legacy.APIError) as raised:
                    api.get_display(self.conn, PLAN, 'overview', release_hash)
                self.assertEqual(raised.exception.status, 503)
            api.get_display(self.conn, PLAN, 'overview', release_hash)

    def test_empty_neighbour_and_unrelated_version_are_not_confused(self):
        release_hash, first, second = combined(self.conn, empty=True)
        unrelated = seed(self.conn, activate=False, fingerprint='c'*64)
        api = self.api()
        with self.conn.transaction(force_rollback=True):
            self.conn.execute('ALTER TABLE rdtr.zone_display DISABLE TRIGGER USER')
            self.conn.execute("UPDATE rdtr.zone_display SET qc_result='{}' WHERE plan_version_id=%s", (unrelated['version'],))
            result = api.get_display(self.conn, OTHER, 'overview', release_hash)
            self.assertEqual(result['features'], [])
            self.assertIsNone(result['meta']['sourceBounds'])
            self.assertEqual(result['meta']['counts'], {'matched':0,'returned':0,'excludedInvalid':0})
            self.assertEqual(len(api.get_display(self.conn,PLAN,'overview',release_hash)['features']),1)
