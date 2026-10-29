"""Private local-development connection settings; never print returned DSNs."""
import json
import os
from pathlib import Path
from psycopg.conninfo import conninfo_to_dict


def load_dsn(path, kind='owner'):
    expected = {'owner': ('siap_izin_dev', 'siap_izin_owner'),
                'test': ('siap_izin_test', 'siap_izin_owner'),
                'reader': ('siap_izin_dev', 'siap_izin_reader')}
    if type(kind) is not str or kind not in expected:
        raise ValueError('local_development_connection_required')
    error = 'private_configuration_required'
    fd = None
    try:
        fd = os.open(Path(path), os.O_RDONLY | os.O_NOFOLLOW)
    except (OSError, TypeError, ValueError):
        pass
    if fd is None:
        raise ValueError(error)
    # Parser exceptions can contain credentials, JSON documents, or fragments.
    # Raise outside their handlers so even __context__ cannot retain them.
    dsn = ''
    settings = {}
    try:
        with os.fdopen(fd, 'r', encoding='utf-8') as stream:
            if not os.fstat(stream.fileno()).st_mode & 0o077:
                error = 'invalid_private_configuration'
                config = json.load(stream)
                if type(config) is dict and type(config.get(kind + '_dsn')) is str:
                    dsn = config[kind + '_dsn']
                    settings = conninfo_to_dict(dsn)
                    error = None
    except Exception:
        error = 'invalid_private_configuration'
    if error is not None:
        raise ValueError(error)
    allowed = {'host', 'port', 'dbname', 'user', 'password', 'connect_timeout',
               'application_name', 'sslmode'}
    if (set(settings) - allowed or settings.get('host') != '127.0.0.1' or
            settings.get('port') != '54339' or
            (settings.get('dbname'), settings.get('user')) != expected[kind]):
        raise ValueError('local_development_connection_required')
    return dsn
