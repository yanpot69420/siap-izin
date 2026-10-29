"""Synthetic blob bytes only; no real RDTR geometry or credentials in fixtures."""
import hashlib,importlib,sys,tempfile,unittest,os
from unittest.mock import patch
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
class ArchiveTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)/'blobs';self.raw=b'{"synthetic":true}'
 def subject(self):
  self.assertTrue((ROOT/'tools/rdtr_archive.py').exists(),'private artifact archive is not implemented')
  return importlib.import_module('tools.rdtr_archive')
 def test_archives_exact_captured_bytes_with_relative_locator(self):
  result=self.subject().store_artifact(self.raw,self.root)
  self.assertEqual(result['sha256'],hashlib.sha256(self.raw).hexdigest())
  self.assertEqual(result['size_bytes'],len(self.raw));self.assertFalse(Path(result['blob_locator']).is_absolute())
  self.assertEqual((self.root/result['blob_locator']).read_bytes(),self.raw)
  self.assertEqual((self.root/result['blob_locator']).stat().st_mode&0o777,0o600)
 def test_repeated_bytes_reuse_file_but_corrupt_existing_blob_is_rejected(self):
  module=self.subject();first=module.store_artifact(self.raw,self.root)
  target=self.root/first['blob_locator'];before=target.stat().st_mtime_ns
  self.assertEqual(module.store_artifact(self.raw,self.root),first);self.assertEqual(target.stat().st_mtime_ns,before)
  target.write_bytes(b'corrupt')
  with self.assertRaises(ValueError):module.store_artifact(self.raw,self.root)
  self.assertEqual(target.read_bytes(),b'corrupt')
 def test_publishes_only_complete_temporary_file_atomically(self):
  module=self.subject();events=[];original=os.link
  def publish(src,dst,*args,**kwargs):
   fd=os.open(src,os.O_RDONLY,dir_fd=kwargs.get('src_dir_fd'))
   try:
    self.assertEqual(os.read(fd,len(self.raw)+1),self.raw)
    self.assertEqual(os.fstat(fd).st_mode&0o777,0o600)
   finally:os.close(fd)
   with self.assertRaises(FileNotFoundError):os.stat(dst,dir_fd=kwargs.get('dst_dir_fd'),follow_symlinks=False)
   events.append(True);return original(src,dst,*args,**kwargs)
  with patch.object(module.os,'link',side_effect=publish):result=module.store_artifact(self.raw,self.root)
  self.assertEqual(len(events),1);self.assertEqual(list(self.root.iterdir()),[self.root/result['blob_locator']])
 def test_rejects_symlink_root_or_ancestor_without_writing(self):
  module=self.subject()
  actual=Path(self.temp.name)/'actual';actual.mkdir(mode=0o700)
  link=Path(self.temp.name)/'link';link.symlink_to(actual,target_is_directory=True)
  for root in (link,link/'nested'):
   with self.subTest(root=root.name):
    with self.assertRaises((ValueError,OSError)):module.store_artifact(self.raw,root)
    self.assertEqual(list(actual.iterdir()),[])
 def test_existing_public_root_is_rejected_not_repaired(self):
  self.root.mkdir(mode=0o755);self.root.chmod(0o755)
  with self.assertRaises((ValueError,OSError)):self.subject().store_artifact(self.raw,self.root)
  self.assertEqual(self.root.stat().st_mode&0o777,0o755)
  self.assertEqual(list(self.root.iterdir()),[])
 def test_private_existing_root_under_readable_ancestor_is_supported(self):
  Path(self.temp.name).chmod(0o755);self.root.mkdir(mode=0o700)
  result=self.subject().store_artifact(self.raw,self.root)
  self.assertEqual((self.root/result['blob_locator']).read_bytes(),self.raw)
  self.assertEqual(self.root.stat().st_mode&0o777,0o700)
 def test_unsafe_collisions_are_rejected_without_repair(self):
  module=self.subject();locator=hashlib.sha256(self.raw).hexdigest()+'.json'
  for case in ('symlink','directory','hardlink','public','nonowner'):
   with self.subTest(case=case):
    root=Path(self.temp.name)/case;root.mkdir(mode=0o700);target=root/locator
    outside=Path(self.temp.name)/(case+'-outside');outside.write_bytes(self.raw);outside.chmod(0o600)
    if case=='symlink':target.symlink_to(outside)
    elif case=='directory':target.mkdir()
    elif case=='hardlink':os.link(outside,target)
    else:target.write_bytes(self.raw);target.chmod(0o644 if case=='public' else 0o600)
    original=os.fstat;inode=target.stat().st_ino;before=target.lstat()
    def metadata(fd):
     value=original(fd)
     if case=='nonowner' and value.st_ino==inode:
      fields=list(value);fields[4]=os.geteuid()+1;return os.stat_result(fields)
     return value
    with patch.object(module.os,'fstat',side_effect=metadata):
     with self.assertRaises((ValueError,OSError)):module.store_artifact(self.raw,root)
    self.assertEqual(target.lstat().st_mode,before.st_mode)
    self.assertEqual(target.lstat().st_ino,before.st_ino)
    self.assertEqual(list(root.iterdir()),[target])
    self.assertEqual(outside.read_bytes(),self.raw)
 def test_nonowner_root_is_rejected(self):
  self.root.mkdir(mode=0o700);module=self.subject();uid=os.geteuid()
  with patch.object(module.os,'geteuid',return_value=uid+1):
   with self.assertRaises((ValueError,OSError)):module.store_artifact(self.raw,self.root)
  self.assertEqual(list(self.root.iterdir()),[])
 def test_success_fsyncs_file_then_directory_after_temporary_cleanup(self):
  import stat
  self.root.mkdir(mode=0o700);module=self.subject();original=os.fsync;events=[]
  def sync(fd):
   is_directory=stat.S_ISDIR(os.fstat(fd).st_mode);events.append(is_directory)
   if is_directory:self.assertFalse(any(p.name.startswith('.artifact-') for p in self.root.iterdir()))
   return original(fd)
  with patch.object(module.os,'fsync',side_effect=sync):module.store_artifact(self.raw,self.root)
  self.assertEqual(events,[False,True])
 def test_io_failure_cleans_temporary_files(self):
  import stat
  module=self.subject();original=os.fsync
  for case in ('file_sync','publish','directory_sync'):
   with self.subTest(case=case):
    root=Path(self.temp.name)/case;root.mkdir(mode=0o700)
    def sync(fd):
     directory=stat.S_ISDIR(os.fstat(fd).st_mode)
     if (case=='file_sync' and not directory) or (case=='directory_sync' and directory):raise OSError('synthetic_io_failure')
     return original(fd)
    def publish(*args,**kwargs):raise OSError('synthetic_publish_failure')
    with patch.object(module.os,'fsync',side_effect=sync):
     if case=='publish':
      with patch.object(module.os,'link',side_effect=publish):
       with self.assertRaises(OSError):module.store_artifact(self.raw,root)
     else:
      with self.assertRaises(OSError):module.store_artifact(self.raw,root)
    self.assertFalse(any(p.name.startswith('.artifact-') for p in root.iterdir()))
    if case!='directory_sync':self.assertEqual(list(root.iterdir()),[])
 def test_ancestor_replaced_with_symlink_during_walk_is_not_followed(self):
  module=self.subject();parent=Path(self.temp.name)/'parent';parent.mkdir(mode=0o700)
  moved=parent.with_name('moved');outside=parent.with_name('outside');outside.mkdir(mode=0o700)
  original=os.open;replaced=False
  def opening(path,*args,**kwargs):
   nonlocal replaced
   if path=='parent' and not replaced:
    replaced=True;parent.rename(moved);parent.symlink_to(outside,target_is_directory=True)
   return original(path,*args,**kwargs)
  with patch.object(module.os,'open',side_effect=opening):
   with self.assertRaises((ValueError,OSError)):module.store_artifact(self.raw,parent/'blobs')
  self.assertTrue(replaced);self.assertEqual(list(outside.iterdir()),[])
 def test_opened_root_stays_pinned_if_path_is_replaced_before_publish(self):
  module=self.subject();self.root.mkdir(mode=0o700)
  moved=self.root.with_name('pinned');outside=self.root.with_name('outside');outside.mkdir(mode=0o700)
  original=os.link
  def publish(src,dst,*args,**kwargs):
   self.assertIsInstance(kwargs.get('src_dir_fd'),int)
   self.assertEqual(kwargs.get('src_dir_fd'),kwargs.get('dst_dir_fd'))
   self.assertIs(kwargs.get('follow_symlinks'),False)
   self.root.rename(moved);self.root.symlink_to(outside,target_is_directory=True)
   return original(src,dst,*args,**kwargs)
  with patch.object(module.os,'link',side_effect=publish):result=module.store_artifact(self.raw,self.root)
  self.assertEqual(list(outside.iterdir()),[])
  self.assertEqual((moved/result['blob_locator']).read_bytes(),self.raw)
  self.assertEqual(list(moved.iterdir()),[moved/result['blob_locator']])
 def test_private_readonly_existing_blob_preserves_identity_and_mode(self):
  module=self.subject();first=module.store_artifact(self.raw,self.root);target=self.root/first['blob_locator']
  target.chmod(0o400);before=target.stat()
  self.assertEqual(module.store_artifact(self.raw,self.root),first)
  after=target.stat()
  self.assertEqual((after.st_ino,after.st_mtime_ns,after.st_mode),(before.st_ino,before.st_mtime_ns,before.st_mode))
if __name__=='__main__':unittest.main()
