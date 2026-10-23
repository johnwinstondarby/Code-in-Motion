"""CI-only archive cache guard. Trust hashes from APT, never from cache metadata."""
import hashlib,json,os,re,stat,sys,subprocess
from pathlib import Path
from urllib.parse import unquote
MAX_FILES=500
MAX_FILE=128*1024*1024
MAX_TOTAL=512*1024*1024
NAME=re.compile(r'^([a-z0-9][a-z0-9+.-]*)_([A-Za-z0-9.+~:%-]+)_(amd64|all)\.deb$')
def directory(path):
 p=Path(path).absolute()
 if p.is_symlink() or not p.is_dir() or p.resolve()!=p:raise ValueError('unsafe directory')
 return p
def identity(name):
 m=NAME.fullmatch(name)
 if not m:raise ValueError('invalid archive filename')
 package,version,arch=m.groups();version=unquote(version)
 if not re.fullmatch(r'[0-9][A-Za-z0-9.+:~\-]*',version):raise ValueError('invalid version')
 return package,version,arch
def check_stage(stage):
 stage=directory(stage);files=list(stage.iterdir())
 if len(files)>MAX_FILES:raise ValueError('archive count limit')
 total=0
 for p in files:
  identity(p.name);info=p.lstat()
  if not stat.S_ISREG(info.st_mode):raise ValueError('non-regular archive')
  if info.st_size>MAX_FILE:raise ValueError('archive size limit')
  total+=info.st_size
 if total>MAX_TOTAL:raise ValueError('total archive size limit')
 return sorted(files)
def validate_archive(path,lookup,archive_root=None):
 p=Path(path).absolute()
 if archive_root is not None and p.parent!=directory(archive_root):raise ValueError('archive outside root')
 package,version,arch=identity(p.name)
 try:fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 except OSError as e:raise ValueError('unsafe archive file') from e
 try:
  info=os.fstat(fd)
  if not stat.S_ISREG(info.st_mode) or not 0<info.st_size<=MAX_FILE:raise ValueError('archive size/type limit')
  with os.fdopen(fd,'rb',closefd=False) as f:data=f.read(MAX_FILE+1)
  after=os.fstat(fd)
  if (info.st_ino,info.st_size,info.st_mtime_ns)!=(after.st_ino,after.st_size,after.st_mtime_ns) or len(data)!=info.st_size:raise ValueError('archive changed while reading')
 finally:os.close(fd)
 meta=lookup(package,version,arch)
 if not meta or meta.get('trusted') is not True:raise ValueError('no trusted Ubuntu metadata')
 if any(meta.get(k)!=v for k,v in [('package',package),('version',version),('architecture',arch)]):raise ValueError('metadata identity mismatch')
 if meta.get('size')!=len(data):raise ValueError('archive size mismatch')
 digest=hashlib.sha256(data).hexdigest()
 if not re.fullmatch('[a-f0-9]{64}',str(meta.get('sha256',''))) or meta['sha256']!=digest:raise ValueError('archive hash mismatch')
 return {**meta,'name':p.name,'data':data}
def atomic_copy(stage,record):
 stage=directory(stage);target=stage/record['name'];temp=stage/('.'+record['name']+'.'+str(os.getpid())+'.tmp')
 try:
  fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
  with os.fdopen(fd,'wb') as f:f.write(record['data'])
  os.replace(temp,target)
 finally:
  if temp.exists():temp.unlink()
def verify_selected(paths,lookup,archive_root,stage):
 if len(paths)>MAX_FILES or len(paths)!=len(set(paths)):raise ValueError('duplicate/count selected archive limit')
 directory(stage);records=[validate_archive(p,lookup,archive_root) for p in paths]
 if sum(r['size'] for r in records)>MAX_TOTAL:raise ValueError('selected archive byte limit')
 for record in records:atomic_copy(stage,record)
 return [{k:v for k,v in r.items() if k!='data'} for r in records]
def trusted_lookup():
 import apt_pkg
 apt_pkg.init();cache=apt_pkg.Cache();sources=apt_pkg.SourceList();sources.read_main_list();records=apt_pkg.PackageRecords(cache)
 def lookup(package,version,arch):
  if package not in cache:return None
  for v in cache[package].version_list:
   if v.ver_str!=version or v.arch!=arch:continue
   for entry in v.file_list:
    index=sources.find_index(entry[0])
    if index is None or not index.is_trusted or entry[0].origin!='Ubuntu':continue
    records.lookup(entry);section=apt_pkg.TagSection(records.record)
    return {'package':section.get('Package'),'version':section.get('Version'),'architecture':section.get('Architecture'),'size':int(section.get('Size','0')),'sha256':records.sha256_hash,'trusted':True}
  return None
 return lookup
def evidence(name,value):
 root=directory(Path(os.environ['RUNNER_TEMP'])/'cim-webkit-install');(root/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
def hook_text(script,stage):
 if not all(re.fullmatch(r'/[A-Za-z0-9_./-]+',str(p)) for p in [script,stage]):raise ValueError('unsafe hook command path')
 command='/usr/bin/python3 -I '+str(script)+' verify '+str(stage)
 return 'DPkg::Pre-Install-Pkgs { "'+command+'"; };\n'
def configure():
 stage=directory(Path(os.environ['RUNNER_TEMP'])/'cim-webkit-debs');archives=directory('/var/cache/apt/archives');lookup=trusted_lookup();accepted=[];rejected=[]
 for file in check_stage(stage):
  try:r=validate_archive(file,lookup,stage)
  except ValueError as error:
   rejected.append({'name':file.name,'reason':str(error)});file.unlink();continue
  atomic_copy(archives,r);accepted.append({'name':r['name'],'size':r['size'],'sha256':r['sha256']})
 script=Path(__file__).resolve();text=hook_text(script,stage)
 Path('/etc/apt/apt.conf.d/zzzz-cim-webkit-cache-hook').write_text(text)
 command='/usr/bin/python3 -I '+str(script)+' verify '+str(stage)
 effective=subprocess.check_output(['/usr/bin/apt-config','dump'],text=True)
 if 'DPkg::Pre-Install-Pkgs:: "'+command+'";' not in effective.splitlines():raise ValueError('APT pre-install guard was overridden')
 result={'cacheHit':os.environ.get('CIM_APT_CACHE_HIT')=='true','accepted':accepted,'rejected':rejected,'bytes':sum(r['size'] for r in accepted),'hook':command}
 evidence('apt-cache-import',result);print('APT cache: restored='+str(len(accepted))+' rejected='+str(len(rejected))+' bytes='+str(result['bytes'])+'; fresh-index pre-install hash guard configured.')
def main():
 if os.geteuid()!=0:raise ValueError('root privilege is required for APT archive handling')
 if sys.argv[1:]==['configure']:configure();return
 if len(sys.argv)==3 and sys.argv[1]=='verify':
  stage=directory(sys.argv[2]);expected=directory(Path(os.environ['RUNNER_TEMP'])/'cim-webkit-debs')
  if stage!=expected:raise ValueError('unexpected staging root')
  text=sys.stdin.read(MAX_FILES*4096+1)
  if len(text)>MAX_FILES*4096:raise ValueError('selected archive input limit')
  paths=text.splitlines();result=verify_selected(paths,trusted_lookup(),'/var/cache/apt/archives',stage);evidence('apt-preinstall-verification',{'files':result,'bytes':sum(r['size'] for r in result)})
  print('APT fresh signed-index SHA256 verification: '+str(len(result))+' selected archives; staged exact verified bytes.');return
 raise ValueError('Usage: configure, or verify <fixed-stage>')
if __name__=='__main__':
 try:main()
 except Exception as e:print('CIM-CI-APT-CACHE: '+str(e),file=sys.stderr);sys.exit(1)
