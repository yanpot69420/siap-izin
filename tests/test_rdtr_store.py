"""Real isolated PostGIS integration; input fixture is explicitly synthetic."""
import importlib,json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tools'));sys.path.insert(0,str(ROOT/'tests'))
try:
 import psycopg
except ImportError:
 psycopg=None
from test_rdtr_snapshot import fixture,pack
import rdtr_snapshot
from tools.rdtr_connection import load_dsn
from tools.rdtrdb.migrations import migrate

class StoreTests(unittest.TestCase):
 def setUp(self):
  config=ROOT/'private/rdtr-db/connection.json'
  if psycopg is None or not config.exists():self.skipTest('isolated PostGIS test configuration unavailable')
  self.conn=psycopg.connect(load_dsn(config,'test'));self.addCleanup(self.conn.close);self.addCleanup(self.conn.rollback)
  self.assertEqual(self.conn.execute('SELECT current_database()').fetchone()[0],'siap_izin_test')
  self.conn.execute("SET LOCAL statement_timeout='30s'");self.conn.execute("SET LOCAL lock_timeout='5s'")
  self.conn.execute('DROP SCHEMA IF EXISTS rdtr CASCADE');migrate(self.conn)
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.path=Path(self.temp.name)/'synthetic.json';self.path.write_bytes(pack(fixture()))
  self.snapshot=rdtr_snapshot.read_snapshot(self.path);self.blobs=Path(self.temp.name)/'blobs'
 def subject(self):
  self.assertTrue((ROOT/'tools/rdtr_store.py').exists(),'database snapshot ingestion is not implemented')
  return importlib.import_module('rdtr_store')
 def test_imports_validated_archived_subset_without_publishing(self):
  result=self.subject().import_snapshot(self.conn,self.snapshot,self.blobs,batch_key='synthetic-test')
  self.assertTrue(result['created_version']);self.assertEqual(result['geometry_scope'],'filtered_subset')
  self.assertEqual(result['valid_features'],1)
  row=self.conn.execute('SELECT source_object_id,source_properties,ST_SRID(geom_original_4326) FROM rdtr.zone_feature').fetchone()
  self.assertEqual(row[0],7);self.assertEqual(row[1],self.snapshot.features[0]['properties']);self.assertEqual(row[2],4326)
  self.assertEqual(self.conn.execute('SELECT source_activity_id FROM rdtr.local_activity').fetchone()[0],'041')
  self.assertEqual(self.conn.execute('SELECT permission_status FROM rdtr.activity_zone_rule').fetchone()[0],'unknown')
  self.assertEqual(self.conn.execute('SELECT kind FROM rdtr.source_artifact').fetchone()[0],'validated_source_cache')
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.active_release').fetchone()[0],0)
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.dataset_release').fetchone()[0],0)
 def test_reimport_same_content_reuses_version_and_records_observation(self):
  module=self.subject();first=module.import_snapshot(self.conn,self.snapshot,self.blobs)
  raw=fixture();raw['data']['payload']['meta']['source']['retrievedAt']='2002-01-01T00:00:00Z'
  self.path.write_bytes(pack(raw));changed_time=rdtr_snapshot.read_snapshot(self.path)
  second=module.import_snapshot(self.conn,changed_time,self.blobs)
  self.assertFalse(second['created_version']);self.assertEqual(first['plan_version_id'],second['plan_version_id'])
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_feature').fetchone()[0],1)
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.plan_observation').fetchone()[0],2)
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.source_artifact').fetchone()[0],2)
  self.assertEqual(self.conn.execute("SELECT result FROM rdtr.plan_observation ORDER BY observed_at,id").fetchall().count(('content_same',)),1)
  self.assertEqual(self.conn.execute('SELECT extract(year from source_time) FROM rdtr.plan_version').fetchone()[0],2001)
 def test_quarantined_source_is_archived_not_inserted_as_valid_geometry(self):
  raw=fixture();invalid={'type':'Feature','id':8,'properties':{'OBJECTID':8,'KODSZN':'P-1','NAMSZN':'Synthetic','NAMZON':'Synthetic','NOTHPR':None},'geometry':{'type':'Polygon','coordinates':[[[120,-4],[120.001,-3.999],[120.001,-4],[120,-3.999],[120,-4]]]}}
  raw['data']['quarantine']=[{'object_id':8,'reason':'invalid_geometry','feature':invalid}]
  raw['data']['payload']['meta']['counts']={'matched':2,'returned':1,'excludedInvalid':1}
  self.path.write_bytes(pack(raw));snapshot=rdtr_snapshot.read_snapshot(self.path)
  receipt=self.subject().import_snapshot(self.conn,snapshot,self.blobs)
  self.assertEqual(receipt['quarantined_features'],1)
  self.assertEqual(self.conn.execute('SELECT source_id_count,valid_feature_count,quarantined_feature_count FROM rdtr.plan_version').fetchone(),(2,1,1))
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_feature').fetchone()[0],1)
  q=self.conn.execute('SELECT source_object_id,reason,feature_locator FROM rdtr.quarantined_feature').fetchone()
  self.assertEqual(q,(8,'invalid_geometry','/data/quarantine/0'))
 def test_source_oid_mutation_is_rejected_before_database_rows(self):
  self.snapshot.features[0]['properties']['object_id']=True
  with self.assertRaises(ValueError):self.subject().import_snapshot(self.conn,self.snapshot,self.blobs)
  for table in ('geo_region','rdtr_plan','import_run','plan_version','zone_feature'):
   self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.'+table).fetchone()[0],0)
 def test_reads_snapshot_bbox_without_upstream_or_geometry_payload(self):
  receipt=self.subject().import_snapshot(self.conn,self.snapshot,self.blobs)
  self.assertTrue((ROOT/'tools/rdtr_queries.py').exists(),'local database read queries are not implemented')
  queries=importlib.import_module('rdtr_queries')
  self.conn.execute('SET LOCAL ROLE siap_izin_readonly')
  status=queries.database_status(self.conn);self.assertEqual(status['stored_feature_rows'],1)
  result=queries.query_bbox(self.conn,receipt['plan_version_id'],(119,-5,121,-3),limit=1)
  self.assertEqual(result['matching_feature_count'],1);self.assertEqual(result['items'][0]['source_object_id'],7)
  self.assertFalse(result['has_more']);self.assertEqual(result['source_kind'],'local_dataset')
  self.assertNotIn('geometry',result['items'][0]);self.assertNotIn('source_properties',result['items'][0])
 def test_bbox_query_rejects_unbounded_limit_and_malformed_identifiers(self):
  receipt=self.subject().import_snapshot(self.conn,self.snapshot,self.blobs)
  queries=importlib.import_module('rdtr_queries');version=receipt['plan_version_id']
  for limit in (0,-1,501,True,'2'):
   with self.assertRaisesRegex(ValueError,'^invalid_query_parameters$'):
    queries.query_bbox(self.conn,version,(119,-5,121,-3),limit=limit)
  for bbox in ((121,-5,119,-3),(119,-5,181,-3),(119,float('nan'),121,-3),(119,-5,121),(True,-5,121,-3)):
   with self.assertRaisesRegex(ValueError,'^invalid_query_parameters$'):
    queries.query_bbox(self.conn,version,bbox)
  with self.assertRaisesRegex(ValueError,'^invalid_query_parameters$'):
   queries.query_bbox(self.conn,'{'+version+'}',(119,-5,121,-3))
 def test_import_cli_stages_real_sql_with_caller_owned_test_transaction(self):
  from contextlib import nullcontext,redirect_stdout,redirect_stderr
  from io import StringIO
  from unittest.mock import patch
  module=importlib.import_module('rdtr_database');out=StringIO();err=StringIO()
  with redirect_stdout(out),redirect_stderr(err),patch.object(module,'ROOT',Path(self.temp.name)),patch.object(module.psycopg,'connect',return_value=nullcontext(self.conn)):
   try:
    code=module.main(['--config',str(ROOT/'private/rdtr-db/connection.json'),'import-archive','--path',str(self.path),'--sha256',self.snapshot.artifact_sha256,'--plan-id',self.snapshot.plan_id])
   except SystemExit as exc:code=exc.code
  self.assertEqual(code,0,err.getvalue());receipt=json.loads(out.getvalue())
  self.assertTrue(receipt['created_version']);self.assertFalse(receipt['published'])
  self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.zone_feature').fetchone()[0],1)
 def test_bbox_hole_is_not_a_polygon_hit(self):
  raw=fixture();raw['data']['payload']['features'][0]['geometry']={'type':'Polygon','coordinates':[[[120,-4],[120.01,-4],[120.01,-3.99],[120,-3.99],[120,-4]],[[120.002,-3.998],[120.002,-3.992],[120.008,-3.992],[120.008,-3.998],[120.002,-3.998]]]}
  self.path.write_bytes(pack(raw));snapshot=rdtr_snapshot.read_snapshot(self.path)
  receipt=self.subject().import_snapshot(self.conn,snapshot,self.blobs)
  queries=importlib.import_module('rdtr_queries')
  result=queries.query_bbox(self.conn,receipt['plan_version_id'],(120.003,-3.997,120.004,-3.996))
  self.assertEqual(result['matching_feature_count'],0);self.assertEqual(result['items'],[])
 def test_database_rejection_rolls_back_entire_import(self):
  self.conn.execute("""CREATE FUNCTION rdtr.synthetic_reject_feature() RETURNS trigger
   LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic feature rejection'
   USING ERRCODE='23514'; END $$""")
  self.conn.execute('CREATE TRIGGER synthetic_reject BEFORE INSERT ON rdtr.zone_feature FOR EACH ROW EXECUTE FUNCTION rdtr.synthetic_reject_feature()')
  with self.assertRaises(psycopg.Error):self.subject().import_snapshot(self.conn,self.snapshot,self.blobs)
  for table in ('geo_region','rdtr_plan','import_run','plan_version','zone_feature'):
   self.assertEqual(self.conn.execute('SELECT count(*) FROM rdtr.'+table).fetchone()[0],0)
class SnapshotBoundaryTests(unittest.TestCase):
 def test_mutated_view_is_rejected_before_archive_or_database_access(self):
  from types import SimpleNamespace
  from unittest.mock import Mock
  import rdtr_store
  conn=SimpleNamespace(info=SimpleNamespace(dbname='siap_izin_test',host='127.0.0.1',port=54339),transaction=Mock(side_effect=AssertionError('database must not be reached')))
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)/'blobs';snapshot=rdtr_snapshot.read_snapshot_bytes(pack(fixture()))
   snapshot.features[0]['properties']['zone_name']='Mutation outside captured artifact'
   with self.assertRaisesRegex(ValueError,'^snapshot_mutated$'):
    rdtr_store.import_snapshot(conn,snapshot,root)
   self.assertFalse(root.exists());conn.transaction.assert_not_called()

 def test_type_only_mutation_cannot_hide_behind_python_numeric_equality(self):
  from types import SimpleNamespace
  from unittest.mock import Mock
  import rdtr_store
  conn=SimpleNamespace(info=SimpleNamespace(dbname='siap_izin_test',host='127.0.0.1',port=54339),transaction=Mock(side_effect=AssertionError('database must not be reached')))
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)/'blobs';snapshot=rdtr_snapshot.read_snapshot_bytes(pack(fixture()))
   snapshot.features[0]['properties']['object_id']=7.0
   with self.assertRaisesRegex(ValueError,'^snapshot_mutated$'):
    rdtr_store.import_snapshot(conn,snapshot,root)
   self.assertFalse(root.exists());conn.transaction.assert_not_called()

if __name__=='__main__':unittest.main()
