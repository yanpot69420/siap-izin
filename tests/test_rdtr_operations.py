"""Operational safety fixtures: no Docker/database is contacted."""
import importlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=str(Path.home()/'.hermes/cache/scratch'))
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.root.chmod(0o700)

    def subject(self):
        self.assertTrue((ROOT/'tools/rdtr_operations.py').exists(), 'operations CLI missing')
        return importlib.import_module('tools.rdtr_operations')

    def test_private_path_rejects_traversal_symlinks_repo_and_existing_output(self):
        m = self.subject()
        link = self.root/'link'; link.symlink_to(self.root/'absent')
        for path in (self.root/'x'/'..'/'out', link/'out', ROOT/'private-output'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                m.output_path(path)
        out = self.root/'existing'; out.mkdir(mode=0o700)
        with self.assertRaises(ValueError): m.output_path(out)
        self.assertEqual(m.output_path(self.root/'new'), self.root/'new')

    def test_backup_is_private_complete_atomic_and_never_overwrites(self):
        from unittest.mock import patch
        m = self.subject()
        import hashlib
        raw = b'{"fixture":true}'
        digest = hashlib.sha256(raw).hexdigest()
        blobs = self.root/'source-blobs'; blobs.mkdir(mode=0o700)
        (blobs/(digest+'.json')).write_bytes(raw); (blobs/(digest+'.json')).chmod(0o600)
        inventory = {'tables': {'zone_feature': {'count': 1, 'sha256': digest}},
                     'source_ewkb': digest, 'active_pin': [],
                     'blobs': [{'sha256': digest, 'blob_locator': digest+'.json', 'byte_size': len(raw)}]}
        class FakeSession:
            snapshot = '00000003-00000001-1'
            def __init__(self, database): self.database = database
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def inventory(self): return inventory
        calls = []
        def fake_run(args, **kwargs):
            calls.append(args)
            kwargs['stdout'].write(b'PGDMP-fixture')
        out = self.root/'backup'
        with patch.object(m, 'Session', FakeSession), patch.object(m, 'run', fake_run):
            m.backup(out, blobs)
            with self.assertRaises(ValueError): m.backup(out, blobs)
        manifest = m.verify_bundle(out)
        self.assertEqual(manifest['inventory'], inventory)
        self.assertIn('--snapshot=00000003-00000001-1', calls[0])
        self.assertEqual(out.stat().st_mode & 0o777, 0o700)
        for p in out.rglob('*'):
            self.assertEqual(p.stat().st_mode & 0o777, 0o700 if p.is_dir() else 0o600)
        (out/'manifest.json').write_text('{}')
        with self.assertRaises(ValueError): m.verify_bundle(out)

    def test_backup_can_read_private_repository_blobs_but_never_write_bundle_into_repository(self):
        from unittest.mock import patch
        m = self.subject()
        repo = self.root/'checkout'; repo.mkdir(mode=0o700)
        blobs = repo/'private'; blobs.mkdir(mode=0o700)
        raw = b'private-input-fixture'; sha = m.digest(raw)
        (blobs/(sha+'.json')).write_bytes(raw); (blobs/(sha+'.json')).chmod(0o600)
        inventory = {'tables': {}, 'source_ewkb': sha, 'active_pin': [],
                     'blobs': [{'sha256': sha, 'blob_locator': sha+'.json', 'byte_size': len(raw)}]}
        class FakeSession:
            snapshot = '1-1-1'
            def __init__(self, database): pass
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def inventory(self): return inventory
        def dump(args, **kwargs): kwargs['stdout'].write(b'PGDMP-fixture')
        with patch.object(m, 'REPO', repo), patch.object(m, 'Session', FakeSession), patch.object(m, 'run', dump):
            out = self.root/'outside-bundle'
            m.backup(out, blobs)
            self.assertEqual((out/'blobs'/(sha+'.json')).read_bytes(), raw)
            with self.assertRaises(ValueError): m.backup(repo/'forbidden-output', blobs)
            self.assertFalse((repo/'forbidden-output').exists())

    def test_restore_only_creates_fresh_guarded_database_and_checks_inventory(self):
        from unittest.mock import patch
        import copy
        m = self.subject()
        inventory = {'tables': {'zone_feature': {'count': 2, 'sha256': 'a'*64}},
                     'source_ewkb': 'b'*64, 'active_pin': [{'release_id': 'fixture'}], 'blobs': []}
        source_before = copy.deepcopy(inventory)
        backup = self.root/'bundle'; backup.mkdir(mode=0o700)
        (backup/'database.dump').write_bytes(b'PGDMP-fixture'); (backup/'database.dump').chmod(0o600)
        calls = []
        class FakeSession:
            def __init__(self, database):
                self.database = database
                self.assert_target = m.RESTORE.fullmatch(database)
                if not self.assert_target: raise AssertionError('source connection forbidden in restore')
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def inventory(self): return copy.deepcopy(inventory)
            def query(self, sql): return '{"owner":"siap_izin_owner","marker":"rdtr-operations-v1"}'
        with patch.object(m, 'verify_bundle', return_value={'inventory': inventory}), patch.object(m, 'Session', FakeSession), patch.object(m, 'run', side_effect=lambda args, **kw: calls.append(args)):
            result = m.verify_restore(backup)
        self.assertTrue(result['verified'])
        self.assertRegex(result['database'], r'^siap_izin_restore_[0-9a-f]{12}$')
        self.assertEqual(inventory, source_before)
        self.assertTrue(any('createdb' in c for c in calls))
        self.assertTrue(any('pg_restore' in c for c in calls))
        self.assertFalse(any('--clean' in c or 'dropdb' in c or '--create' in c for c in calls))
        self.assertFalse(any('siap_izin_dev' in c or 'siap_izin_test' in c for c in calls))
        self.assertEqual(len(list(self.root.glob('restore-*.verified.json'))), 1)
        for target in ('siap_izin_dev', 'siap_izin_test', 'postgres', 'siap_izin_restore_bad', 'siap_izin_restore_'+'a'*12+';DROP DATABASE x'):
            with self.assertRaises(ValueError): m.create_restore(target)

    def test_private_read_rejects_hardlink_and_wide_permissions(self):
        m = self.subject()
        leaf = self.root/'leaf'; leaf.write_bytes(b'fixture'); leaf.chmod(0o640)
        with self.assertRaises(ValueError): m.private_read(leaf)
        leaf.chmod(0o600); os.link(leaf, self.root/'hardlink')
        with self.assertRaises(ValueError): m.private_read(leaf)

    def test_command_errors_never_expose_stderr_or_credentials(self):
        from unittest.mock import patch
        import subprocess
        m = self.subject()
        with patch.object(m.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, b'', b'password=SECRET')):
            with self.assertRaisesRegex(ValueError, '^docker_operation_failed$') as got: m.run(['fixture'])
        self.assertIsNone(got.exception.__context__)
        with patch.object(m.subprocess, 'run', side_effect=OSError('password=SECRET')):
            with self.assertRaisesRegex(ValueError, '^docker_operation_failed$') as got: m.run(['fixture'])
        self.assertIsNone(got.exception.__context__)

    def test_status_wal_whitelist_and_strict_numeric_projection(self):
        from unittest.mock import patch
        import json
        m=self.subject(); queries=[]
        wal={'settings':{'wal_level':'replica','archive_mode':'off','max_wal_size':1073741824,
                         'min_wal_size':83886080,'max_slot_wal_keep_size':-1},
             'directory_bytes':16777216,'slot_count':0,'max_retained_bytes':0}
        class FakeSession:
            def __init__(self, database): pass
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def query(self,sql):
                queries.append(sql)
                if 'pg_settings' in sql: return json.dumps(wal)
                if 'pg_database_size' in sql: return '12345'
                if 'pg_tables' in sql: return '["zone_feature"]'
                if 'count(*)' in sql: return '4'
                return '[]'
        with patch.object(m,'Session',FakeSession):
            result=m.status()
            self.assertEqual(result['wal'],wal)
            wal['settings']['archive_command']='SECRET'
            result=m.status()
            self.assertFalse(result['healthy'])
            self.assertEqual(result['wal'],{'safeErrorCode':'wal_metadata_invalid'})
            del wal['settings']['archive_command']; wal['slot_count']='SECRET'
            self.assertFalse(m.status()['healthy'])
        combined=' '.join(queries)
        self.assertIn('pg_ls_waldir',combined); self.assertIn('pg_replication_slots',combined)
        self.assertNotIn('archive_command',combined); self.assertNotIn('conninfo',combined)
        self.assertFalse(any(word in combined.upper() for word in ('ALTER ','INSERT ','DELETE ','UPDATE ')))

    def test_status_returns_counts_and_pin_without_blob_payload(self):
        from unittest.mock import patch
        m = self.subject()
        class FakeSession:
            def __init__(self, database): self.database = database
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def query(self, sql):
                if 'pg_database_size' in sql: return '12345'
                if 'pg_tables' in sql: return '["zone_feature"]'
                if 'count(*)' in sql: return '4'
                return '[{"release_id":"fixture-pin"}]'
        with patch.object(m, 'Session', FakeSession): result = m.status()
        self.assertEqual(result['counts'], {'zone_feature': 4})
        self.assertEqual(result['active_pin'], [{'release_id': 'fixture-pin'}])
        self.assertEqual(result['size_bytes'], 12345)
        self.assertNotIn('blobs', result)

    def test_cli_sanitizes_unexpected_errors(self):
        from unittest.mock import patch
        import contextlib, io
        m = self.subject(); out = io.StringIO()
        with patch.object(m, 'status', side_effect=RuntimeError('SECRET')), contextlib.redirect_stderr(out):
            self.assertEqual(m.main(['status']), 1)
        self.assertEqual(out.getvalue(), 'operations_failed\n')

    def test_atomic_publish_never_replaces_existing_empty_directory(self):
        m = self.subject()
        stage = self.root/'stage'; stage.mkdir(mode=0o700)
        out = self.root/'out'; out.mkdir(mode=0o700)
        (stage/'fixture').write_text('kept')
        with self.assertRaises(ValueError): m.publish(stage, out)
        self.assertTrue((stage/'fixture').exists())
        self.assertEqual(list(out.iterdir()), [])

    def test_private_reader_pins_ancestors_even_if_validation_races(self):
        from unittest.mock import patch
        m = self.subject()
        actual = self.root/'actual'; actual.mkdir(mode=0o700)
        leaf = actual/'leaf'; leaf.write_bytes(b'private'); leaf.chmod(0o600)
        link = self.root/'link'; link.symlink_to(actual, target_is_directory=True)
        with patch.object(m, 'safe_path', return_value=link/'leaf'):
            with self.assertRaises((ValueError, OSError)): m.private_read(link/'leaf')

    def test_tampered_bundle_prevents_any_database_creation(self):
        from unittest.mock import patch
        m = self.subject()
        backup = self.root/'bundle'; backup.mkdir(mode=0o700)
        (backup/'manifest.json').write_bytes(b'{}'); (backup/'manifest.json').chmod(0o600)
        (backup/'manifest.sha256').write_bytes(b'0'*64); (backup/'manifest.sha256').chmod(0o600)
        with patch.object(m, 'create_restore') as create:
            with self.assertRaises(ValueError): m.verify_restore(backup)
        create.assert_not_called()

    def test_backup_dump_failure_leaves_no_published_output(self):
        from unittest.mock import patch
        m = self.subject()
        blobs = self.root/'blobs'; blobs.mkdir(mode=0o700)
        class FakeSession:
            snapshot = '1-1-1'
            def __init__(self, database): pass
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def inventory(self): return {'blobs': []}
        with patch.object(m, 'Session', FakeSession), patch.object(m, 'run', side_effect=ValueError('docker_operation_failed')):
            with self.assertRaises(ValueError): m.backup(self.root/'failed-output', blobs)
        self.assertFalse((self.root/'failed-output').exists())
        self.assertEqual(len(list(self.root.glob('.rdtr-pending-*'))), 1)

class ProbeTests(unittest.TestCase):
    def subject(self): return importlib.import_module('tools.rdtr_operations')

    def payloads(self):
        import json
        m = self.subject()
        pin = {'available': True, 'releaseId': '11111111-1111-4111-8111-111111111111',
               'releaseHash': 'a'*64, 'planVersionId': '22222222-2222-4222-8222-222222222222',
               'mappingId': '33333333-3333-4333-8333-333333333333',
               'geometryScope': 'filtered_subset', 'rulesScope': 'filter_membership_only'}
        pin['snapshotId'] = m.digest(m.encoded({k: pin[k] for k in ('mappingId','planVersionId','releaseHash')} | {'algorithmVersion':'coverage-lod-v1'}))
        dataset = {k:v for k,v in pin.items() if k not in ('available','snapshotId')}
        dataset['sourceKind'] = 'local_dataset'
        meta = {'plan': {'id':'7411000000:001'}, 'kbli': {'code':'01273','version':'2025','scope':'budidaya-kakao'},
                'dataset':dataset, 'snapshotId':pin['snapshotId'], 'source':{'status':'local_dataset'}}
        props = {'object_id': 7, 'plan_id':'7411000000:001','permission':'unknown','evidence_status':'unreviewed_mapping'}
        catalog = {'localDataset':{k:dataset[k] for k in ('sourceKind','releaseId','releaseHash')} | {'partial':True},
                   'plans':[{'id':'7411000000:001','localDataset':pin}]}
        overview = {'type':'FeatureCollection','features':[{'id':7,'type':'Feature','properties':props,'geometry':{'SECRET':'must-not-output'}}], 'meta':meta}
        detail = {'schemaVersion':1,'planId':'7411000000:001','objectId':7,'snapshotId':pin['snapshotId'],'properties':props,'meta':meta}
        return [json.dumps(p).encode() for p in (catalog,overview,detail)]

    def probe_with(self, payloads, statuses=None):
        from unittest.mock import patch, MagicMock
        import io
        m = self.subject(); calls=[]
        self.assertTrue(callable(getattr(m, 'probe', None)), 'probe missing')
        statuses = statuses or [200]*len(payloads)
        connections=[]
        for raw, code in zip(payloads,statuses):
            response=MagicMock(); response.status=code; response.read.side_effect=io.BytesIO(raw).read
            conn=MagicMock(); conn.getresponse.return_value=response; connections.append(conn)
        with patch('http.client.HTTPConnection', side_effect=connections) as factory:
            result=m.probe('http://127.0.0.1:8769/prototype/')
        for conn in connections: calls.extend(conn.request.call_args_list)
        return result,calls,factory

    def test_probe_rejects_untrusted_urls_without_network(self):
        from unittest.mock import patch
        m=self.subject()
        with patch('http.client.HTTPConnection') as connection:
            for url in ('http://evil:8769/prototype/','http://127.0.0.1:8765/prototype/',
                        'https://127.0.0.1:8769/prototype/','http://u:p@localhost:8769/prototype/',
                        'http://localhost:8769/prototype/?x=1','http://localhost:8769/prototype/#x',
                        'http://127.1:8769/prototype/','http://localhost:8769/other'):
                with self.subTest(url=url):
                    r=m.probe(url); self.assertFalse(r['healthy'])
                    self.assertEqual(r['checks'][0]['safeErrorCode'],'url_guard')
            connection.assert_not_called()

    def test_probe_errors_are_bounded_sanitized_and_never_redirect(self):
        import json
        for code in (503,302):
            with self.subTest(code=code):
                result,calls,_=self.probe_with([b'SECRET'],[code])
                self.assertFalse(result['healthy']); self.assertEqual(len(calls),1)
                self.assertEqual(result['checks'][0]['status'],code)
                self.assertEqual(result['checks'][0]['safeErrorCode'],'http_status')
        for raw in (b'SECRET', b'1', b'{}', b'x'*(256*1024+1)):
            with self.subTest(size=len(raw)):
                result,calls,_=self.probe_with([raw])
                self.assertFalse(result['healthy']); self.assertEqual(len(calls),1)
                self.assertNotIn('SECRET',json.dumps(result))
        payloads=self.payloads(); payloads[1]=payloads[1].replace(b'a'*64,b'b'*64)
        result,calls,_=self.probe_with(payloads)
        self.assertFalse(result['healthy']); self.assertEqual(len(calls),2)
        self.assertEqual(result['checks'][-1]['safeErrorCode'],'pin_mismatch')

    def test_probe_cli_and_synthetic_latency_timeout(self):
        from unittest.mock import patch
        import contextlib, io, itertools, json
        m=self.subject()
        out=io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            try: code=m.main(['probe','--url','http://evil:8769/prototype/'])
            except SystemExit as error: code=error.code
        self.assertEqual(code,1)
        self.assertEqual(json.loads(out.getvalue())['checks'][0]['safeErrorCode'],'url_guard')
        with patch.object(m.time,'monotonic',side_effect=itertools.count(0,.125)):
            result,_,_=self.probe_with(self.payloads())
        self.assertTrue(result['healthy']); self.assertTrue(all(c['seconds']==.375 for c in result['checks']))
        with patch('http.client.HTTPConnection',side_effect=TimeoutError('SECRET')):
            result=m.probe('http://localhost:8770/prototype/')
        self.assertFalse(result['healthy']); self.assertEqual(result['checks'][0]['safeErrorCode'],'timeout')
        self.assertNotIn('SECRET',json.dumps(result))
        payloads=self.payloads(); payloads[1]=payloads[1].replace(b'"id": 7',b'"id": "SECRET"')
        result,calls,_=self.probe_with(payloads)
        self.assertFalse(result['healthy']); self.assertEqual(len(calls),2)

    def test_probe_captures_literal_pin_and_outputs_only_metrics(self):
        import json
        result,calls,factory=self.probe_with(self.payloads())
        self.assertTrue(result['healthy'])
        self.assertEqual(len(result['checks']),3)
        self.assertTrue(all(c['status']==200 and c['seconds']>=0 and c['bodyBytes']>0 and c['safeErrorCode'] is None for c in result['checks']))
        self.assertIn('release='+'a'*64,calls[1].args[1]); self.assertIn('release='+'a'*64,calls[2].args[1])
        self.assertIn('objectId=7',calls[2].args[1])
        self.assertIn('plan=7411000000:001',calls[1].args[1])
        self.assertNotIn('%',calls[1].args[1])
        self.assertNotIn('SECRET',json.dumps(result)); self.assertNotIn('geometry',json.dumps(result))
        self.assertEqual(factory.call_args_list[0].args,('127.0.0.1',8769))

if __name__ == '__main__': unittest.main()
