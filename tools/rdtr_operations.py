"""Private local Docker/PostgreSQL operations. Never loads credentials/configuration."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import uuid

REPO = Path(__file__).resolve().parents[1]
CONTAINER = 'siap-izin-rdtr-db'
USER = 'siap_izin_owner'
SOURCES = ('siap_izin_dev', 'siap_izin_test')
RESTORE = re.compile(r'siap_izin_restore_[0-9a-f]{12}\Z')


def safe_path(value, *, private=False, source_input=False):
    raw = os.fspath(value)
    p = Path(raw)
    if not p.is_absolute() or '..' in p.parts:
        raise ValueError('unsafe_path')
    if not source_input and (p == REPO or REPO in p.parents):
        raise ValueError('outside_repository_required')
    for component in [*reversed(p.parents), p]:
        try:
            info = component.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or info.st_uid not in (0, os.geteuid()) or info.st_mode & 0o022:
            raise ValueError('unsafe_path_ancestor')
    if private:
        info = p.lstat()
        if info.st_uid != os.geteuid() or info.st_mode & 0o077:
            raise ValueError('private_path_required')
    return p


def output_path(value):
    p = safe_path(value)
    if os.path.lexists(p):
        raise ValueError('output_exists')
    safe_path(p.parent, private=True)
    if not p.parent.is_dir():
        raise ValueError('existing_private_parent_required')
    return p


def docker(*args, interactive=False):
    return ['docker', 'exec'] + (['-i'] if interactive else []) + [CONTAINER, *args]


def guard_database(database):
    if database not in SOURCES and not RESTORE.fullmatch(database):
        raise ValueError('database_guard')


def run(args, *, stdin=None, stdout=None):
    result = None
    try:
        result = subprocess.run(args, stdin=stdin, stdout=stdout or subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=1800, check=False,
                                env={k: v for k, v in os.environ.items()
                                     if not k.startswith('PG')})
        failed = result.returncode != 0
    except (OSError, subprocess.SubprocessError):
        failed = True
    if failed or result is None:
        raise ValueError('docker_operation_failed') from None
    return result.stdout


class Session:
    """One read-only repeatable-read transaction held through dump + blob capture."""
    def __init__(self, database):
        guard_database(database)
        self.database = database

    def __enter__(self):
        self.proc = subprocess.Popen(docker('psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                                           '-U', USER, '-d', self.database, interactive=True),
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.DEVNULL, text=True,
                                     env={k: v for k, v in os.environ.items() if not k.startswith('PG')})
        try:
            self.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL extra_float_digits=3; SET LOCAL statement_timeout='120s'; SET LOCAL lock_timeout='5s'; SELECT 1")
            self.snapshot = self.query('SELECT pg_export_snapshot()')
            if not re.fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+', self.snapshot):
                raise ValueError('snapshot_failed')
            return self
        except Exception:
            self.__exit__(None, None, None)
            raise

    def query(self, sql):
        self.proc.stdin.write(sql + ';\n'); self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise ValueError('snapshot_query_failed')
        return line.rstrip('\n')

    def inventory(self):
        names = json.loads(self.query("SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]') FROM pg_tables WHERE schemaname='rdtr'"))
        if not names:
            raise ValueError('rdtr_schema_missing')
        tables = {}
        for name in names:
            if not re.fullmatch(r'[a-z_][a-z_0-9]*', name):
                raise ValueError('unexpected_table')
            tables[name] = json.loads(self.query("SELECT json_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM rdtr.\"" + name + '\" t'))
        ewkb = self.query("SELECT encode(sha256(convert_to(coalesce(string_agg(id::text || ':' || encode(ST_AsEWKB(geom_original_4326),'hex'),E'\\n' ORDER BY id),''),'UTF8')),'hex') FROM rdtr.zone_feature")
        pin = json.loads(self.query("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM rdtr.active_release t"))
        blobs = json.loads(self.query("SELECT coalesce(jsonb_agg(t ORDER BY t.blob_locator),'[]') FROM (SELECT DISTINCT sha256,blob_locator,byte_size FROM rdtr.source_artifact) t"))
        return {'tables': tables, 'source_ewkb': ewkb, 'active_pin': pin, 'blobs': blobs}

    def __exit__(self, *args):
        if self.proc.poll() is None:
            try:
                self.proc.stdin.write('ROLLBACK;\n\\q\n'); self.proc.stdin.flush()
                self.proc.wait(timeout=10)
            except (OSError, subprocess.SubprocessError):
                self.proc.kill(); self.proc.wait()
        self.proc.stdin.close(); self.proc.stdout.close()


def private_open(path, *, source_input=False):
    p = safe_path(path, private=True, source_input=source_input)
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open('/', flags)
    try:
        for part in p.parts[1:-1]:
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd); fd = child
            info = os.fstat(fd)
            if info.st_uid not in (0, os.geteuid()) or info.st_mode & 0o022:
                raise ValueError('unsafe_path_ancestor')
        leaf = os.open(p.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
    finally:
        os.close(fd)
    f = os.fdopen(leaf, 'rb')
    info = os.fstat(f.fileno())
    if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or
            info.st_uid != os.geteuid() or info.st_mode & 0o077):
        f.close()
        raise ValueError('private_regular_file_required')
    return f


def private_read(path, *, source_input=False):
    with private_open(path, source_input=source_input) as f:
        return f.read()


def write_private(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(raw); f.flush(); os.fsync(f.fileno())


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def artifact_name(artifact):
    sha = artifact.get('sha256', '')
    if (not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{64}', sha) or
            artifact.get('blob_locator') != sha + '.json' or
            type(artifact.get('byte_size')) is not int or artifact['byte_size'] < 0):
        raise ValueError('invalid_blob_reference')
    return sha + '.json'


def check_blob(raw, artifact):
    if len(raw) != artifact['byte_size'] or digest(raw) != artifact['sha256']:
        raise ValueError('blob_integrity_failed')


def publish(stage, out):
    """Atomic no-replace directory rename, supported on macOS/Linux only."""
    lib = ctypes.CDLL(None, use_errno=True)
    if sys.platform == 'darwin':
        result = lib.renamex_np(os.fsencode(stage), os.fsencode(out), 4)
    elif sys.platform.startswith('linux'):
        result = lib.renameat2(-100, os.fsencode(stage), -100, os.fsencode(out), 1)
    else:
        raise ValueError('atomic_publish_unsupported')
    if result != 0:
        raise ValueError('atomic_publish_failed')


def backup(output, blob_root, database='siap_izin_dev'):
    if database not in SOURCES:
        raise ValueError('source_database_guard')
    out = output_path(output)
    root = safe_path(blob_root, private=True, source_input=True)
    stage = Path(tempfile.mkdtemp(prefix='.rdtr-pending-', dir=out.parent))
    stage.chmod(0o700)
    # Failed staging directories are deliberately retained privately, not published.
    with Session(database) as session:
        inventory = session.inventory()
        dump_path = stage/'database.dump'
        fd = os.open(dump_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            run(docker('pg_dump', '-U', USER, '-d', database, '--format=custom',
                       '--snapshot=' + session.snapshot), stdout=stream)
            stream.flush(); os.fsync(stream.fileno())
        (stage/'blobs').mkdir(mode=0o700)
        for artifact in inventory['blobs']:
            name = artifact_name(artifact)
            raw = private_read(root/name, source_input=True); check_blob(raw, artifact)
            dest = stage/'blobs'/name
            if not dest.exists(): write_private(dest, raw)
        manifest = {'format': 1, 'created_unix': time.time(), 'source_database': database,
                    'inventory': inventory, 'dump_sha256': digest(private_read(dump_path))}
        raw = encoded(manifest)
        write_private(stage/'manifest.json', raw)
        write_private(stage/'manifest.sha256', digest(raw).encode())
        verify_bundle(stage)
        publish(stage, out)
    verify_bundle(out)
    return {'backup_complete': True}


def verify_bundle(path):
    root = safe_path(path, private=True)
    raw = private_read(root/'manifest.json')
    if private_read(root/'manifest.sha256') != digest(raw).encode():
        raise ValueError('manifest_integrity_failed')
    try:
        m = json.loads(raw)
        if m['format'] != 1 or m['source_database'] not in SOURCES:
            raise ValueError('invalid_manifest')
        if digest(private_read(root/'database.dump')) != m['dump_sha256']:
            raise ValueError('dump_integrity_failed')
        safe_path(root/'blobs', private=True)
        for artifact in m['inventory']['blobs']:
            raw = private_read(root/'blobs'/artifact_name(artifact)); check_blob(raw, artifact)
    except (KeyError, TypeError, json.JSONDecodeError):
        raise ValueError('invalid_manifest') from None
    return m


def create_restore(database):
    if not RESTORE.fullmatch(database):
        raise ValueError('restore_target_guard')
    # createdb fails rather than reusing an existing name. No DROP or --clean path.
    run(docker('createdb', '-U', USER, '--maintenance-db=postgres', '--template=template0',
               '--owner=' + USER, database))
    run(docker('psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', USER, '-d', database,
               '-c', 'COMMENT ON DATABASE ' + database + " IS 'rdtr-operations-v1'"))


def verify_restore(backup_path):
    root = safe_path(backup_path, private=True)
    manifest = verify_bundle(root)
    database = 'siap_izin_restore_' + uuid.uuid4().hex[:12]
    prefix = root.parent/('restore-' + database)
    safe_path(root.parent, private=True)
    audit = {'database': database, 'container': CONTAINER, 'owner': USER,
             'marker': 'rdtr-operations-v1', 'created_unix': time.time()}
    write_private(Path(str(prefix) + '.requested.json'), encoded(audit))
    create_restore(database)
    with Session(database) as session:
        ownership = json.loads(session.query("SELECT json_build_object('owner',pg_get_userbyid(datdba),'marker',shobj_description(oid,'pg_database')) FROM pg_database WHERE datname=current_database()"))
        if ownership != {'owner': USER, 'marker': 'rdtr-operations-v1'}:
            raise ValueError('restore_ownership_failed')
    write_private(Path(str(prefix) + '.created.json'), encoded(audit))
    with private_open(root/'database.dump') as dump:
        run(docker('pg_restore', '-U', USER, '-d', database, '--exit-on-error',
                   '--single-transaction', interactive=True), stdin=dump)
    with Session(database) as session:
        restored = session.inventory()
    if restored != manifest['inventory']:
        raise ValueError('restored_inventory_mismatch')
    # Re-read all blobs and dump after the drill; no live blob root is consulted.
    verify_bundle(root)
    receipt = {**audit, 'verified': True, 'verified_unix': time.time(),
               'inventory_sha256': digest(encoded(restored)), 'retained': True}
    write_private(Path(str(prefix) + '.verified.json'), encoded(receipt))
    return {'verified': True, 'database': database, 'retained': True}


WAL_SQL = """SELECT json_build_object(
    'settings',(SELECT json_object_agg(name, CASE
        WHEN name IN ('wal_level','archive_mode') THEN to_jsonb(setting)
        ELSE to_jsonb(pg_size_bytes(current_setting(name))) END)
        FROM pg_settings WHERE name IN ('wal_level','archive_mode','max_wal_size','min_wal_size','max_slot_wal_keep_size')),
    'directory_bytes',(SELECT coalesce(sum(size),0) FROM pg_ls_waldir()),
    'slot_count',(SELECT count(*) FROM pg_replication_slots),
    'max_retained_bytes',(SELECT coalesce(max(greatest(0,pg_wal_lsn_diff(pg_current_wal_lsn(),restart_lsn))),0)
        FROM pg_replication_slots))"""


def wal_metadata(session):
    """Project exact public capacity fields only; never echo unexpected SQL data."""
    try:
        value = json.loads(session.query(WAL_SQL))
        if type(value) is not dict or set(value) != {'settings','directory_bytes','slot_count','max_retained_bytes'}:
            raise ValueError()
        settings = value['settings']
        if type(settings) is not dict or set(settings) != {'wal_level','archive_mode','max_wal_size','min_wal_size','max_slot_wal_keep_size'}:
            raise ValueError()
        if settings['wal_level'] not in ('minimal','replica','logical') or settings['archive_mode'] not in ('off','on','always'):
            raise ValueError()
        for key in ('max_wal_size','min_wal_size','max_slot_wal_keep_size'):
            if type(settings[key]) is not int or not (-1 if key=='max_slot_wal_keep_size' else 0) <= settings[key] <= 2**63-1:
                raise ValueError()
        for key in ('directory_bytes','slot_count','max_retained_bytes'):
            if type(value[key]) is not int or not 0 <= value[key] <= 2**63-1:
                raise ValueError()
        return value
    except Exception:
        return {'safeErrorCode': 'wal_metadata_invalid'}


def status(database='siap_izin_dev', backup_path=None):
    if database not in SOURCES:
        raise ValueError('source_database_guard')
    with Session(database) as session:
        names = json.loads(session.query("SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]') FROM pg_tables WHERE schemaname='rdtr'"))
        counts = {}
        for name in names:
            if not re.fullmatch(r'[a-z_][a-z_0-9]*', name): raise ValueError('unexpected_table')
            counts[name] = int(session.query('SELECT count(*) FROM rdtr."' + name + '"'))
        pin = json.loads(session.query("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM rdtr.active_release t"))
        size = int(session.query('SELECT pg_database_size(current_database())'))
        wal = wal_metadata(session)
    result = {'healthy': bool(counts) and 'safeErrorCode' not in wal, 'database': database, 'counts': counts,
              'active_pin': pin, 'size_bytes': size, 'wal': wal}
    if backup_path is not None:
        m = verify_bundle(backup_path)
        result['backup_age_seconds'] = max(0, time.time() - m['created_unix'])
        result['backup_integrity_verified'] = True
    return result


def probe(url):
    """Bounded GETs to fixed loopback only; capture once, never retry active."""
    import http.client
    checks = []
    current = {'status': None, 'seconds': 0, 'bodyBytes': 0, 'safeErrorCode': None}
    def require(ok, code='schema_invalid'):
        if not ok:
            current['safeErrorCode'] = code
            raise ValueError('probe_failed')
    def fetch(path, limit):
        nonlocal current
        current = {'status': None, 'seconds': 0, 'bodyBytes': 0, 'safeErrorCode': None}
        checks.append(current)
        start = time.monotonic()
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        try:
            conn.request('GET', path)
            response = conn.getresponse()
            current['status'] = response.status
            require(type(response.status) is int and response.status == 200, 'http_status')
            raw = bytearray()
            while True:
                remaining = 5 - (time.monotonic() - start)
                if remaining <= 0:
                    raise TimeoutError()
                if conn.sock is not None:
                    conn.sock.settimeout(remaining)
                chunk = response.read(min(65536, limit + 1 - len(raw)))
                if not chunk:
                    break
                raw.extend(chunk)
                current['bodyBytes'] = len(raw)
                require(len(raw) <= limit, 'body_too_large')
            result = json.loads(raw)
            require(type(result) is dict)
            return result
        finally:
            current['seconds'] = round(time.monotonic() - start, 6)
            conn.close()
    def metadata(payload, pin):
        meta = payload['meta']
        require(meta['plan']['id'] == '7411000000:001')
        require(meta['kbli']['code']=='01273' and meta['kbli']['version']=='2025' and meta['kbli']['scope']=='budidaya-kakao')
        require(meta['source']['status']=='local_dataset')
        expected = {k:pin[k] for k in ('releaseId','releaseHash','planVersionId','mappingId','geometryScope','rulesScope')}
        expected['sourceKind'] = 'local_dataset'
        require(meta['dataset']==expected and meta['snapshotId']==pin['snapshotId'], 'pin_mismatch')
    try:
        match = re.fullmatch(r'http://(127\.0\.0\.1|localhost):(8769|8770)/prototype/', url) if type(url) is str else None
        require(match is not None, 'url_guard')
        port = int(match[2])
        catalog = fetch('/api/catalog?kbli=01273', 256*1024)
        release = catalog['localDataset']
        require(release['sourceKind']=='local_dataset' and release['partial'] is True)
        matches = [p for p in catalog['plans'] if p['id']=='7411000000:001']
        require(len(matches)==1)
        pin = matches[0]['localDataset']
        require(pin['available'] is True and pin['geometryScope']=='filtered_subset' and pin['rulesScope']=='filter_membership_only')
        require(type(pin['releaseHash']) is str and re.fullmatch(r'[a-f0-9]{64}', pin['releaseHash']) is not None)
        for key in ('releaseId','planVersionId','mappingId'):
            require(type(pin[key]) is str and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',pin[key]) is not None)
        require(pin['releaseHash']==release['releaseHash'] and pin['releaseId']==release['releaseId'], 'pin_mismatch')
        identity = {k:pin[k] for k in ('mappingId','planVersionId','releaseHash')}
        identity['algorithmVersion']='coverage-lod-v1'
        require(pin['snapshotId']==digest(encoded(identity)), 'pin_mismatch')
        query = 'plan=7411000000:001&kbli=01273&release=' + pin['releaseHash']
        overview = fetch('/api/display?' + query + '&level=overview', 2*1024*1024)
        metadata(overview, pin)
        require(overview['type']=='FeatureCollection' and type(overview['features']) is list and bool(overview['features']))
        feature = overview['features'][0]
        object_id = feature['id']
        require(type(object_id) is int and 0<=object_id<=9007199254740991)
        require(feature['type']=='Feature' and feature['properties']['object_id']==object_id and feature['properties']['plan_id']=='7411000000:001')
        detail = fetch('/api/feature-detail?' + query + '&objectId=' + str(object_id) + '&snapshot=' + pin['snapshotId'], 2*1024*1024)
        metadata(detail, pin)
        require(detail['schemaVersion']==1 and detail['planId']=='7411000000:001' and type(detail['objectId']) is int and detail['objectId']==object_id)
        require(detail['snapshotId']==pin['snapshotId'], 'pin_mismatch')
        require(detail['properties']['object_id']==object_id and detail['properties']['plan_id']=='7411000000:001')
        return {'healthy': True, 'checks': checks}
    except Exception as error:
        if not checks:
            checks.append(current)
        if current['safeErrorCode'] is None:
            current['safeErrorCode'] = ('timeout' if isinstance(error, TimeoutError) else
                                        'transport_error' if isinstance(error, (OSError,http.client.HTTPException)) else 'schema_invalid')
        return {'healthy': False, 'checks': checks}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest='command', required=True)
    p = subs.add_parser('backup')
    p.add_argument('--output', required=True); p.add_argument('--blob-root', required=True)
    p.add_argument('--database', choices=SOURCES, default=SOURCES[0])
    p = subs.add_parser('verify-restore'); p.add_argument('--backup', required=True)
    p = subs.add_parser('status'); p.add_argument('--backup')
    p.add_argument('--database', choices=SOURCES, default=SOURCES[0])
    p = subs.add_parser('probe'); p.add_argument('--url', required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'probe': result = probe(args.url)
        elif args.command == 'backup': result = backup(args.output, args.blob_root, args.database)
        elif args.command == 'verify-restore': result = verify_restore(args.backup)
        else: result = status(args.database, args.backup)
    except Exception:
        # No exception strings, argv, DSNs, SQL rows, paths or subprocess stderr.
        print('operations_failed', file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 1 if args.command in ('probe','status') and result.get('healthy') is not True else 0


if __name__ == '__main__':
    sys.exit(main())
