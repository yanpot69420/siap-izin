"""Private byte-exact archive for already captured source artifacts."""
import hashlib
import os
from pathlib import Path
import secrets
import stat


def _open_root(blob_root):
    """Walk without following links; keep the checked root pinned by descriptor."""
    path = Path(blob_root)
    if '..' in path.parts:
        raise ValueError('private_archive_required')
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open('/' if path.is_absolute() else '.', flags)
    parts = path.parts[1:] if path.is_absolute() else path.parts
    try:
        for index, part in enumerate(parts):
            if index == len(parts) - 1:
                try:
                    os.mkdir(part, mode=0o700, dir_fd=fd)
                except FileExistsError:
                    pass
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        metadata = os.fstat(fd)
        if metadata.st_uid != os.geteuid() or metadata.st_mode & 0o077:
            raise ValueError('private_archive_required')
        return fd
    except BaseException:
        os.close(fd)
        raise


def store_artifact(raw, blob_root):
    digest = hashlib.sha256(raw).hexdigest()
    locator = digest + '.json'
    root_fd = _open_root(blob_root)
    name = None
    try:
        while True:
            candidate = '.artifact-' + secrets.token_hex(16)
            try:
                fd = os.open(candidate, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                             0o600, dir_fd=root_fd)
                name = candidate
                break
            except FileExistsError:
                continue
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                os.link(name, locator, src_dir_fd=root_fd, dst_dir_fd=root_fd,
                        follow_symlinks=False)
            except FileExistsError:
                existing_fd = os.open(locator, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                                      dir_fd=root_fd)
                with os.fdopen(existing_fd, 'rb') as stream:
                    metadata = os.fstat(stream.fileno())
                    if (not stat.S_ISREG(metadata.st_mode) or
                            metadata.st_uid != os.geteuid() or
                            metadata.st_mode & 0o077 or metadata.st_nlink != 1):
                        raise ValueError('private_artifact_required')
                    if stream.read() != raw:
                        raise ValueError('existing_artifact_mismatch')
        finally:
            os.unlink(name, dir_fd=root_fd)
        os.fsync(root_fd)
    finally:
        os.close(root_fd)
    return {'sha256': digest, 'size_bytes': len(raw), 'blob_locator': locator}
