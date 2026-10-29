"""SQL-backed synthetic read fixtures. Never commit or touch development data."""
import hashlib
import importlib
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT))
import psycopg
from psycopg.types.json import Jsonb
import dev_server as legacy
from display_geometry import PROPERTY_KEYS
from tools.rdtr_connection import load_dsn
from tools.rdtrdb.migrations import migrate

LOCK = 0x5244545254455354
PLAN = '7411000000:001'


def digest(value):
    return hashlib.sha256(legacy.encoded(value)).hexdigest()


def seed(conn, *, prepared=True, activate=True, fingerprint='a' * 64, empty=False, simplified=False):
    """Entirely synthetic polygon with a hole, persisted only until rollback."""
    ctx = legacy.context_for(PLAN)
    region = conn.execute("INSERT INTO rdtr.geo_region(name,id_namespace,source_region_id) VALUES('Synthetic','gistaru',%s) ON CONFLICT(id_namespace,source_region_id) DO UPDATE SET name=excluded.name RETURNING id", (ctx.region_id,)).fetchone()[0]
    plan = conn.execute("INSERT INTO rdtr.rdtr_plan(region_id,source_provider,source_plan_id,name) VALUES(%s,'gistaru',%s,%s) ON CONFLICT(source_provider,source_plan_id) DO UPDATE SET name=excluded.name RETURNING id", (region, PLAN, ctx.name)).fetchone()[0]
    run = conn.execute("INSERT INTO rdtr.import_run(plan_id,batch_key,status) VALUES(%s,'synthetic-local-read','ready') RETURNING id", (plan,)).fetchone()[0]
    geometry = {'type': 'Polygon', 'coordinates': [[[120.12345678901234,-4],[120.2,-4],[120.2,-3.9],[120.12345678901234,-3.9],[120.12345678901234,-4]], [[120.14,-3.98],[120.14,-3.92],[120.18,-3.92],[120.18,-3.98],[120.14,-3.98]]]}
    meta = {'plan': {'id': PLAN, 'name': ctx.name, 'regionId': ctx.region_id},
            'activity': {'id': ctx.activity_id, 'name': ctx.activity_name, 'filterField': ctx.filter_field, 'mappingReviewed': False},
            'kbli': {'code': '01273', 'version': '2025', 'scope': 'budidaya-kakao', 'scopeConfirmed': False, 'mappingReviewed': False},
            'filterZoneCodes': ['P-1'], 'counts': {'matched': 1, 'returned': 1, 'excludedInvalid': 0},
            'coverage': 'loaded-plan-matching-zones-only', 'geometryPurpose': 'display', 'limitations': ['Synthetic test; not legal permission.'],
            'source': {'status': 'local_dataset', 'retrievedAt': '2001-01-01T00:00:00Z', 'activitiesUrl': ctx.activities_url, 'metadataUrl': ctx.metadata_url, 'geometryQueryUrl': ctx.query_url, 'nativeWkid': ctx.native_wkid, 'outputWkid': 4326}}
    levels = {}
    for name, tolerance in [('overview',100),('regional',10),('detail',1)]:
        levels[name] = {'algorithmVersion': 'coverage-lod-v1', 'purpose': 'display-only-not-analysis-or-export', 'level': name, 'toleranceMeters': tolerance, 'method': 'original_preserved', 'fallbackReason': 'coverage_invalid', 'sourceFeatureCount': 1, 'returnedFeatureCount': 1, 'originalVertices': 10, 'returnedVertices': 10, 'bbox': None, 'validation': {'featureIdsPreserved': True, 'geometryValid': True, 'coverageValid': False}}
    display_geometry = {'type':'Polygon','coordinates':geometry['coordinates'][:1]} if simplified else geometry
    if simplified:
        for info in levels.values():
            info.update(method='coverage_simplify',fallbackReason=None,returnedVertices=5)
            info['validation']['coverageValid']=True
    if empty:
        meta['counts'] = {'matched':0,'returned':0,'excludedInvalid':0}
        for info in levels.values():
            info.update(sourceFeatureCount=0,returnedFeatureCount=0,originalVertices=0,returnedVertices=0,fallbackReason=None)
            info['validation']['coverageValid']=None
    model = {'schemaVersion': 1, 'algorithmVersion': 'coverage-lod-v1', 'meta': meta, 'sourceBounds': None if empty else [120.12345678901234,-4,120.2,-3.9], 'levels': levels}
    version = conn.execute("""INSERT INTO rdtr.plan_version(plan_id,created_from_run_id,content_fingerprint,layer_path,native_srid,layer_metadata,geometry_scope,rules_scope,ingest_state,freshness_state,source_id_count,valid_feature_count,quarantined_feature_count,ids_reconciled,source_time)
    VALUES(%s,%s,%s,'synthetic',%s,%s,'filtered_subset','filter_membership_only','ready','dated_snapshot',1,1,0,true,'2001-01-01') RETURNING id""", (plan,run,fingerprint,ctx.native_wkid,Jsonb({'localReadModel': model} if prepared else {}))).fetchone()[0]
    if empty:
        conn.execute('UPDATE rdtr.plan_version SET source_id_count=0,valid_feature_count=0 WHERE id=%s',(version,))
    properties = {'object_id': 7,'plan_id': PLAN,'zone_code':'P-1','zone_name':'Synthetic','zone_group':'Synthetic','subzone_name':None,'filter_value':'P-1','activity_id':ctx.activity_id,'activity_name':ctx.activity_name,'permission':'allowed','evidence_status':'private','regulation':'Synthetic regulation','private':'DO_NOT_LEAK','blob_locator':'/private/DO_NOT_LEAK'}
    if not empty:
        feature = conn.execute("INSERT INTO rdtr.zone_feature(plan_version_id,source_object_id,source_properties,geometry_hash,geom_original_4326) VALUES(%s,7,%s,%s,ST_GeomFromGeoJSON(%s)) RETURNING id", (version,Jsonb(properties),digest(geometry),json.dumps(geometry))).fetchone()[0]
        conn.execute("INSERT INTO rdtr.zone_match_key VALUES(%s,%s,%s,'P-1')", (version,feature,ctx.filter_field))
        for level in range(3):
            conn.execute("""INSERT INTO rdtr.zone_display(plan_version_id,zone_feature_id,level,algorithm_version,source_geometry_hash,method,parameters,fallback_reason,qc_state,qc_result,geom_display_4326)
            VALUES(%s,%s,%s,'coverage-lod-v1',%s,'original_preserved',%s,'coverage_invalid','fallback',%s,ST_GeomFromGeoJSON(%s))""", (version,feature,level,digest(geometry),Jsonb({'toleranceMeters':[100,10,1][level]}),Jsonb(levels[['overview','regional','detail'][level]]['validation']),json.dumps(display_geometry)))
    if simplified:
        conn.execute("UPDATE rdtr.zone_display SET method='coverage_simplify',fallback_reason=null,qc_state='passed' WHERE plan_version_id=%s",(version,))
    conn.execute("""UPDATE rdtr.zone_display d SET qc_result=d.qc_result || jsonb_build_object(
        'modelHash',%s::text,'originalEWKBHash',encode(sha256(ST_AsEWKB(f.geom_original_4326)),'hex'),
        'displayEWKBHash',encode(sha256(ST_AsEWKB(d.geom_display_4326)),'hex'))
        FROM rdtr.zone_feature f WHERE d.zone_feature_id=f.id AND d.plan_version_id=%s""", (digest(model),version))
    activity = conn.execute("INSERT INTO rdtr.local_activity(plan_version_id,source_activity_id,name) VALUES(%s,%s,%s) RETURNING id", (version,ctx.activity_id,ctx.activity_name)).fetchone()[0]
    conn.execute("INSERT INTO rdtr.kbli_entry VALUES('2025','01273','Synthetic only',null,'{}') ON CONFLICT DO NOTHING")
    mapping = conn.execute("INSERT INTO rdtr.kbli_activity_mapping(plan_version_id,local_activity_id,kbli_version,kbli_code,scope_key,basis) VALUES(%s,%s,'2025','01273','budidaya-kakao','Synthetic only') RETURNING id", (version,activity)).fetchone()[0]
    conn.execute('UPDATE rdtr.plan_version SET published_at=now() WHERE id=%s', (version,))
    conn.execute('UPDATE rdtr.kbli_activity_mapping SET published_at=now() WHERE id=%s', (mapping,))
    manifest = {'schemaVersion':1,'sourceKind':'local_dataset','algorithmVersion':'coverage-lod-v1','partial':True,'plans':[{'planId':PLAN,'planVersionId':str(version),'contentFingerprint':fingerprint,'mappingId':str(mapping),'mappingRevision':1,'geometryScope':'filtered_subset','rulesScope':'filter_membership_only'}]}
    release_hash = digest(manifest)
    release = conn.execute("INSERT INTO rdtr.dataset_release(manifest_hash,manifest,partial_release) VALUES(%s,%s,true) RETURNING id", (release_hash,Jsonb(manifest))).fetchone()[0]
    conn.execute("INSERT INTO rdtr.release_plan_version(release_id,plan_id,plan_version_id,geometry_scope,rules_scope,ingest_state,mapping_review_state,freshness_state,known_available_feature_count) VALUES(%s,%s,%s,'filtered_subset','filter_membership_only','ready','unreviewed','dated_snapshot',1)", (release,plan,version))
    if empty:
        conn.execute('UPDATE rdtr.release_plan_version SET known_available_feature_count=0 WHERE release_id=%s',(release,))
    conn.execute('INSERT INTO rdtr.release_mapping VALUES(%s,%s,%s,%s)', (release,mapping,plan,version))
    conn.execute("UPDATE rdtr.dataset_release SET status='published',published_at=now(),published_by='synthetic-test' WHERE id=%s", (release,))
    if activate:
        conn.execute("INSERT INTO rdtr.active_release(channel,release_id,activated_by) VALUES('exploration',%s,'synthetic-test') ON CONFLICT(channel) DO UPDATE SET release_id=excluded.release_id", (release,))
    return {'release':str(release),'release_hash':release_hash,'version':str(version),'mapping':str(mapping),'geometry':geometry,'model':model}


class SQLFixture(unittest.TestCase):
    def setUp(self):
        config = ROOT / 'private/rdtr-db/connection.json'
        if not config.exists():
            self.skipTest('isolated test DB configuration unavailable')
        self.conn = psycopg.connect(load_dsn(config, 'test'))
        self.addCleanup(self.conn.close)
        self.addCleanup(self.conn.rollback)
        self.assertEqual(self.conn.execute('SELECT current_database()').fetchone()[0], 'siap_izin_test')
        self.conn.execute('SELECT pg_advisory_lock(%s)', (LOCK,))
        self.conn.execute("SET LOCAL statement_timeout='30s'")
        self.conn.execute("SET LOCAL lock_timeout='5s'")
        self.conn.execute('DROP SCHEMA IF EXISTS rdtr CASCADE')
        migrate(self.conn)

    def api(self):
        self.assertTrue((ROOT/'tools/rdtr_local_api.py').exists(), 'SQL-only local API missing')
        return importlib.import_module('rdtr_local_api')


class LocalAPITests(SQLFixture):
    def test_catalog_storage_observation_is_separate_from_active_release(self):
        first = seed(self.conn)
        second = seed(self.conn, activate=False, fingerprint='b'*64)
        result = self.api().get_catalog(self.conn)
        plan = next(p for p in result['plans'] if p['id'] == PLAN)
        self.assertEqual(plan['localStorage'], {'state':'stored'})
        self.assertEqual(plan['localDataset']['planVersionId'], first['version'])
        absent = next(p for p in result['plans'] if p['id'] != PLAN)
        self.assertEqual(absent['localStorage'], {'state':'not_stored'})
        states = self.api().get_storage_states(self.conn, [plan, absent])
        self.assertEqual(states, {PLAN:'stored', absent['id']:'not_stored'})
        wrong = dict(plan, regionId='7401000000')
        self.assertEqual(self.api().get_storage_states(self.conn, [wrong]), {PLAN:'not_stored'})
        self.assertNotIn('localStorage', json.dumps(self.api().get_display(self.conn, PLAN, 'overview', first['release_hash'])))

    def test_candidate_catalog_uses_exact_release_without_active_fallback(self):
        first = seed(self.conn)
        second = seed(self.conn, activate=False, fingerprint='b'*64)
        api = self.api()
        candidate = api.get_catalog_for_release(self.conn, second['release_hash'])
        self.assertEqual(candidate['localDataset']['releaseHash'], second['release_hash'])
        self.assertEqual(api.get_catalog(self.conn)['localDataset']['releaseHash'], first['release_hash'])
        self.conn.execute('DELETE FROM rdtr.active_release')
        self.assertEqual(api.get_catalog_for_release(self.conn, second['release_hash']), candidate)
        with self.assertRaises(legacy.APIError):
            api.get_catalog_for_release(self.conn, 'f'*64)

    def test_catalog_complete_with_honest_availability(self):
        f = seed(self.conn)
        result = self.api().get_catalog(self.conn)
        self.assertEqual((len(result['regions']),len(result['plans'])), (17,18))
        self.assertEqual(result['localDataset'], {'sourceKind':'local_dataset','releaseId':f['release'],'releaseHash':f['release_hash'],'partial':True})
        available = [p for p in result['plans'] if p['localDataset']['available']]
        self.assertEqual([p['id'] for p in available], [PLAN])
        self.assertEqual(available[0]['localDataset']['snapshotId'], digest({'releaseHash':f['release_hash'],'planVersionId':f['version'],'mappingId':f['mapping'],'algorithmVersion':'coverage-lod-v1'}))
        original = json.loads(legacy.CATALOG_BYTES)
        self.assertEqual([p['activity'] for p in result['plans']], [p['activity'] for p in original['plans']])

    def test_display_precomputed_precision_original_intersection_and_privacy(self):
        f = seed(self.conn)
        api = self.api()
        with patch.object(legacy.ZoneService, 'get_zones', side_effect=AssertionError('upstream forbidden')), patch('urllib.request.urlopen', side_effect=AssertionError('network forbidden')), patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('network forbidden')):
            result = api.get_display(self.conn, PLAN, 'overview', f['release_hash'])
            empty = api.get_display(self.conn, PLAN, 'detail', f['release_hash'], [120.15,-3.97,120.16,-3.96])
        self.assertEqual(result['features'][0]['geometry'], f['geometry'])
        self.assertEqual(result['meta']['display']['returnedVertices'], 10)
        self.assertEqual(result['meta']['source']['retrievedAt'], '2001-01-01T00:00:00Z')
        self.assertEqual(result['meta']['source']['status'], 'local_dataset')
        p = result['features'][0]['properties']
        self.assertEqual(set(p), set(PROPERTY_KEYS)|{'permission','evidence_status','source_bounds'})
        self.assertEqual((p['permission'],p['evidence_status']), ('unknown','unreviewed_mapping'))
        self.assertNotIn('DO_NOT_LEAK', json.dumps(result))
        self.assertEqual(empty['features'], [])
        self.assertEqual(empty['meta']['display']['returnedVertices'], 0)
        self.assertEqual(empty['meta']['sourceCounts'], {'matched':1,'returned':1,'excludedInvalid':0})
        self.assertEqual(empty['meta']['display']['method'], 'original_preserved')
        self.assertEqual(empty['meta']['display']['fallbackReason'], 'coverage_invalid')
        self.assertEqual(result['meta']['dataset']['planVersionId'], f['version'])

    def test_detail_is_attribute_allowlist_and_valid_snapshot_conflict(self):
        f = seed(self.conn)
        api = self.api()
        inventory = api.get_display(self.conn, PLAN, 'overview', f['release_hash'])
        snapshot = inventory['meta']['snapshotId']
        value = api.get_feature_detail(self.conn, PLAN, 7, snapshot, f['release_hash'])
        self.assertEqual(value['properties']['regulation'], 'Synthetic regulation')
        self.assertEqual(value['properties']['permission'], 'unknown')
        self.assertEqual(set(value['properties']),set(PROPERTY_KEYS)|{'permission','evidence_status','source_bounds','regulation'})
        self.assertNotIn('"geometry":',json.dumps(value))
        self.assertNotIn('DO_NOT_LEAK',json.dumps(value))
        for token,status in [('f'*64,409),('F'*64,400),('%61'*64,400)]:
            with self.assertRaises(legacy.APIError) as raised:
                api.get_feature_detail(self.conn, PLAN, 7, token, f['release_hash'])
            self.assertEqual(raised.exception.status,status)
        with self.assertRaises(legacy.APIError) as raised:
            api.get_feature_detail(self.conn, PLAN, 8, snapshot, f['release_hash'])
        self.assertEqual(raised.exception.status,404)

    def test_old_published_release_survives_pointer_change_and_deactivation(self):
        first=seed(self.conn)
        api=self.api()
        before=api.get_display(self.conn,PLAN,'overview',first['release_hash'])
        second=seed(self.conn,fingerprint='b'*64)
        self.assertEqual(api.get_catalog(self.conn)['localDataset']['releaseHash'],second['release_hash'])
        self.assertEqual(api.get_display(self.conn,PLAN,'overview',first['release_hash']),before)
        self.conn.execute('DELETE FROM rdtr.active_release')
        with self.assertRaises(legacy.APIError) as raised:api.get_catalog(self.conn)
        self.assertEqual(raised.exception.status,503)
        self.assertEqual(api.get_display(self.conn,PLAN,'overview',first['release_hash']),before)

    def test_readonly_role_and_fail_closed_parameters(self):
        f=seed(self.conn)
        api=self.api()
        self.conn.execute('SET LOCAL ROLE siap_izin_readonly')
        self.assertEqual(api.get_catalog(self.conn)['localDataset']['releaseHash'],f['release_hash'])
        self.assertEqual(len(api.get_display(self.conn,PLAN,'detail',f['release_hash'])['features']),1)
        for plan,level,release,bbox,status in [(PLAN,'detail','f'*64,None,404),('7406000000:001','detail',f['release_hash'],None,422),(PLAN,'BAD',f['release_hash'],None,400),(PLAN,'detail','A'*64,None,400),(PLAN,'detail',f['release_hash'],[120,0,119,1],400),(PLAN,'detail',f['release_hash'],[True,0,1,2],400)]:
            with self.assertRaises(legacy.APIError) as raised:api.get_display(self.conn,plan,level,release,bbox)
            self.assertEqual(raised.exception.status,status)
        with self.assertRaises(psycopg.errors.InsufficientPrivilege):
            with self.conn.transaction():self.conn.execute("DELETE FROM rdtr.active_release")

    def test_unprepared_published_member_is_unavailable(self):
        f=seed(self.conn,prepared=False)
        api=self.api()
        for call in [lambda:api.get_catalog(self.conn),lambda:api.get_display(self.conn,PLAN,'overview',f['release_hash'])]:
            with self.assertRaises(legacy.APIError) as raised:call()
            self.assertEqual(raised.exception.status,503)

    def test_corrupt_sealed_identities_inventory_and_geometry_fail_closed(self):
        f=seed(self.conn)
        api=self.api()
        cases=[
            ('dataset_release',"UPDATE rdtr.dataset_release SET manifest=manifest || '{\"partial\":false}'::jsonb"),
            ('release_mapping','DELETE FROM rdtr.release_mapping'),
            ('zone_display','DELETE FROM rdtr.zone_display WHERE level=2'),
            ('zone_display',"UPDATE rdtr.zone_display SET source_geometry_hash=repeat('f',64)"),
            ('zone_display',"UPDATE rdtr.zone_display SET qc_state='unknown'"),
            ('zone_display',"UPDATE rdtr.zone_display SET parameters='{}'"),
            ('zone_display',"UPDATE rdtr.zone_display SET geom_display_4326=ST_Translate(geom_display_4326,0.001,0)"),
            ('zone_display',"UPDATE rdtr.zone_display SET qc_result=qc_result-'modelHash'"),
            ('plan_version',"UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{localReadModel,meta,source,retrievedAt}','\"2026-10-28T00:00:00Z\"')"),
        ]
        for table,sql in cases:
            with self.subTest(table=table,sql=sql),self.conn.transaction(force_rollback=True):
                self.conn.execute('ALTER TABLE rdtr.'+table+' DISABLE TRIGGER USER')
                self.conn.execute(sql)
                with self.assertRaises(legacy.APIError) as raised:api.get_display(self.conn,PLAN,'overview',f['release_hash'])
                self.assertEqual(raised.exception.status,503)

    def test_malformed_prepared_metadata_is_generic_unavailable(self):
        f=seed(self.conn)
        api=self.api()
        with self.conn.transaction(force_rollback=True):
            self.conn.execute('ALTER TABLE rdtr.plan_version DISABLE TRIGGER USER')
            self.conn.execute("UPDATE rdtr.plan_version SET layer_metadata=jsonb_set(layer_metadata,'{localReadModel,meta,filterZoneCodes}','[{}]')")
            with self.assertRaises(legacy.APIError) as raised:api.get_catalog(self.conn)
            self.assertEqual(raised.exception.status,503)

    def test_empty_prepared_release_keeps_empty_metadata_truthful(self):
        f=seed(self.conn,empty=True)
        result=self.api().get_display(self.conn,PLAN,'overview',f['release_hash'])
        self.assertEqual(result['features'],[])
        meta=result['meta']
        self.assertIsNone(meta['sourceBounds'])
        self.assertEqual(meta['counts'],{'matched':0,'returned':0,'excludedInvalid':0})
        self.assertEqual(meta['display']['method'],'original_preserved')
        self.assertIsNone(meta['display']['fallbackReason'])
        self.assertIsNone(meta['display']['validation']['coverageValid'])
        self.assertEqual(meta['display']['returnedVertices'],0)

    def test_viewport_intersects_original_not_precomputed_display(self):
        f=seed(self.conn,simplified=True)
        api=self.api()
        full=api.get_display(self.conn,PLAN,'overview',f['release_hash'])
        self.assertEqual(full['meta']['display']['method'],'coverage_simplify')
        self.assertEqual(full['meta']['display']['returnedVertices'],5)
        self.assertEqual(len(full['features'][0]['geometry']['coordinates']),1)
        empty=api.get_display(self.conn,PLAN,'overview',f['release_hash'],[120.15,-3.97,120.16,-3.96])
        self.assertEqual(empty['features'],[])
