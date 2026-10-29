#!/usr/bin/env python3
"""Local development database administration; not the application's HTTP adapter."""
import argparse,json
from pathlib import Path
import psycopg
from rdtr_connection import load_dsn
from rdtr_queries import database_status,query_bbox
ROOT=Path(__file__).resolve().parents[1]


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,default=ROOT/'private/rdtr-db/connection.json')
    commands=parser.add_subparsers(dest='command',required=True)
    commands.add_parser('status')
    query=commands.add_parser('query')
    query.add_argument('--version',required=True)
    query.add_argument('--bbox',required=True,help='west,south,east,north, EPSG:4326')
    query.add_argument('--limit',type=int,default=100)
    ingest=commands.add_parser('import-archive',help='Stage checksum-pinned local archive; never publish')
    ingest.add_argument('--path',required=True,type=Path)
    ingest.add_argument('--sha256',required=True)
    ingest.add_argument('--plan-id',required=True)
    args=parser.parse_args(argv)
    try:
        if args.command=='import-archive':
            from rdtr_snapshot import read_snapshot
            from rdtr_store import import_snapshot
            snapshot=read_snapshot(args.path,expected_sha256=args.sha256,expected_plan_id=args.plan_id)
            for directory in (ROOT/'private',ROOT/'private/rdtr-db'):
                directory.mkdir(mode=0o700,exist_ok=True)
            with psycopg.connect(load_dsn(args.config)) as conn:
                result=import_snapshot(conn,snapshot,ROOT/'private/rdtr-db/blobs')
        else:
            with psycopg.connect(load_dsn(args.config)) as conn:
                conn.execute('SET LOCAL ROLE siap_izin_readonly')
                if args.command=='status':
                    result=database_status(conn)
                else:
                    result=query_bbox(conn,args.version,tuple(float(v) for v in args.bbox.split(',')),limit=args.limit)
    except Exception:
        print(json.dumps({'error':'local_database_operation_failed'}))
        return 1
    print(json.dumps(result,ensure_ascii=False))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
