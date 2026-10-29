"""CLI smoke tests on local development reads; no fixture reset or writes."""
import json,subprocess,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CLITests(unittest.TestCase):
 def test_status_reports_local_database_without_credentials(self):
  if not (ROOT/'private/rdtr-db/connection.json').exists():self.skipTest('local configuration unavailable')
  self.assertTrue((ROOT/'tools/rdtr_database.py').exists(),'local database CLI is missing')
  result=subprocess.run([sys.executable,'-B','tools/rdtr_database.py','status'],cwd=ROOT,capture_output=True,text=True,timeout=30)
  self.assertEqual(result.returncode,0,result.stderr)
  payload=json.loads(result.stdout);self.assertEqual(payload['source_kind'],'local_dataset')
  self.assertGreaterEqual(payload['stored_feature_rows'],0)
  self.assertNotIn('password',result.stdout.lower());self.assertNotIn('dsn',result.stdout.lower())
 def test_query_uses_pinned_version_and_bounded_response(self):
  if not (ROOT/'private/rdtr-db/connection.json').exists():self.skipTest('local configuration unavailable')
  status=subprocess.run([sys.executable,'-B','tools/rdtr_database.py','status'],cwd=ROOT,capture_output=True,text=True,timeout=30)
  self.assertEqual(status.returncode,0);versions=json.loads(status.stdout)['versions']
  if not versions:self.skipTest('no staged local versions')
  version=versions[0]['version_id']
  result=subprocess.run([sys.executable,'-B','tools/rdtr_database.py','query','--version',version,'--bbox','119,-6,124,-2','--limit','1'],cwd=ROOT,capture_output=True,text=True,timeout=30)
  self.assertEqual(result.returncode,0,result.stderr)
  payload=json.loads(result.stdout);self.assertEqual(payload['version_id'],version)
  self.assertLessEqual(payload['returned_count'],1)
  self.assertEqual(payload['has_more'],payload['matching_feature_count']>1)
if __name__=='__main__':unittest.main()
