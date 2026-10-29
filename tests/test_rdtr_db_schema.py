"""Real PostgreSQL integration tests; every fixture is rolled back in siap_izin_test."""
import importlib.util
from contextlib import contextmanager
from hashlib import sha256
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import unittest

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'private/rdtr-db/connection.json'
EVIDENCE = Path.home() / '.hermes/outputs/siap-izin-db-hardening/schema'
VERSIONS = ['001_rdtr', '002_provenance_parent_identity', '003_master_source_identity', '004_quarantine_publication_seal']


class SchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dsn = os.environ.get('RDTR_TEST_DSN')
        if not dsn and CONFIG.exists():
            from tools.rdtr_connection import load_dsn
            dsn = load_dsn(CONFIG, 'test')
        if not dsn:
            raise unittest.SkipTest('RDTR_TEST_DSN / private test_dsn not configured')
        cls._dsn = dsn
        try:
            import psycopg
            cls.conn = psycopg.connect(dsn, autocommit=True)
        except Exception:
            raise RuntimeError('Cannot connect to configured RDTR test database') from None
        if cls.conn.execute('select current_database()').fetchone()[0] != 'siap_izin_test':
            cls.conn.close()
            raise RuntimeError('Integration tests require database siap_izin_test')
        cls.conn.execute("SET statement_timeout='15s'")
        cls.conn.execute("SET lock_timeout='5s'")
        (EVIDENCE).mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        self.conn.execute('BEGIN')
        self.conn.execute('DROP SCHEMA IF EXISTS rdtr CASCADE')

    def tearDown(self):
        self.conn.execute('ROLLBACK')

    def runner(self):
        self.assertIsNotNone(importlib.util.find_spec('tools.rdtrdb'), 'migration package missing')
        from tools.rdtrdb.migrations import migrate
        return migrate

    def test_migration_is_transactional_and_idempotent(self):
        migrate = self.runner()
        self.assertEqual(migrate(self.conn), VERSIONS)
        self.assertEqual(migrate(self.conn), [])
        self.assertEqual(self.conn.execute("select to_regclass('rdtr.geo_region')::text").fetchone()[0], 'rdtr.geo_region')
        records = self.conn.execute('SELECT version,checksum FROM rdtr.schema_migration ORDER BY version').fetchall()
        self.assertEqual([version for version,_ in records], VERSIONS)
        for version,checksum in records:
            self.assertEqual(checksum, sha256((ROOT / 'db/migrations' / (version + '.sql')).read_bytes()).hexdigest())

    def seed(self):
        from uuid import uuid4
        names = ['region', 'plan', 'run', 'artifact', 'version', 'feature', 'activity',
                 'rule', 'evidence', 'mapping', 'release']
        self.ids = {name: uuid4() for name in names}
        self.runner()(self.conn)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM pg_tables WHERE schemaname='rdtr' AND tablename <> 'schema_migration'").fetchone()[0], 20, '20-table foundation missing')
        def put(sql, *names):
            return self.conn.execute(sql, tuple(self.ids[n] for n in names))
        put("INSERT INTO rdtr.geo_region(id,name,id_namespace,source_region_id) VALUES (%s,'Test','internal','0074')", 'region')
        put("INSERT INTO rdtr.rdtr_plan(id,region_id,source_provider,source_plan_id,name) VALUES (%s,%s,'official','001.20','Plan')", 'plan','region')
        put("INSERT INTO rdtr.import_run(id,plan_id,batch_key,retrieval_scope) VALUES (%s,%s,'seed','filtered_subset')", 'run','plan')
        put("INSERT INTO rdtr.source_artifact(id,import_run_id,kind,sha256,byte_size,blob_locator) VALUES (%s,%s,'features',repeat('a',64),1,'private/test.json')", 'artifact','run')
        put("INSERT INTO rdtr.plan_version(id,plan_id,created_from_run_id,content_fingerprint,layer_path,geometry_scope) VALUES (%s,%s,%s,repeat('b',64),'layer/0','filtered_subset')", 'version','plan','run')
        put("INSERT INTO rdtr.plan_observation(plan_version_id,import_run_id,result) VALUES (%s,%s,'content_same')", 'version','run')
        put("INSERT INTO rdtr.zone_feature(id,plan_version_id,source_object_id,source_properties,geom_original_4326) VALUES (%s,%s,7,'{\"KODSZN\":\"001\"}',ST_GeomFromText('POLYGON((120 -4,121 -4,121 -3,120 -4))',4326))", 'feature','version')
        put("INSERT INTO rdtr.quarantined_feature(import_run_id,source_artifact_id,feature_locator,error_code,reason) VALUES (%s,%s,'features/2','invalid','bad source')", 'run','artifact')
        put("INSERT INTO rdtr.zone_match_key(plan_version_id,zone_feature_id,field_name,raw_value) VALUES (%s,%s,'KODUNK','01.002.003')", 'version','feature')
        put("INSERT INTO rdtr.zone_display(plan_version_id,zone_feature_id,level,algorithm_version,source_geometry_hash,method,qc_state,geom_display_4326) SELECT %s,%s,0,'original-v1',repeat('c',64),'original','passed',geom_original_4326 FROM rdtr.zone_feature WHERE id=%s", 'version','feature','feature')
        put("INSERT INTO rdtr.local_activity(id,plan_version_id,source_activity_id,name) VALUES (%s,%s,'00012','Activity')", 'activity','version')
        put("INSERT INTO rdtr.activity_zone_rule(id,plan_version_id,local_activity_id,evidence_kind) VALUES (%s,%s,%s,'filter_membership')", 'rule','version','activity')
        put("INSERT INTO rdtr.rule_target(plan_version_id,rule_id,field_name,raw_value) VALUES (%s,%s,'KODUNK','01.002.003')", 'version','rule')
        put("INSERT INTO rdtr.rule_evidence(id,plan_version_id,rule_id,source_artifact_id,kind,locator) VALUES (%s,%s,%s,%s,'filter_membership','features/0')", 'evidence','version','rule','artifact')
        self.conn.execute("INSERT INTO rdtr.kbli_entry(kbli_version,kbli_code,description) VALUES ('2020','01273','Test crop')")
        put("INSERT INTO rdtr.kbli_activity_mapping(id,plan_version_id,local_activity_id,kbli_version,kbli_code,basis) VALUES (%s,%s,%s,'2020','01273','filter lookup')", 'mapping','version','activity')
        put("INSERT INTO rdtr.dataset_release(id,manifest_hash) VALUES (%s,repeat('d',64))", 'release')
        put("INSERT INTO rdtr.release_plan_version(release_id,plan_id,plan_version_id,geometry_scope) VALUES (%s,%s,%s,'filtered_subset')", 'release','plan','version')
        put("INSERT INTO rdtr.release_mapping(release_id,mapping_id,plan_id,plan_version_id) VALUES (%s,%s,%s,%s)", 'release','mapping','plan','version')
        return self.ids

    def test_twenty_table_subset_import_preserves_literal_identifiers(self):
        ids = self.seed()
        tables = self.conn.execute("select tablename from pg_tables where schemaname='rdtr' and tablename <> 'schema_migration'").fetchall()
        self.assertEqual(len(tables), 20)
        self.assertEqual(self.conn.execute('select source_plan_id from rdtr.rdtr_plan').fetchone()[0], '001.20')
        self.assertEqual(self.conn.execute('select source_activity_id from rdtr.local_activity').fetchone()[0], '00012')
        self.assertEqual(self.conn.execute('select kbli_code from rdtr.kbli_entry').fetchone()[0], '01273')
        self.assertEqual(self.conn.execute('select raw_value from rdtr.zone_match_key').fetchone()[0], '01.002.003')
        self.assertEqual(self.conn.execute('select permission_status, review_state from rdtr.activity_zone_rule').fetchone(), ('unknown','unreviewed'))
        self.assertEqual(self.conn.execute('select scope_kind from rdtr.rule_evidence').fetchone()[0], 'unknown')
        self.assertEqual(self.conn.execute('select review_state from rdtr.kbli_activity_mapping').fetchone()[0], 'unreviewed')
        self.assertEqual(self.conn.execute('select geometry_scope from rdtr.plan_version').fetchone()[0], 'filtered_subset')

    def rejects(self, sql, params=(), states=('23514', '23505', '23503', '22023')):
        import psycopg
        with self.assertRaises(psycopg.Error) as caught:
            with self.conn.transaction():
                self.conn.execute(sql, params)
        self.assertIn(caught.exception.sqlstate, states)
        return caught.exception

    def test_master_identity_cannot_relabel_draft_or_published_content(self):
        from tools.rdtr_queries import database_status
        for published in (False, True):
            with self.subTest(published=published), self.conn.transaction(force_rollback=True):
                ids = self.seed()
                if published:
                    self.publish()
                other_region = self.conn.execute("INSERT INTO rdtr.geo_region(name,id_namespace,source_region_id) VALUES ('Other','internal','9999') RETURNING id").fetchone()[0]
                before = self.content_snapshot()
                status = database_status(self.conn)
                for assignment, params in [
                    ("source_plan_id='099.99'", ()),
                    ("source_provider='different-provider'", ()),
                    ('region_id=%s', (other_region,)),
                    ('source_plan_id=NULL', ()),
                ]:
                    with self.subTest(assignment=assignment):
                        self.rejects('UPDATE rdtr.rdtr_plan SET ' + assignment + ' WHERE id=%s', (*params, ids['plan']), ('23503',))
                for assignment in ("id_namespace='different'", "source_region_id='74'", 'source_region_id=NULL'):
                    with self.subTest(assignment=assignment):
                        self.rejects('UPDATE rdtr.geo_region SET ' + assignment + ' WHERE id=%s', (ids['region'],), ('23503',))
                self.assertEqual(self.content_snapshot(), before)
                self.assertEqual(database_status(self.conn), status)
                self.assertEqual(status['versions'][0]['plan_id'], '001.20')
                self.conn.execute("UPDATE rdtr.rdtr_plan SET source_plan_id=source_plan_id,source_provider=source_provider,region_id=region_id,name='Descriptive correction',catalog_state='listed',source_metadata='{\"reviewed\":false}' WHERE id=%s", (ids['plan'],))
                self.conn.execute("UPDATE rdtr.geo_region SET id_namespace=id_namespace,source_region_id=source_region_id,name='Descriptive region correction' WHERE id=%s", (ids['region'],))
                after = self.content_snapshot()
                for table in before:
                    if table not in ('rdtr_plan', 'geo_region'):
                        self.assertEqual(after[table], before[table], table)
                self.assertEqual(database_status(self.conn)['versions'][0]['plan_id'], '001.20')

    def test_geometry_rejects_invalid_empty_wrong_srid_and_nonpolygon(self):
        ids = self.seed()
        for geometry in ["ST_GeomFromText('POLYGON((0 0,1 1,1 0,0 1,0 0))',4326)",
                         "ST_GeomFromText('POLYGON EMPTY',4326)",
                         "ST_GeomFromText('POINT(120 -4)',4326)",
                         "ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 0))',3857)"]:
            with self.subTest(geometry=geometry):
                self.rejects('UPDATE rdtr.zone_feature SET geom_original_4326=' + geometry)
                self.rejects('UPDATE rdtr.zone_display SET geom_display_4326=' + geometry)

    def test_source_oid_unique_per_version(self):
        ids = self.seed()
        self.rejects('INSERT INTO rdtr.zone_feature(plan_version_id,source_object_id,geom_original_4326) SELECT plan_version_id,source_object_id,geom_original_4326 FROM rdtr.zone_feature')

    def test_identifier_and_scope_constraints(self):
        self.seed()
        for sql in ["UPDATE rdtr.kbli_entry SET kbli_code='1273'",
                    "UPDATE rdtr.local_activity SET source_activity_id=''",
                    "UPDATE rdtr.rdtr_plan SET source_plan_id=''",
                    "UPDATE rdtr.zone_feature SET source_object_id=-1",
                    "UPDATE rdtr.activity_zone_rule SET permission_status='probably'",
                    "UPDATE rdtr.plan_version SET geometry_scope='complete_layer'",
                    "INSERT INTO rdtr.source_artifact(import_run_id,kind,sha256,byte_size,blob_locator) SELECT import_run_id,kind,'wrong',byte_size,blob_locator FROM rdtr.source_artifact",
                    "UPDATE rdtr.import_run SET valid_count=-1",
                    "UPDATE rdtr.kbli_activity_mapping SET revision=0"]:
            with self.subTest(sql=sql):
                self.rejects(sql)

    def other_version(self):
        from uuid import uuid4
        other = {k: uuid4() for k in ('plan','run','version','activity','rule','feature','mapping','artifact')}
        self.conn.execute("INSERT INTO rdtr.rdtr_plan(id,region_id,source_provider,source_plan_id,name) VALUES (%s,%s,'official','002','Other')", (other['plan'], self.ids['region']))
        self.conn.execute("INSERT INTO rdtr.import_run(id,plan_id,batch_key) VALUES (%s,%s,'other')", (other['run'],other['plan']))
        self.conn.execute("INSERT INTO rdtr.source_artifact(id,import_run_id,kind,sha256,byte_size,blob_locator) VALUES (%s,%s,'features',repeat('e',64),1,'private/other.json')", (other['artifact'],other['run']))
        self.conn.execute("INSERT INTO rdtr.plan_version(id,plan_id,created_from_run_id,content_fingerprint,layer_path) VALUES (%s,%s,%s,repeat('e',64),'other/0')", (other['version'],other['plan'],other['run']))
        self.conn.execute("INSERT INTO rdtr.local_activity(id,plan_version_id,source_activity_id,name) VALUES (%s,%s,'00012','Other')", (other['activity'],other['version']))
        self.conn.execute("INSERT INTO rdtr.activity_zone_rule(id,plan_version_id,local_activity_id) VALUES (%s,%s,%s)", (other['rule'],other['version'],other['activity']))
        self.conn.execute("INSERT INTO rdtr.zone_feature(id,plan_version_id,source_object_id,geom_original_4326) SELECT %s,%s,7,geom_original_4326 FROM rdtr.zone_feature LIMIT 1", (other['feature'],other['version']))
        self.conn.execute("INSERT INTO rdtr.kbli_activity_mapping(id,plan_version_id,local_activity_id,kbli_version,kbli_code,basis) VALUES (%s,%s,%s,'2020','01273','other')", (other['mapping'],other['version'],other['activity']))
        return other

    def test_composite_foreign_keys_prevent_cross_version_children(self):
        self.seed()
        other = self.other_version()
        for sql, value in [
            ('UPDATE rdtr.activity_zone_rule SET local_activity_id=%s WHERE id=\'' + str(self.ids['rule']) + "'", other['activity']),
            ('UPDATE rdtr.kbli_activity_mapping SET local_activity_id=%s WHERE id=\'' + str(self.ids['mapping']) + "'", other['activity']),
            ('UPDATE rdtr.zone_match_key SET zone_feature_id=%s', other['feature']),
            ('UPDATE rdtr.zone_display SET zone_feature_id=%s', other['feature']),
            ('UPDATE rdtr.rule_target SET rule_id=%s', other['rule']),
            ('UPDATE rdtr.rule_evidence SET rule_id=%s', other['rule'])]:
            with self.subTest(sql=sql):
                self.rejects(sql, (value,), ('23503',))

    def test_composite_foreign_keys_prevent_mismatched_release_membership(self):
        self.seed()
        other = self.other_version()
        for sql, params in [
            ('UPDATE rdtr.release_plan_version SET plan_version_id=%s', (other['version'],)),
            ('UPDATE rdtr.release_mapping SET mapping_id=%s', (other['mapping'],)),
            ('UPDATE rdtr.release_mapping SET plan_id=%s,plan_version_id=%s', (other['plan'],other['version']))]:
            with self.subTest(sql=sql):
                self.rejects(sql, params, ('23503',))

    def test_provenance_and_catalog_foreign_keys(self):
        self.seed()
        other = self.other_version()
        for sql, value in [
            ('UPDATE rdtr.plan_version SET created_from_run_id=%s WHERE id=\'' + str(self.ids['version']) + "'", other['run']),
            ('UPDATE rdtr.quarantined_feature SET source_artifact_id=%s', other['artifact'])]:
            with self.subTest(sql=sql):
                self.rejects(sql, (value,), ('23503',))
        self.rejects("UPDATE rdtr.kbli_activity_mapping SET kbli_code='99999'", states=('23503',))

    def publish(self):
        self.conn.execute("UPDATE rdtr.plan_version SET ingest_state='ready',valid_feature_count=1,quarantined_feature_count=1,published_at=now()")
        self.conn.execute('UPDATE rdtr.kbli_activity_mapping SET published_at=now()')
        self.conn.execute("UPDATE rdtr.release_plan_version SET ingest_state='ready'")
        self.conn.execute("UPDATE rdtr.dataset_release SET status='published',published_at=now(),published_by='test'")

    def test_published_content_is_immutable_including_insert_and_delete(self):
        self.seed()
        self.publish()
        for table, assignment in [
            ('plan_version', "layer_path='changed'"),
            ('zone_feature', "zone_name='changed'"),
            ('zone_match_key', "raw_value='changed'"),
            ('zone_display', "method='changed'"),
            ('local_activity', "name='changed'"),
            ('activity_zone_rule', "permission_status='allowed'"),
            ('rule_target', "raw_value='changed'"),
            ('rule_evidence', "scope_kind='zone'"),
            ('kbli_activity_mapping', "review_state='reviewed'"),
            ('kbli_entry', "description='changed'"),
            ('source_artifact', "blob_locator='changed'")]:
            with self.subTest(table=table):
                self.rejects(f'UPDATE rdtr.{table} SET {assignment}', states=('55000',))
                self.rejects(f'DELETE FROM rdtr.{table}', states=('55000',))
        self.rejects("INSERT INTO rdtr.local_activity(plan_version_id,source_activity_id,name) VALUES (%s,'new','New')", (self.ids['version'],), ('55000',))
        self.rejects('TRUNCATE rdtr.zone_display', states=('55000',))
        self.rejects('UPDATE rdtr.kbli_activity_mapping SET published_at=NULL', states=('55000',))

    def test_release_definitions_immutable_but_activation_pointer_switchable(self):
        from uuid import uuid4
        self.seed()
        self.publish()
        for sql in ["UPDATE rdtr.dataset_release SET coverage_notes='changed'",
                    'DELETE FROM rdtr.dataset_release',
                    'DELETE FROM rdtr.release_mapping',
                    'DELETE FROM rdtr.release_plan_version',
                    "UPDATE rdtr.release_plan_version SET coverage='{\"changed\":true}'",
                    'UPDATE rdtr.release_mapping SET mapping_id=mapping_id',
                    'INSERT INTO rdtr.release_plan_version SELECT * FROM rdtr.release_plan_version',
                    'INSERT INTO rdtr.release_mapping SELECT * FROM rdtr.release_mapping']:
            with self.subTest(sql=sql):
                self.rejects(sql, states=('55000',))
        first = self.ids['release']
        second = uuid4()
        self.conn.execute("INSERT INTO rdtr.dataset_release(id,manifest_hash) VALUES (%s,repeat('f',64))", (second,))
        self.conn.execute('INSERT INTO rdtr.release_plan_version SELECT %s,plan_id,plan_version_id,geometry_scope,rules_scope,ingest_state,mapping_review_state,freshness_state,known_available_feature_count,coverage FROM rdtr.release_plan_version WHERE release_id=%s', (second,first))
        self.conn.execute("UPDATE rdtr.dataset_release SET status='published',published_at=now() WHERE id=%s", (second,))
        self.conn.execute("INSERT INTO rdtr.active_release(channel,release_id,activated_by) VALUES ('local',%s,'test')", (first,))
        self.conn.execute("UPDATE rdtr.active_release SET release_id=%s,activated_by='rollback',activated_at=now() WHERE channel='local'", (second,))
        self.assertEqual(self.conn.execute('SELECT release_id FROM rdtr.active_release').fetchone()[0], second)
        self.conn.execute('UPDATE rdtr.active_release SET release_id=%s', (first,))
        self.assertEqual(self.conn.execute('SELECT release_id FROM rdtr.active_release').fetchone()[0], first)

    def test_publication_rejects_unprepared_versions_and_draft_activation(self):
        self.seed()
        self.rejects('UPDATE rdtr.plan_version SET published_at=now()', states=('23514',))
        self.rejects("UPDATE rdtr.dataset_release SET status='published',published_at=now()", states=('23514',))
        self.rejects("INSERT INTO rdtr.active_release(channel,release_id,activated_by) VALUES ('local',%s,'test')", (self.ids['release'],), ('23514',))
        self.conn.execute("UPDATE rdtr.plan_version SET ingest_state='ready'")
        self.conn.execute('DELETE FROM rdtr.zone_display')
        self.rejects('UPDATE rdtr.plan_version SET published_at=now()', states=('23514',))

    def test_release_rejects_two_mapping_revisions_for_same_logical_relation(self):
        from uuid import uuid4
        self.seed()
        revision = uuid4()
        self.conn.execute('INSERT INTO rdtr.kbli_activity_mapping(id,plan_version_id,local_activity_id,kbli_version,kbli_code,revision,basis) SELECT %s,plan_version_id,local_activity_id,kbli_version,kbli_code,2,basis FROM rdtr.kbli_activity_mapping', (revision,))
        self.rejects('INSERT INTO rdtr.release_mapping(release_id,mapping_id,plan_id,plan_version_id) VALUES (%s,%s,%s,%s)', (self.ids['release'],revision,self.ids['plan'],self.ids['version']), ('23505',))

    def test_reader_role_is_nologin_and_cannot_write_any_table(self):
        self.seed()
        role = self.conn.execute("SELECT rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname='siap_izin_readonly'").fetchone()
        self.assertEqual(role, (False,False,False,False,False), 'safe global reader role missing')
        tables = [r[0] for r in self.conn.execute("SELECT tablename FROM pg_tables WHERE schemaname='rdtr'").fetchall()]
        with self.conn.transaction():
            self.conn.execute('SET LOCAL ROLE siap_izin_readonly')
            self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_feature').fetchone()[0], 1)
            self.assertFalse(self.conn.execute("SELECT has_function_privilege(current_user,'rdtr.guard_provenance_parent_identity()','EXECUTE')").fetchone()[0])
            self.assertFalse(self.conn.execute("SELECT has_function_privilege(current_user,'rdtr.guard_master_source_identity()','EXECUTE')").fetchone()[0])
            for table in tables:
                for privilege in ('INSERT','UPDATE','DELETE','TRUNCATE'):
                    with self.subTest(table=table,privilege=privilege):
                        self.assertFalse(self.conn.execute('SELECT has_table_privilege(current_user,%s,%s)', ('rdtr.'+table,privilege)).fetchone()[0])
            self.rejects("INSERT INTO rdtr.geo_region(name,id_namespace) VALUES ('bad','bad')", states=('42501',))
            self.rejects("UPDATE rdtr.geo_region SET name='bad'", states=('42501',))
            self.rejects('DELETE FROM rdtr.geo_region', states=('42501',))
            self.rejects('CREATE TABLE rdtr.bad(id integer)', states=('42501',))
        self.conn.execute('RESET ROLE')

    def test_observation_run_cannot_be_reparented(self):
        self.seed()
        other = self.other_version()
        run = self.conn.execute("INSERT INTO rdtr.import_run(plan_id,batch_key) VALUES (%s,'reobservation') RETURNING id", (self.ids['plan'],)).fetchone()[0]
        self.conn.execute("INSERT INTO rdtr.plan_observation(plan_version_id,import_run_id,result) VALUES (%s,%s,'content_same')", (self.ids['version'],run))
        before = self.content_snapshot()
        error = self.rejects('UPDATE rdtr.import_run SET plan_id=%s WHERE id=%s', (other['plan'],run), ('23503',))
        self.assertEqual((error.diag.schema_name,error.diag.table_name,error.diag.constraint_name), ('rdtr','import_run','import_run_provenance_identity'))
        self.assertEqual(self.content_snapshot(), before)

    def test_draft_version_cannot_reparent_existing_evidence(self):
        self.seed()
        other = self.other_version()
        self.conn.execute('DELETE FROM rdtr.release_mapping')
        self.conn.execute('DELETE FROM rdtr.release_plan_version')
        before = self.content_snapshot()
        error = self.rejects('UPDATE rdtr.plan_version SET plan_id=%s,created_from_run_id=%s WHERE id=%s', (other['plan'],other['run'],self.ids['version']), ('23503',))
        self.assertEqual((error.diag.schema_name,error.diag.table_name,error.diag.constraint_name), ('rdtr','plan_version','plan_version_provenance_identity'))
        self.assertEqual(self.content_snapshot(), before)

    @contextmanager
    def foundation_only(self):
        from tools.rdtrdb import migrations
        with TemporaryDirectory(dir=EVIDENCE) as folder:
            original = migrations.MIGRATIONS / '001_rdtr.sql'
            (Path(folder) / original.name).write_bytes(original.read_bytes())
            with patch.object(migrations, 'MIGRATIONS', Path(folder)):
                yield

    @contextmanager
    def migrations_through(self, count):
        from tools.rdtrdb import migrations
        with TemporaryDirectory(dir=EVIDENCE) as folder:
            for version in VERSIONS[:count]:
                original = migrations.MIGRATIONS / (version + '.sql')
                (Path(folder) / original.name).write_bytes(original.read_bytes())
            with patch.object(migrations, 'MIGRATIONS', Path(folder)):
                yield

    def cached_identity(self):
        self.conn.execute("UPDATE rdtr.rdtr_plan SET source_provider='gistaru'")
        self.conn.execute("UPDATE rdtr.geo_region SET id_namespace='gistaru'")
        self.conn.execute('''UPDATE rdtr.plan_version SET source_provider='gistaru',
            layer_metadata='{"artifactKind":"validated_source_cache","context":{"id":"001.20","region_id":"0074"}}' ''')

    def test_003_preflight_rejects_cached_identity_mismatch_without_repair(self):
        from tools.rdtrdb import migrations
        mutations = [
            "UPDATE rdtr.rdtr_plan SET source_plan_id='099.99'",
            "UPDATE rdtr.rdtr_plan SET source_plan_id=NULL",
            "UPDATE rdtr.rdtr_plan SET source_provider='other'",
            "UPDATE rdtr.geo_region SET source_region_id='74'",
            "UPDATE rdtr.geo_region SET source_region_id=NULL",
            "UPDATE rdtr.geo_region SET id_namespace='other'",
            "UPDATE rdtr.plan_version SET source_provider='other'",
            "UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{context,id}','123')",
            "UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{context,region_id}','null')",
            "UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{context}','[]')",
            "UPDATE rdtr.plan_version SET layer_metadata=layer_metadata #- '{context,id}'",
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation), self.conn.transaction(force_rollback=True):
                with self.migrations_through(2):
                    self.seed()
                self.cached_identity()
                self.conn.execute(mutation)
                self.conn.execute('CREATE TEMP TABLE caller_marker(value integer) ON COMMIT DROP')
                self.conn.execute('INSERT INTO caller_marker VALUES (1)')
                before = self.content_snapshot()
                with self.assertRaisesRegex(migrations.MigrationError, 'SQLSTATE 23503'):
                    migrations.migrate(self.conn)
                self.assertEqual(self.content_snapshot(), before)
                self.assertEqual(self.conn.execute('SELECT version FROM rdtr.schema_migration ORDER BY version').fetchall(), [(v,) for v in VERSIONS[:2]])
                self.assertIsNone(self.conn.execute("SELECT to_regprocedure('rdtr.guard_master_source_identity()')").fetchone()[0])
                self.conn.execute('INSERT INTO caller_marker VALUES (2)')
                self.assertEqual(self.conn.execute('SELECT sum(value) FROM caller_marker').fetchone()[0], 3)
                error = self.rejects((ROOT / 'db/migrations/003_master_source_identity.sql').read_text(), states=('23503',))
                self.assertEqual(error.diag.constraint_name, 'master_source_context_consistency')

    def test_003_upgrade_preserves_draft_and_published_with_or_without_context(self):
        for published in (False, True):
            for context in ('none', 'cached', 'missing', 'unmarked'):
                with self.subTest(published=published, context=context), self.conn.transaction(force_rollback=True):
                    with self.migrations_through(2):
                        self.seed()
                    if context in ('cached', 'missing'):
                        self.cached_identity()
                    if context == 'missing':
                        self.conn.execute("UPDATE rdtr.plan_version SET layer_metadata=layer_metadata-'context'")
                    if context == 'unmarked':
                        self.conn.execute('''UPDATE rdtr.plan_version SET layer_metadata='{"context":{"id":"untrusted","region_id":"untrusted"}}' ''')
                    if published:
                        self.publish()
                    before = self.content_snapshot()
                    with self.migrations_through(3):
                        self.assertEqual(self.runner()(self.conn), [VERSIONS[2]])
                        self.assertEqual(self.runner()(self.conn), [])
                    self.assertEqual(self.content_snapshot(), before)

    def test_003_upgrade_accepts_real_importer_cached_context(self):
        import rdtr_snapshot
        import rdtr_store
        from test_rdtr_snapshot import fixture, pack
        with self.migrations_through(2):
            self.runner()(self.conn)
        snapshot = rdtr_snapshot.read_snapshot_bytes(pack(fixture()))
        with TemporaryDirectory(dir=EVIDENCE) as folder:
            receipt = rdtr_store.import_snapshot(self.conn, snapshot, Path(folder) / 'blobs')
            before = self.content_snapshot()
            with self.migrations_through(3):
                self.assertEqual(self.runner()(self.conn), [VERSIONS[2]])
            self.assertEqual(self.content_snapshot(), before)
            later = rdtr_store.import_snapshot(self.conn, snapshot, Path(folder) / 'blobs')
            self.assertFalse(later['created_version'])
            self.assertEqual(later['plan_version_id'], receipt['plan_version_id'])
            self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.plan_observation').fetchone()[0], 2)
            self.assertEqual(self.content_snapshot()['plan_version'], before['plan_version'])

    def test_master_null_identity_is_fixed_at_creation_but_descriptions_can_change(self):
        self.runner()(self.conn)
        region = self.conn.execute("INSERT INTO rdtr.geo_region(name,id_namespace) VALUES ('Unknown','synthetic') RETURNING id").fetchone()[0]
        plan = self.conn.execute("INSERT INTO rdtr.rdtr_plan(region_id,source_provider,name) VALUES (%s,'synthetic','Unknown') RETURNING id", (region,)).fetchone()[0]
        self.rejects("UPDATE rdtr.rdtr_plan SET source_plan_id='0001' WHERE id=%s", (plan,), ('23503',))
        self.rejects("UPDATE rdtr.geo_region SET source_region_id='0001' WHERE id=%s", (region,), ('23503',))
        self.conn.execute("UPDATE rdtr.rdtr_plan SET source_plan_id=source_plan_id,region_id=region_id,source_provider=source_provider,name='Correct name',catalog_state='listed',source_metadata='{\"checked\":true}' WHERE id=%s", (plan,))
        self.conn.execute("UPDATE rdtr.geo_region SET id_namespace=id_namespace,source_region_id=source_region_id,name='Correct region' WHERE id=%s", (region,))
        self.assertEqual(self.conn.execute('SELECT source_plan_id,name,catalog_state FROM rdtr.rdtr_plan WHERE id=%s', (plan,)).fetchone(), (None,'Correct name','listed'))
        self.assertEqual(self.conn.execute('SELECT source_region_id,name FROM rdtr.geo_region WHERE id=%s', (region,)).fetchone(), (None,'Correct region'))

    def content_snapshot(self):
        from psycopg import sql
        tables = self.conn.execute("SELECT tablename FROM pg_tables WHERE schemaname='rdtr' AND tablename <> 'schema_migration' ORDER BY tablename").fetchall()
        return {table: self.conn.execute(sql.SQL('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb) FROM rdtr.{} t').format(sql.Identifier(table))).fetchone()[0] for (table,) in tables}

    def test_002_preflight_fails_closed_preserving_caller_transaction(self):
        from tools.rdtrdb import migrations
        with self.foundation_only():
            self.seed()
            other = self.other_version()
        self.conn.execute('CREATE TEMP TABLE caller_marker(value integer) ON COMMIT DROP')
        self.conn.execute('INSERT INTO caller_marker VALUES (1)')
        for kind in ('observation','zone_feature','local_activity','rule_evidence','version'):
            with self.subTest(kind=kind), self.conn.transaction(force_rollback=True):
                run = self.conn.execute("INSERT INTO rdtr.import_run(plan_id,batch_key) VALUES (%s,'preflight') RETURNING id", (self.ids['plan'],)).fetchone()[0]
                if kind == 'observation':
                    self.conn.execute("INSERT INTO rdtr.plan_observation(plan_version_id,import_run_id,result) VALUES (%s,%s,'content_same')", (self.ids['version'],run))
                elif kind != 'version':
                    artifact = self.conn.execute("INSERT INTO rdtr.source_artifact(import_run_id,kind,sha256,byte_size,blob_locator) VALUES (%s,'test',repeat('a',64),1,'private/preflight') RETURNING id", (run,)).fetchone()[0]
                    self.conn.execute(f'UPDATE rdtr.{kind} SET source_artifact_id=%s WHERE plan_version_id=%s', (artifact,self.ids['version']))
                if kind == 'version':
                    self.conn.execute('DELETE FROM rdtr.release_mapping')
                    self.conn.execute('DELETE FROM rdtr.release_plan_version')
                    self.conn.execute('UPDATE rdtr.plan_version SET plan_id=%s,created_from_run_id=%s WHERE id=%s', (other['plan'],other['run'],self.ids['version']))
                else:
                    self.conn.execute('UPDATE rdtr.import_run SET plan_id=%s WHERE id=%s', (other['plan'],run))
                before = self.content_snapshot()
                with self.assertRaisesRegex(migrations.MigrationError, 'SQLSTATE 23503'):
                    migrations.migrate(self.conn)
                self.assertEqual(self.content_snapshot(), before, 'preflight must not repair/delete any rows')
                self.assertEqual(self.conn.execute('SELECT version FROM rdtr.schema_migration ORDER BY version').fetchall(), [('001_rdtr',)])
                self.assertIsNone(self.conn.execute("SELECT to_regprocedure('rdtr.guard_provenance_parent_identity()')").fetchone()[0])
                error = self.rejects((ROOT / 'db/migrations/002_provenance_parent_identity.sql').read_text(), states=('23503',))
                self.assertEqual(error.diag.constraint_name, 'provenance_plan_consistency')
                self.conn.execute('INSERT INTO caller_marker VALUES (2)')
                self.assertEqual(self.conn.execute('SELECT sum(value) FROM caller_marker').fetchone()[0], 3)

    def test_002_upgrade_preserves_all_children_and_artifact_bytes(self):
        for published in (False,True):
            with self.subTest(published=published), self.conn.transaction(force_rollback=True):
                with self.foundation_only():
                    self.seed()
                if published:
                    self.publish()
                    self.conn.execute("INSERT INTO rdtr.active_release(channel,release_id,activated_by) VALUES ('test',%s,'test')", (self.ids['release'],))
                before = self.content_snapshot()
                with self.migrations_through(2):
                    self.assertEqual(self.runner()(self.conn), [VERSIONS[1]])
                    self.assertEqual(self.runner()(self.conn), [])
                self.assertEqual(self.conn.execute('SELECT version FROM rdtr.schema_migration ORDER BY version').fetchall(), [(v,) for v in VERSIONS[:2]])
                self.assertEqual(self.content_snapshot(), before)
                self.rejects("UPDATE rdtr.source_artifact SET blob_locator='changed'", states=('55000',))
                self.rejects('DELETE FROM rdtr.source_artifact', states=('55000',))

    def test_draft_version_origin_and_unreferenced_run_parent_are_stable(self):
        self.seed()
        other = self.other_version()
        run = self.conn.execute("INSERT INTO rdtr.import_run(plan_id,batch_key) VALUES (%s,'same-plan') RETURNING id", (self.ids['plan'],)).fetchone()[0]
        self.rejects('UPDATE rdtr.plan_version SET created_from_run_id=%s WHERE id=%s', (run,self.ids['version']), ('23503',))
        self.rejects('UPDATE rdtr.import_run SET plan_id=%s WHERE id=%s', (other['plan'],run), ('23503',))

    def test_artifact_only_run_cannot_transitively_reparent_children(self):
        self.seed()
        other = self.other_version()
        run = self.conn.execute("INSERT INTO rdtr.import_run(plan_id,batch_key) VALUES (%s,'artifact-only') RETURNING id", (self.ids['plan'],)).fetchone()[0]
        artifact = self.conn.execute("INSERT INTO rdtr.source_artifact(import_run_id,kind,sha256,byte_size,blob_locator) VALUES (%s,'test',repeat('a',64),1,'private/artifact-only') RETURNING id", (run,)).fetchone()[0]
        for table in ('zone_feature','local_activity','rule_evidence'):
            self.conn.execute(f'UPDATE rdtr.{table} SET source_artifact_id=%s WHERE plan_version_id=%s', (artifact,self.ids['version']))
        before = self.content_snapshot()
        self.rejects('UPDATE rdtr.import_run SET plan_id=%s WHERE id=%s', (other['plan'],run), ('23503',))
        self.rejects('UPDATE rdtr.source_artifact SET import_run_id=%s WHERE id=%s', (other['run'],artifact), ('55000',))
        self.assertEqual(self.content_snapshot(), before)

    def test_later_content_same_observation_and_import_progress_remain_legal(self):
        self.seed()
        self.publish()
        version = self.content_snapshot()['plan_version']
        run = self.conn.execute("INSERT INTO rdtr.import_run(plan_id,batch_key,started_at) VALUES (%s,'later',now()+interval '1 day') RETURNING id", (self.ids['plan'],)).fetchone()[0]
        self.conn.execute("INSERT INTO rdtr.source_artifact(import_run_id,kind,sha256,byte_size,blob_locator) VALUES (%s,'later',repeat('a',64),1,'private/later')", (run,))
        self.conn.execute("INSERT INTO rdtr.plan_observation(plan_version_id,import_run_id,result,observed_at) VALUES (%s,%s,'content_same',now()+interval '1 day')", (self.ids['version'],run))
        for status in ('running','ready'):
            self.conn.execute('UPDATE rdtr.import_run SET plan_id=plan_id,status=%s,valid_count=1,validation_result=\'{"checked":true}\' WHERE id IN (%s,%s)', (status,run,self.ids['run']))
        self.assertEqual(self.conn.execute('SELECT status,valid_count FROM rdtr.import_run WHERE id=%s', (run,)).fetchone(), ('ready',1))
        self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.plan_observation').fetchone()[0], 2)
        self.assertEqual(self.content_snapshot()['plan_version'], version)

    def test_provenance_artifacts_cannot_cross_plans(self):
        self.seed()
        other = self.other_version()
        for table in ('zone_feature','local_activity','rule_evidence'):
            with self.subTest(table=table):
                self.rejects(f'UPDATE rdtr.{table} SET source_artifact_id=%s WHERE plan_version_id=%s', (other['artifact'],self.ids['version']), ('23503',))
        self.rejects('UPDATE rdtr.plan_observation SET import_run_id=%s', (other['run'],), ('23503',))

    def test_filter_membership_cannot_claim_known_permission(self):
        self.seed()
        self.rejects("UPDATE rdtr.activity_zone_rule SET permission_status='allowed'", states=('23514',))

    def test_release_publication_rechecks_revision_conflicts_after_draft_edit(self):
        from uuid import uuid4
        self.seed()
        revision = uuid4()
        self.conn.execute("INSERT INTO rdtr.kbli_activity_mapping(id,plan_version_id,local_activity_id,kbli_version,kbli_code,revision,basis,scope_key) SELECT %s,plan_version_id,local_activity_id,kbli_version,kbli_code,2,basis,'other' FROM rdtr.kbli_activity_mapping", (revision,))
        self.conn.execute('INSERT INTO rdtr.release_mapping(release_id,mapping_id,plan_id,plan_version_id) VALUES (%s,%s,%s,%s)', (self.ids['release'],revision,self.ids['plan'],self.ids['version']))
        self.conn.execute("UPDATE rdtr.kbli_activity_mapping SET scope_key='unknown'")
        self.conn.execute("UPDATE rdtr.plan_version SET ingest_state='ready',published_at=now()")
        self.conn.execute('UPDATE rdtr.kbli_activity_mapping SET published_at=now()')
        self.conn.execute("UPDATE rdtr.release_plan_version SET ingest_state='ready'")
        self.rejects("UPDATE rdtr.dataset_release SET status='published',published_at=now()", states=('23505',))

    def test_changed_migration_checksum_fails_closed(self):
        from tempfile import TemporaryDirectory
        from unittest.mock import patch
        from tools.rdtrdb import migrations
        self.runner()(self.conn)
        for original in sorted(migrations.MIGRATIONS.glob('[0-9]*_*.sql')):
            with self.subTest(migration=original.stem), TemporaryDirectory(dir=EVIDENCE) as folder:
                for source in migrations.MIGRATIONS.glob('[0-9]*_*.sql'):
                    (Path(folder) / source.name).write_bytes(source.read_bytes())
                path = Path(folder) / original.name
                path.write_bytes(original.read_bytes() + b'\n-- changed bytes\n')
                with patch.object(migrations, 'MIGRATIONS', Path(folder)):
                    with self.assertRaisesRegex(migrations.MigrationError, 'checksum mismatch: ' + original.stem):
                        migrations.migrate(self.conn)
        self.assertEqual(migrations.migrate(self.conn), [])

    def test_missing_002_migration_fails_closed_without_mutating_content(self):
        from tools.rdtrdb import migrations
        self.seed()
        before = self.content_snapshot()
        # Remove each exact file independently, retaining the other two. This
        # preserves the original 002 regression rather than conflating it with 003.
        for missing in VERSIONS:
            with self.subTest(missing=missing), TemporaryDirectory(dir=EVIDENCE) as folder:
                for version in VERSIONS:
                    if version != missing:
                        original = migrations.MIGRATIONS / (version + '.sql')
                        (Path(folder) / original.name).write_bytes(original.read_bytes())
                with patch.object(migrations, 'MIGRATIONS', Path(folder)):
                    with self.assertRaisesRegex(migrations.MigrationError, 'migration is missing from disk'):
                        migrations.migrate(self.conn)
                self.assertEqual(self.content_snapshot(), before)
        self.assertEqual(migrations.migrate(self.conn), [])

    def test_failed_migration_rolls_back_ddl_and_sanitizes_errors(self):
        from tempfile import TemporaryDirectory
        from unittest.mock import patch
        from tools.rdtrdb import migrations
        with TemporaryDirectory(dir=EVIDENCE) as folder:
            (Path(folder) / '001_probe.sql').write_text('CREATE TABLE rdtr.probe(id integer);')
            (Path(folder) / '002_fail.sql').write_text("SELECT 'sensitive-marker'::integer;")
            with patch.object(migrations, 'MIGRATIONS', Path(folder)):
                with self.assertRaises(migrations.MigrationError) as caught:
                    migrations.migrate(self.conn)
            self.assertNotIn('sensitive-marker', str(caught.exception))
            self.assertNotIn(self._dsn, str(caught.exception))
            self.assertIn('SQLSTATE 22P02', str(caught.exception))
        self.assertIsNone(self.conn.execute("SELECT to_regnamespace('rdtr')").fetchone()[0])

    def test_runner_uses_real_transaction_advisory_lock(self):
        import threading
        import time
        import psycopg
        from tools.rdtrdb.migrations import LOCK_ID, migrate
        self.conn.execute('SELECT pg_advisory_xact_lock(%s)', (LOCK_ID,))
        connected = threading.Event()
        done = threading.Event()
        results = {}
        def worker():
            try:
                with psycopg.connect(self._dsn, autocommit=True) as connection:
                    connection.execute("SET statement_timeout='8s'")
                    if connection.execute('SELECT current_database()').fetchone()[0] != 'siap_izin_test':
                        raise RuntimeError('Integration worker requires database siap_izin_test')
                    results['pid'] = connection.info.backend_pid
                    connected.set()
                    with connection.transaction(force_rollback=True):
                        results['applied'] = migrate(connection)
            except Exception as exc:
                results['error'] = type(exc).__name__
            finally:
                done.set()
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        waiting = False
        try:
            self.assertTrue(connected.wait(3), 'worker did not connect')
            deadline = time.monotonic() + 3
            while not done.is_set() and time.monotonic() < deadline:
                waiting = self.conn.execute("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=%s AND locktype='advisory' AND NOT granted)", (results['pid'],)).fetchone()[0]
                if waiting:
                    break
                time.sleep(0.02)
        finally:
            self.conn.execute('ROLLBACK')
            self.conn.execute('BEGIN')
            thread.join(10)
        self.assertTrue(waiting, 'migrate did not wait on the real advisory lock')
        self.assertTrue(done.is_set(), 'worker did not finish')
        self.assertNotIn('error', results)
        self.assertEqual(results.get('applied'), VERSIONS)
        self.assertIsNone(self.conn.execute("SELECT to_regnamespace('rdtr')").fetchone()[0])


if __name__ == '__main__':
    unittest.main()
