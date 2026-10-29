"""Checksum-pinned, serialized PostgreSQL migrations. Connection ownership stays with caller."""
from hashlib import sha256
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[2] / 'db' / 'migrations'
LOCK_ID = 0x524454524442


class MigrationError(RuntimeError):
    """Sanitized migration failure: never includes connection details or SQL data."""


def migrate(conn) -> list[str]:
    """Apply ordered SQL atomically; nested callers retain commit/rollback ownership."""
    applied = []
    try:
        with conn.transaction():
            conn.execute('SELECT pg_advisory_xact_lock(%s)', (LOCK_ID,))
            conn.execute('CREATE SCHEMA IF NOT EXISTS rdtr')
            conn.execute('''CREATE TABLE IF NOT EXISTS rdtr.schema_migration (
                version text PRIMARY KEY, checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
                applied_at timestamptz NOT NULL DEFAULT now())''')
            files = sorted(MIGRATIONS.glob('[0-9]*_*.sql'))
            if not files:
                raise MigrationError('No RDTR migration files found')
            existing = dict(conn.execute('SELECT version, checksum FROM rdtr.schema_migration').fetchall())
            if set(existing) - {p.stem for p in files}:
                raise MigrationError('Applied RDTR migration is missing from disk')
            for path in files:
                content = path.read_bytes()
                checksum = sha256(content).hexdigest()
                if path.stem in existing:
                    if existing[path.stem] != checksum:
                        raise MigrationError('RDTR migration checksum mismatch: ' + path.stem)
                    continue
                conn.execute(content.decode('utf-8'))
                conn.execute('INSERT INTO rdtr.schema_migration(version, checksum) VALUES (%s,%s)',
                             (path.stem, checksum))
                applied.append(path.stem)
    except MigrationError:
        raise
    except Exception as exc:
        state = getattr(exc, 'sqlstate', None)
        raise MigrationError('RDTR migration failed' + (f' (SQLSTATE {state})' if state else '')) from None
    return applied
