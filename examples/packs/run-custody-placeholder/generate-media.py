"""Optional media regeneration. Pack builds use committed bytes, never this script.
Different FFmpeg/font versions are not promised to reproduce the committed video.
"""
from pathlib import Path
import subprocess, tempfile, json, hashlib, os
ROOT=Path(__file__).resolve().parent
FONT=os.environ.get('CIM_PLACEHOLDER_FONT','C:/Windows/Fonts/arial.ttf')
def run(args,**kwargs):return subprocess.check_output(args,text=True,encoding='utf-8',**kwargs)
def descriptor(path,mime,codec,duration):
 b=(ROOT/path).read_bytes();return {'source':{'type':'pack','path':path},'size':len(b),'sha256':hashlib.sha256(b).hexdigest(),'type':mime,'codec':codec,'duration':duration}
versions={name:run([name,'-version']) for name in ['ffmpeg','ffprobe']};versions['font']=FONT;versions['regeneration']='Tool/font versions affect bytes; normal builds use committed media.'
assets=[];streams=[]
for asset,name,title in [('gpu-memory','submit-fail','Submit job - simulated failure'),('mlflow-metadata','track-mlflow','Track run metadata - MLflow')]:
 copies=[]
 with tempfile.TemporaryDirectory(prefix='cim-placeholder-') as temp:
  temp=Path(temp)
  for file,text in [('label.txt','Placeholder · simulated'),('action.txt',title),('notice.txt','No real lab recording exists.')]: (temp/file).write_text(text,encoding='utf-8')
  font=FONT.replace('\\','/').replace(':','\\:')
  filters="drawbox=x=24:y=24:w=592:h=312:color=0x6c90b1:t=2,"+','.join("drawtext=fontfile='"+font+"':textfile="+file+":fontcolor="+color+":fontsize="+str(size)+":x=(w-tw)/2:y="+str(y) for file,color,size,y in [('label.txt','0xffd06d',34,76),('action.txt','white',25,160),('notice.txt','0xcbd7e4',20,260)])
  for extension,mime in [('mp4','video/mp4'),('webm','video/webm')]:
   path='media/'+name+'.'+extension;output=ROOT/path
   encoder=['-c:v','libx264','-profile:v','baseline','-level:v','3.0','-preset','medium','-crf','28','-pix_fmt','yuv420p','-movflags','+faststart'] if extension=='mp4' else ['-c:v','libvpx','-deadline','good','-cpu-used','0','-b:v','200k','-pix_fmt','yuv420p']
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x101b2a:s=640x360:r=30','-t','2.4','-vf',filters,'-an',*encoder,'-threads','1','-fflags','+bitexact','-flags:v','+bitexact','-map_metadata','-1',str(output)],cwd=temp,check=True)
   info=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]));stream=info['streams'][0];duration=float(info['format']['duration'])
   b=output.read_bytes();i=b.find(b'avcC');codec='avc1.'+b[i+5:i+8].hex() if extension=='mp4' else 'vp8'
   item=descriptor(path,mime,codec,duration);caption='captions/'+name+'-'+extension+'.vtt'
   (ROOT/caption).write_text('WEBVTT\n\n00:00.000 --> 00:02.400\nPlaceholder · simulated\n'+title+'\n',encoding='utf-8',newline='\n')
   cap=(ROOT/caption).read_bytes();item['captions']={'source':{'type':'pack','path':caption},'size':len(cap),'sha256':hashlib.sha256(cap).hexdigest(),'type':'text/vtt','language':'en','label':'Placeholder · simulated'};copies.append(item)
   streams.append({'file':path,**{k:stream.get(k) for k in ['codec_name','profile','level','width','height','pix_fmt','r_frame_rate','nb_frames']},'duration':duration,'codecDeclaration':codec})
 assets.append({'id':asset,**copies[0],'alt':'Placeholder · simulated interface. No real lab recording exists.','webm':copies[1]})
(ROOT/'media.json').write_text(json.dumps({'schema':'localis.cim/media/v1','status':'pack','placeholder':True,'assets':assets},indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
(ROOT/'MEDIA-TOOLS.json').write_text(json.dumps({'tools':versions,'streams':streams},indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
