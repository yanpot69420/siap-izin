"""Independent GET-only loopback server for SQL-pinned local RDTR releases."""
import argparse
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import threading
from urllib.parse import urlsplit

import psycopg
from dev_server import APIError, encoded, parse_display_query, read_static
from rdtr_connection import load_dsn
import rdtr_local_api as api

ROOT = Path(__file__).resolve().parents[1]
STATIC = frozenset('/prototype/' + name for name in (
    'index.html','styles.css','zones.css','app.js','region-data.js','province-data.js',
    'map-style.js','zone-data.js','display-data.js','local-dataset.js','audit-summary.json')) | {'/prototype/'}


@contextmanager
def default_connection_factory():
    """A separate login is mandatory; no owner credential or SET ROLE fallback."""
    dsn = load_dsn(ROOT/'private/rdtr-db/connection.json', kind='reader')
    with psycopg.connect(dsn, connect_timeout=5) as conn:
        with conn.transaction():
            conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
            yield conn


def parse_query(query, *, detail=False):
    pairs = query.split('&')
    releases = [p[8:] for p in pairs if p.startswith('release=')]
    if len(releases)!=1 or re.fullmatch(r'[0-9a-f]{64}',releases[0]) is None:
        raise APIError('unsupported_query',400)
    # Reuse the unchanged strict literal parser, not the legacy service path.
    result = parse_display_query('&'.join(p for p in pairs if not p.startswith('release=')),detail=detail)
    result['release'] = releases[0]
    return result


def parse_batch_query(query):
    fields = {}
    for pair in query.split('&'):
        key, separator, value = pair.partition('=')
        if not separator or key not in ('kbli','level','release','plans') or key in fields:
            raise APIError('unsupported_query',400)
        fields[key] = value
    if (set(fields)!={'kbli','level','release','plans'} or fields['kbli']!='01273' or
            fields['level']!='overview' or re.fullmatch(r'[0-9a-f]{64}',fields['release']) is None):
        raise APIError('unsupported_query',400)
    plans = fields['plans'].split(',')
    if (not 1<=len(plans)<=16 or len(set(plans))!=len(plans) or
            any(re.fullmatch(r'74\d{8}:\d{3}',p) is None or p not in api.PLANS for p in plans)):
        raise APIError('unsupported_query',400)
    return {'plans':plans,'level':'overview','release':fields['release']}


class LocalHandler(BaseHTTPRequestHandler):
    server_version = 'LocalRDTR/1.0'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, format, *args):
        pass

    def send_body(self,status,body,content_type='application/json; charset=utf-8',extra=None):
        self.send_response(status)
        for key,value in {'Content-Type':content_type,'Content-Length':str(len(body)),
                          'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
                          'Connection':'close',**(extra or {})}.items():
            self.send_header(key,value)
        self.end_headers()
        self.close_connection=True
        if self.command!='HEAD':
            self.wfile.write(body)

    def send_error(self,code,message=None,explain=None):
        self.send_body(code,encoded({'error':{'code':'http_error'}}))

    def unsupported(self):
        self.send_body(405,encoded({'error':{'code':'method_not_allowed'}}),extra={'Allow':'GET'})

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_HEAD = do_TRACE = do_CONNECT = unsupported

    def _guard(self):
        # BaseHTTPRequestHandler collapses leading //; reject its repaired token.
        words = self.raw_requestline.decode('iso-8859-1').rstrip('\r\n').split(' ')
        if len(words)!=3 or words[1]!=self.path:
            raise APIError('unsupported_query',400)
        allowed={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        hosts=self.headers.get_all('Host',[])
        if len(hosts)!=1 or hosts[0] not in allowed:
            raise APIError('host_not_allowed',403)
        origins=self.headers.get_all('Origin',[])
        if origins and (len(origins)!=1 or origins[0] not in {'http://'+h for h in allowed}):
            raise APIError('origin_not_allowed',403)
        if (len(self.path)>2048 or any(ord(c)<=32 or ord(c)==127 for c in self.path) or
                '\\' in self.path or '%' in self.path):
            raise APIError('unsupported_query',400)
        if self.headers.get_all('Transfer-Encoding',[]) or self.headers.get_all('Content-Length',[]) not in ([],['0']):
            raise APIError('unsupported_query',400)
        target=urlsplit(self.path)
        if target.scheme or target.netloc or target.fragment or not self.path.startswith('/'):
            raise APIError('not_found',404)
        return target

    def _sql(self, callback):
        if not self.server.sql_slots.acquire(blocking=False):
            raise APIError('dataset_unavailable',503)
        try:
            try:
                with self.server.connection_factory() as conn:
                    with conn.transaction():
                        conn.execute("SET LOCAL statement_timeout='3s'")
                        conn.execute("SET LOCAL lock_timeout='1s'")
                        return callback(conn)
            except APIError:
                raise
            except Exception:
                # Includes credentials/config, permission denial, outage and timeout.
                raise APIError('dataset_unavailable',503) from None
        finally:
            self.server.sql_slots.release()

    def do_GET(self):
        try:
            target=self._guard()
            if target.path=='/api/catalog':
                if target.query!='kbli=01273':
                    raise APIError('unsupported_query',400)
                payload=self._sql(lambda conn:api.get_catalog(conn))
                self.send_body(200,encoded(payload))
            elif target.path=='/api/display-batch':
                fields=parse_batch_query(target.query)
                payload=self._sql(lambda conn:api.get_display_batch(conn,fields['plans'],fields['level'],fields['release']))
                body=encoded(payload)
                if len(body)>32*1024*1024:
                    raise APIError('dataset_unavailable',503)
                self.send_body(200,body)
            elif target.path in ('/api/display','/api/feature-detail'):
                detail=target.path=='/api/feature-detail'
                fields=parse_query(target.query,detail=detail)
                if detail:
                    payload=self._sql(lambda conn:api.get_feature_detail(conn,fields['plan'],fields['objectId'],fields['snapshot'],fields['release']))
                else:
                    payload=self._sql(lambda conn:api.get_display(conn,fields['plan'],fields['level'],fields['release'],fields['bbox']))
                self.send_body(200,encoded(payload),('application/json' if detail else 'application/geo+json')+'; charset=utf-8')
            elif target.path=='/' and not target.query:
                self.send_body(302,b'',extra={'Location':'/prototype/'})
            elif target.path in STATIC and not target.query:
                body,kind=read_static(self.server.prototype_dir,target.path)
                self.send_body(200,body,kind)
            else:
                raise APIError('not_found',404)
        except APIError as error:
            self.send_body(error.status,encoded({'error':{'code':error.code}}))
        except (BrokenPipeError,ConnectionResetError):
            self.close_connection=True
        except Exception:
            self.send_body(500,encoded({'error':{'code':'internal_error'}}))


def make_server(port=0, connection_factory=None, prototype_dir=None):
    server=ThreadingHTTPServer(('127.0.0.1',port),LocalHandler)
    server.daemon_threads=True
    server.connection_factory=connection_factory or default_connection_factory
    server.prototype_dir=Path(prototype_dir) if prototype_dir is not None else ROOT/'prototype'
    server.sql_slots=threading.BoundedSemaphore(4)
    return server


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8766)
    args=parser.parse_args(argv)
    try:
        server=make_server(port=args.port)
        print(f'Local RDTR: http://127.0.0.1:{server.server_port}/prototype/',flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return 0
    except OSError:
        print('local_server_unavailable')
        return 1


if __name__=='__main__':
    raise SystemExit(main())
