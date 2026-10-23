import importlib.util,unittest,tempfile,hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('cache_guard',Path(__file__).resolve().parents[1]/'webkit-apt-cache.py');guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
class ArchiveTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.archives=self.root/'archives';self.archives.mkdir();self.stage=self.root/'stage';self.stage.mkdir();self.file=self.archives/'demo_1.0_amd64.deb';self.file.write_bytes(b'abcdef');self.meta={'package':'demo','version':'1.0','architecture':'amd64','size':6,'sha256':hashlib.sha256(b'abcdef').hexdigest(),'trusted':True};self.lookup=lambda *args:dict(self.meta)
 def tearDown(self):self.temp.cleanup()
 def test_valid_archive_matches_trusted_hash(self):self.assertEqual(guard.validate_archive(self.file,self.lookup,self.archives)['sha256'],self.meta['sha256'])
 def test_same_size_corruption_fails(self):
  self.file.write_bytes(b'abcdeg')
  with self.assertRaisesRegex(ValueError,'hash'):guard.validate_archive(self.file,self.lookup,self.archives)
 def test_wrong_size_fails(self):
  self.file.write_bytes(b'ab')
  with self.assertRaisesRegex(ValueError,'size'):guard.validate_archive(self.file,self.lookup,self.archives)
 def test_untrusted_or_missing_metadata_fails(self):
  for value in [False,None]:
   self.meta['trusted']=value
   with self.assertRaisesRegex(ValueError,'trusted'):guard.validate_archive(self.file,self.lookup,self.archives)
  with self.assertRaises(ValueError):guard.validate_archive(self.file,lambda *args:None,self.archives)
 def test_metadata_identity_and_hash_shape_fail(self):
  for key,value in [('version','2'),('architecture','all'),('package','other'),('sha256','bad')]:
   old=self.meta[key];self.meta[key]=value
   with self.assertRaises(ValueError):guard.validate_archive(self.file,self.lookup,self.archives)
   self.meta[key]=old
 def test_symlink_and_outside_path_fail(self):
  external=self.root/'external';external.write_bytes(b'abcdef');self.file.unlink();link=self.file;link.symlink_to(external)
  with self.assertRaises(ValueError):guard.validate_archive(link,self.lookup,self.archives)
  with self.assertRaises(ValueError):guard.validate_archive(self.file,self.lookup,self.stage)
 def test_stage_rejects_unknown_files_and_symlink_directory(self):
  (self.stage/'lock').write_text('x')
  with self.assertRaises(ValueError):guard.check_stage(self.stage)
  link=self.root/'linked-stage';link.symlink_to(self.stage,target_is_directory=True)
  with self.assertRaises(ValueError):guard.check_stage(link)
 def test_verified_selected_files_are_staged(self):
  result=guard.verify_selected([str(self.file)],self.lookup,self.archives,self.stage)
  self.assertEqual(len(result),1);self.assertEqual((self.stage/self.file.name).read_bytes(),self.file.read_bytes())
 def test_no_file_staged_if_any_selected_archive_is_bad(self):
  bad=self.archives/'second_1.0_amd64.deb';bad.write_bytes(b'xxxxxx')
  with self.assertRaises(ValueError):guard.verify_selected([str(self.file),str(bad)],self.lookup,self.archives,self.stage)
  self.assertEqual(list(self.stage.iterdir()),[])
 def test_bad_filename_and_duplicate_selection_fail(self):
  bad=self.archives/'bad.deb';bad.write_bytes(b'abcdef')
  with self.assertRaises(ValueError):guard.validate_archive(bad,self.lookup,self.archives)
  with self.assertRaises(ValueError):guard.verify_selected([str(self.file),str(self.file)],self.lookup,self.archives,self.stage)
 def test_hook_command_is_fixed_and_unsafe_paths_fail(self):
  text=guard.hook_text(Path('/work/tools/ci/webkit-apt-cache.py'),Path('/tmp/cim-webkit-debs'))
  self.assertEqual(text,'DPkg::Pre-Install-Pkgs { "/usr/bin/python3 -I /work/tools/ci/webkit-apt-cache.py verify /tmp/cim-webkit-debs"; };\n')
  with self.assertRaises(ValueError):guard.hook_text(Path('/work/bad"path.py'),Path('/tmp/stage'))
 def test_stage_count_is_bounded(self):
  for n in range(501):(self.stage/('demo'+str(n)+'_1.0_amd64.deb')).write_bytes(b'x')
  with self.assertRaisesRegex(ValueError,'count'):guard.check_stage(self.stage)
if __name__=='__main__':unittest.main(verbosity=2)
