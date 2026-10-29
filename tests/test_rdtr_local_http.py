"""Real loopback HTTP with uncommitted, SQL-backed synthetic fixture adapter."""
import contextlib
import http.client
import importlib
import json
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch

from test_rdtr_local_api import SQLFixture, PLAN, ROOT, seed, legacy


class LocalHTTPTests(SQLFixture):
    def start(self, *, factory=None):
        self.assertTrue((ROOT/'tools/rdtr_local_server.py').exists(),'independent local HTTP server missing')
        module = importlib.import_module('rdtr_local_server')
        # Serialize real SQL access in HTTP threads without committing a fixture.
        lock = threading.Lock()
        @contextlib.contextmanager
        def shared_sql():
            with lock:
                with self.conn.transaction():
                    yield self.conn
        self.server = module.make_server(port=0,connection_factory=factory or shared_sql)
        thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(thread.join,5)
        self.addCleanup(self.server.shutdown)
        return module

    def request(self,path,method='GET',headers=None):
        conn = http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=10)
        try:
            conn.request(method,path,headers=headers or {})
            response=conn.getresponse()
            return response.status,dict(response.getheaders()),response.read()
        finally:
            conn.close()

    def test_sql_catalog_display_detail_via_loopback(self):
        f=seed(self.conn)
        self.start()
        with patch.object(legacy.ZoneService,'get_zones',side_effect=AssertionError('source forbidden')),patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('network forbidden')):
            status,headers,body=self.request('/api/catalog?kbli=01273')
            self.assertEqual(status,200)
            catalog=json.loads(body)
            self.assertEqual(len(catalog['plans']),18)
            self.assertEqual(headers['Cache-Control'],'no-store')
            prefix='/api/display?plan='+PLAN+'&kbli=01273&level=overview&release='+f['release_hash']
            status,_,body=self.request(prefix)
            self.assertEqual(status,200)
            display=json.loads(body)
            self.assertEqual(display['features'][0]['geometry'],f['geometry'])
            status,_,body=self.request('/api/feature-detail?plan='+PLAN+'&kbli=01273&objectId=7&snapshot='+display['meta']['snapshotId']+'&release='+f['release_hash'])
            self.assertEqual(status,200)
            self.assertNotIn('"geometry":',body.decode())
            self.assertNotIn('DO_NOT_LEAK',body.decode())

    def test_http_negative_tokens_routes_origins_and_static_allowlist(self):
        f=seed(self.conn)
        self.start()
        valid='/api/display?plan='+PLAN+'&kbli=01273&level=overview&release='+f['release_hash']
        for path,status in [(valid+'&release='+f['release_hash'],400),(valid+'&wat=1',400),(valid.replace('overview','Overview'),400),(valid.replace(PLAN,PLAN.replace(':','%3A')),400),(valid.replace(f['release_hash'],'F'*64),400),(valid.replace(f['release_hash'],'f'*64),404),(valid.replace(PLAN,'7406000000:001'),422),(valid+'&bbox=120.15,-3.97,120.16,-3.96',200),('/api/catalog?kbli=01273&kbli=01273',400),('/api/zones?plan='+PLAN+'&kbli=01273',404),('/prototype/test-output/results.json',404),('/prototype/../tools/rdtr-plans.json',404),('/prototype/.secret',404),('/prototype/index.html?x=1',404),('/prototype/index.html',200),('//api/catalog?kbli=01273',400)]:
            with self.subTest(path=path):self.assertEqual(self.request(path)[0],status)
        self.assertEqual(self.request(valid,headers={'Host':'evil.example'})[0],403)
        self.assertEqual(self.request(valid,headers={'Origin':'http://evil.example'})[0],403)
        for method in ('POST','PUT','PATCH','DELETE','OPTIONS','HEAD','TRACE','CONNECT'):
            self.assertEqual(self.request(valid,method=method)[0],405)
        detail='/api/feature-detail?plan='+PLAN+'&kbli=01273&objectId=7&snapshot='+'f'*64+'&release='+f['release_hash']
        self.assertEqual(self.request(detail)[0],409)
        self.assertEqual(self.request(detail.replace('objectId=7','objectId=07'))[0],400)
        self.assertEqual(self.request(detail.replace('snapshot='+'f'*64,'snapshot='+'F'*64))[0],400)

    def test_no_active_and_database_outage_are_generic_and_no_fallback(self):
        self.start()
        status,_,body=self.request('/api/catalog?kbli=01273')
        self.assertEqual(status,503)
        self.assertEqual(json.loads(body),{'error':{'code':'dataset_unavailable'}})
        def broken():raise RuntimeError('secret DSN /private/DO_NOT_LEAK')
        self.server.connection_factory=broken
        status,_,body=self.request('/api/catalog?kbli=01273')
        self.assertEqual(status,503)
        self.assertNotIn('DO_NOT_LEAK',body.decode())

    def test_default_factory_uses_reader_only_and_readonly_transaction(self):
        module=self.start()
        with patch.object(module,'load_dsn',side_effect=ValueError('reader missing')) as load,patch.object(module.psycopg,'connect',side_effect=AssertionError('owner fallback forbidden')) as connect:
            with self.assertRaises(ValueError):
                with module.default_connection_factory():pass
            self.assertEqual(load.call_args.kwargs,{'kind':'reader'})
            connect.assert_not_called()

    def test_static_symlink_and_duplicate_host_are_rejected(self):
        self.start()
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            secret=root/'secret.txt';secret.write_text('DO_NOT_LEAK')
            public=root/'public';public.mkdir()
            (public/'index.html').symlink_to(secret)
            self.server.prototype_dir=public
            self.assertEqual(self.request('/prototype/index.html')[0],404)
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=10)
        try:
            conn.putrequest('GET','/api/catalog?kbli=01273')
            conn.putheader('Host',f'localhost:{self.server.server_port}')
            conn.endheaders()
            self.assertEqual(conn.getresponse().status,403)
        finally:conn.close()

    def test_sql_timeout_is_bounded_and_generic(self):
        module=self.start()
        def delayed(conn):
            self.assertEqual(conn.execute('SHOW statement_timeout').fetchone()[0],'3s')
            self.assertEqual(conn.execute('SHOW lock_timeout').fetchone()[0],'1s')
            conn.execute('SELECT pg_sleep(8)')
        with patch.object(module.api,'get_catalog',side_effect=delayed):
            status,_,body=self.request('/api/catalog?kbli=01273')
        self.assertEqual(status,503)
        self.assertEqual(json.loads(body),{'error':{'code':'dataset_unavailable'}})
        self.assertEqual(self.conn.execute('SELECT 1').fetchone()[0],1)
