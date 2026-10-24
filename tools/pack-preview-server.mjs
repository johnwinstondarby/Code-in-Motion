import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildV3Pack} from '../authoring/v3/pack.mjs';
import {admitV3Pack,createDevelopmentAdmission} from '../authoring/v3/admission.mjs';
import {V3ValidationError} from '../authoring/v3/validate.mjs';
import {formatAuthoringError} from './authoring-diagnostics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const hash=b=>createHash('sha256').update(b).digest('hex');
const mime=path=>({'.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8'}[extname(path)]??'text/plain; charset=utf-8');
const reject=(path,message,fix)=>{throw new V3ValidationError([{id:'CIM-V3-PREVIEW',path,fix,message:message+' Fix: '+fix}]);};
export async function startV3Preview(source,{port=0}={}){
 const staticFiles=new Map(),snapshots=new Map(),identity=createDevelopmentAdmission('authoring-preview');let pending=null;
 async function collect(folder){for(const entry of await readdir(resolve(root,folder),{withFileTypes:true})){const file=folder+'/'+entry.name;if(entry.isDirectory())await collect(file);else if(entry.isFile()&&/\.(mjs|js|css)$/.test(file))staticFiles.set('/'+file,await readFile(resolve(root,file)));}}
 await collect('src');
 for(const file of ['tools/pack-preview-client.mjs','tools/pack-preview-driver.mjs','tools/pack-preview.css','authoring/v3/production-media.mjs'])staticFiles.set('/'+file,await readFile(resolve(root,file)));
 const license=await readFile(resolve(root,'LICENSE'),'utf8');
 async function snapshot(){
  if(pending)return pending;
  pending=(async()=>{const result=await buildV3Pack(source,license);
   if(!admitV3Pack(result.manifest,identity))reject('$host','This pack is not admitted by the explicit development preview identity.','Use the documented 1.1.0 pack interval; published 1.0.1 cannot load this pack.');
   if(!result.manifest.placeholder||result.compiled.document.renderer_config.panes.some(p=>p.id!==({'console/v1':'console','explanation/v1':'explanation','diagram/v1':'engineering','motion/v1':'motion'}[p.type])))reject('$.panes','This local preview requires the placeholder starter pane identities.','Keep the starter pane IDs and placeholder mode; general host admission waits for Part C.');
   snapshots.delete(result.sha256);snapshots.set(result.sha256,result);while(snapshots.size>2)snapshots.delete(snapshots.keys().next().value);return result;
  })();try{return await pending;}finally{pending=null;}
 }
 const shell=(body,script=false)=>'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CiM v3 local authoring preview</title><link rel="stylesheet" href="/src/multipane/controls.css"><link rel="stylesheet" href="/src/multipane/composition.css"><link rel="stylesheet" href="/src/multipane/engineering.css"><link rel="stylesheet" href="/tools/pack-preview.css"><header data-preview-identity>CiM 1.1.0-dev Â· Local preview Â· Placeholder Â· simulated</header>'+body+(script?'<script type="module" src="/tools/pack-preview-client.mjs"></script>':'')+'</html>';
 const server=createServer(async(request,response)=>{
  const origin='http://127.0.0.1:'+server.address().port;
  if(request.headers.host!==new URL(origin).host||request.headers.origin&&request.headers.origin!==origin){response.writeHead(403).end('Local preview only.');return;}
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
  response.setHeader('cache-control','no-store');response.setHeader('x-content-type-options','nosniff');
  response.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const path=request.url;
  if(!path||path.includes('%')||path.includes('\\')||path.includes('?')||path.split('/').some(p=>p==='..'||p==='.')){response.writeHead(404).end('Not found.');return;}
  const send=(bytes,type,status=200)=>{response.writeHead(status,{'content-type':type,'content-length':bytes.length});response.end(request.method==='HEAD'?undefined:bytes);};
  try{
   if(path==='/'){
    const result=await snapshot(),base='/pack/'+result.sha256+'/',manifestHash=hash(result.entries.get('cim-lesson-pack.json'));
    send(Buffer.from(shell('<pre id="preview-error" role="status"></pre><main id="preview-player" data-cim-preview="loading" data-cim-pack-base="'+base+'" data-cim-manifest-sha="'+manifestHash+'"></main>',true)),'text/html; charset=utf-8');return;
   }
   if(staticFiles.has(path)){send(staticFiles.get(path),mime(path));return;}
   const match=/^\/(pack|__cim_fixture_media)\/([a-f0-9]{64})\/(.+)$/.exec(path);
   if(match){const result=snapshots.get(match[2]),file=match[3];if(result?.entries.has(file)&&(match[1]==='pack'||result.preflight.media.some(f=>f.path===file))){send(result.entries.get(file),mime(file));return;}}
   response.writeHead(404).end('Not found.');
  }catch(error){if(response.headersSent){response.destroy();return;}send(Buffer.from(shell('<pre id="preview-error" role="alert">'+escape(formatAuthoringError(error))+'</pre>')),'text/html; charset=utf-8',422);}
 });
 server.maxConnections=64;server.headersTimeout=5000;server.requestTimeout=10000;server.on('close',()=>snapshots.clear());
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});return{server,url:'http://127.0.0.1:'+server.address().port};
}
