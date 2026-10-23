import importlib.util,types,unittest,io,json
from pathlib import Path
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('archive_tests',root/'test_webkit_apt_cache.py');tests=importlib.util.module_from_spec(spec);spec.loader.exec_module(tests)
source=(root.parent/'webkit-apt-cache.py').read_text()
def run(module):
 tests.guard=module;stream=io.StringIO();result=unittest.TextTestRunner(stream=stream).run(unittest.defaultTestLoader.loadTestsFromTestCase(tests.ArchiveTests));return result,stream.getvalue()
baseline,log=run(tests.guard)
if not baseline.wasSuccessful():raise RuntimeError(log)
changes=[('hash',"meta['sha256']!=digest","False"),('trusted',"meta.get('trusted') is not True","False"),('identity','if any(meta.get(k)!=v','if False and any(meta.get(k)!=v'),('size',"if meta.get('size')!=len(data):","if False:"),('symlink','os.O_RDONLY|os.O_NOFOLLOW','os.O_RDONLY'),('outside','p.parent!=directory(archive_root)','False'),('duplicate','len(paths)!=len(set(paths))','False'),('count','len(files)>MAX_FILES','False'),('hook-command','if not all(re.fullmatch','if False and not all(re.fullmatch')]
records=[]
for name,old,new in changes:
 if source.count(old)!=1:raise RuntimeError('Ambiguous mutation '+name)
 module=types.ModuleType('cache_mutant');module.__file__=str(root.parent/'webkit-apt-cache.py');exec(compile(source.replace(old,new),module.__file__,'exec'),module.__dict__)
 result,log=run(module)
 if not result.failures or result.errors:raise RuntimeError('Mutation not caught for intended assertion '+name+'\n'+log)
 records.append({'guard':name,'caught':True,'assertionFailures':len(result.failures),'errors':len(result.errors)})
print(json.dumps({'baselineTests':baseline.testsRun,'mutations':records},indent=2))
