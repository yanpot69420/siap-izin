"""Synthetic private connection configuration tests; no database is contacted."""
import importlib,json,sys,tempfile,unittest,traceback
from unittest.mock import patch
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

class ConnectionConfigTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.path=Path(self.temp.name)/'connection.json'
  self.dsn='host=127.0.0.1 port=54339 dbname=siap_izin_dev user=siap_izin_owner password=synthetic-fixture-only connect_timeout=8'
  self.path.write_text(json.dumps({'owner_dsn':self.dsn}));self.path.chmod(0o600)
 def subject(self):
  self.assertTrue((ROOT/'tools/rdtr_connection.py').is_file(),'private connection loader is not implemented')
  return importlib.import_module('tools.rdtr_connection')
 def test_loads_owner_dsn_from_owner_only_file(self):
  self.assertEqual(self.subject().load_dsn(self.path,'owner'),self.dsn)

 def test_rejects_group_readable_configuration(self):
  self.path.chmod(0o640)
  with self.assertRaises(ValueError):self.subject().load_dsn(self.path,'owner')

 def test_rejects_dsn_outside_local_development_boundary(self):
  bad=[self.dsn.replace('127.0.0.1','192.0.2.10'),self.dsn.replace('54339','5432'),self.dsn.replace('dbname=siap_izin_dev','dbname=postgres'),self.dsn+' hostaddr=192.0.2.10',self.dsn+' service=external_service',self.dsn.replace('user=siap_izin_owner','user=postgres')]
  for value in bad:
   with self.subTest(case=bad.index(value)):
    self.path.write_text(json.dumps({'owner_dsn':value}))
    with self.assertRaises(ValueError):self.subject().load_dsn(self.path,'owner')

 def test_rejects_symbolic_link_configuration(self):
  link=Path(self.temp.name)/'connection-link.json';link.symlink_to(self.path)
  with self.assertRaises(ValueError):self.subject().load_dsn(link,'owner')

 def assert_sanitized_failure(self,kind: object='owner'):
  try:self.subject().load_dsn(self.path,kind)
  except Exception as exc:
   formatted=''.join(traceback.format_exception(type(exc),exc,exc.__traceback__,chain=True))
   self.assertNotIn('SYNTHETIC_SECRET_SUFFIX',formatted)
   self.assertIsInstance(exc,ValueError)
   self.assertIsNone(exc.__cause__)
   self.assertIsNone(exc.__context__)
  else:self.fail('invalid synthetic configuration was accepted')
 def test_malformed_dsn_has_no_secret_in_full_exception_chain(self):
  self.path.write_text(json.dumps({'owner_dsn':self.dsn+' SYNTHETIC_SECRET_SUFFIX'}))
  self.assert_sanitized_failure()
 def test_malformed_json_is_sanitized(self):
  for value in ('{"SYNTHETIC_SECRET_SUFFIX":', '{"owner_dsn":"\\qSYNTHETIC_SECRET_SUFFIX"}', b'{"owner_dsn":"SYNTHETIC_SECRET_SUFFIX\xff"}'):
   with self.subTest(case=type(value).__name__):
    self.path.write_bytes(value if isinstance(value,bytes) else value.encode())
    self.assert_sanitized_failure()
 def test_wrong_kind_and_configuration_types_are_sanitized(self):
  for kind in ('SYNTHETIC_SECRET_SUFFIX',None,[],{}):
   with self.subTest(kind_type=type(kind).__name__):self.assert_sanitized_failure(kind)
  for value in ([],None,'SYNTHETIC_SECRET_SUFFIX',{'owner_dsn':None},{'owner_dsn':42},{'owner_dsn':['SYNTHETIC_SECRET_SUFFIX']},{'owner_dsn':{'SYNTHETIC_SECRET_SUFFIX':True}},{}):
   with self.subTest(value_type=type(value).__name__):
    self.path.write_text(json.dumps(value));self.assert_sanitized_failure()
 def test_json_parser_exception_text_and_chain_are_not_exposed(self):
  module=self.subject()
  with patch.object(module.json,'load',side_effect=ValueError('SYNTHETIC_SECRET_SUFFIX')):
   self.assert_sanitized_failure()
 def test_test_and_reader_kinds_keep_existing_dsn_contract(self):
  module=self.subject()
  values={'test_dsn':self.dsn.replace('dbname=siap_izin_dev','dbname=siap_izin_test'),'reader_dsn':self.dsn.replace('user=siap_izin_owner','user=siap_izin_reader')}
  self.path.write_text(json.dumps(values))
  for kind in ('test','reader'):self.assertEqual(module.load_dsn(self.path,kind),values[kind+'_dsn'])
if __name__=='__main__':unittest.main()
