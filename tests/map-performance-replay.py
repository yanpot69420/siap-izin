#!/usr/bin/env python3
"""PRIVATE test-only snapshot replay; never refreshes or contacts GISTARU.
Run: python tests/map-performance-replay.py --port 8767 --manifest /private/output/replay.json
Production TTLs, handlers, frontend and cached source files are not modified.
"""
import argparse
import hashlib
import json
import signal
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import dev_server as server

BANNER = b'''<div id="benchmarkReplayBanner" role="status" style="position:fixed;top:0;right:0;z-index:100000;background:#731a12;color:white;padding:8px 14px;font:700 13px sans-serif;max-width:620px;pointer-events:none">BENCHMARK REPLAY / TEST ONLY - cached_snapshot, bukan live. Waktu sumber asli dipertahankan; bukan keputusan izin.</div>'''


def vertices(coords):
    if coords and isinstance(coords[0], (int, float)):
        return 1
    return sum(vertices(child) for child in coords)


class ReplayService:
    benchmark_replay = True  # Explicit trusted adapter opt-in; never supplied by an HTTP client.

    def __init__(self, plan_id, cache_dir):
        self.context = server.PLANS[plan_id]
        original = server.ZoneService(cache_dir, plan_id=plan_id)
        try:
            if any(p.is_symlink() for p in (original.cache_path, original.cache_dir,
                                            *original.cache_dir.parents)):
                raise ValueError('symlink snapshot')
            # One descriptor and one bounded capture: an atomic refresh may replace
            # the path, but payload validation and manifest identity stay together.
            with original.cache_path.open('rb') as stream:
                server.require(server.os.fstat(stream.fileno()).st_size <= server.MAX_SNAPSHOT_BYTES)
                raw = stream.read(server.MAX_SNAPSHOT_BYTES + 1)
            server.require(len(raw) <= server.MAX_SNAPSHOT_BYTES)
            envelope = server.strict_json(raw.decode('utf-8'))
            server.require(envelope['version'] == 2 and envelope['contextHash'] == original.context_hash)
            data = envelope['data']
            server.require(hashlib.sha256(server.encoded(data)).hexdigest() == envelope['sha256'])
            server.validate_snapshot(data['payload'], data['quarantine'], self.context.id)
            self.payload = data['payload']
        except (OSError, server.APIError, ValueError, TypeError, KeyError, AttributeError, RecursionError):
            raise RuntimeError(f'Original snapshot rejected: {plan_id}') from None
        meta = self.payload['meta']
        original_status = meta['source']['status']
        meta['source'].update(status='cached_snapshot', cacheReason='benchmark_replay')
        meta['benchmarkReplay'] = True
        self.record = {
            'id': plan_id, 'name': meta['plan']['name'],
            'retrievedAt': meta['source']['retrievedAt'], 'originalSourceStatus': original_status,
            'sourceStatus': 'cached_snapshot', 'cacheReason': 'benchmark_replay',
            'cacheFileBytes': len(raw),
            'cacheFileSha256': hashlib.sha256(raw).hexdigest(),
            'httpBodyBytes': len(server.encoded(self.payload)),
            'vertices': sum(vertices(f['geometry']['coordinates']) for f in self.payload['features']),
            'features': len(self.payload['features']), 'quarantined': meta['counts']['excludedInvalid'],
        }

    def get_zones(self, **_):
        return self.payload


class ReplayHandler(server.ZoneHandler):
    def send_body(self, status, body, content_type='application/json; charset=utf-8', extra=None):
        if status == 200 and content_type.startswith('text/html'):
            body = body.replace(b'<body>', b'<body>' + BANNER, 1)
            if BANNER not in body:
                raise RuntimeError('Replay HTML banner could not be inserted')
        super().send_body(status, body, content_type, extra)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8767)
    parser.add_argument('--cache-dir', type=Path, default=ROOT / 'private' / 'rdtr-cache')
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    if args.port == 8765:
        parser.error('Port 8765 is reserved; use 8767 or 0')
    services = {pid: ReplayService(pid, args.cache_dir) for pid, ctx in server.PLANS.items() if ctx.activity_id}
    if len(services) != 16:
        raise RuntimeError(f'Expected all 16 mapped plans, got {len(services)}')
    httpd = server.make_server(port=args.port, services=services)
    httpd.RequestHandlerClass = ReplayHandler
    manifest = {'mode': 'benchmark_replay', 'sourceStatus': 'cached_snapshot',
                'productionUnchanged': True, 'networkToGistaru': False,
                'url': f'http://127.0.0.1:{httpd.server_port}/prototype/',
                'plans': [item.record for item in services.values()]}
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'url': manifest['url'], 'planCount': len(services), 'manifest': str(args.manifest)}), flush=True)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
