// Fixture-only diagram/v1. No registration, admission, network or engine authority.
import {createPaneLifecycle,readonlyPaneData} from '../contracts/pane.mjs';
const fail=message=>{throw new Error('CIM-PANE-DIAGRAM-RECORDS: '+message);};
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const statuses={pin:'pinned',fail:'failed',complete:'completed',publish:'published',verify:'verified',evaluate:'reproduced'};
const words={absent:'idle',pinned:'used',completed:'used',published:'used',failed:'failed',verified:'custody verified',reproduced:'reproduction checked'};
const allowed=new Set(['fixtureOnly','placeholder','hosts','services','artifacts','initial','records','evidence','beats','archive']);
function inspect(config){
 if(config.fixtureOnly!==true)throw new TypeError('Engineering requires a test fixture.');
 if(Object.keys(config).some(k=>!allowed.has(k)))throw new TypeError('Unexpected Engineering capability or configuration.');
 const id=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,99}$/.test(x);
 const unique=(list,key)=>Array.isArray(list)&&list.length<=256&&list.every(x=>id(key?x[key]:x))&&new Set(list.map(x=>key?x[key]:x)).size===list.length;
 if(typeof config.placeholder!=='boolean'||!unique(config.hosts)||!unique(config.services,'id')||!unique(config.artifacts)||!unique(config.records,'id')||!unique(config.evidence,'id')||!unique(config.beats,'id'))fail('Invalid identifiers, counts or provenance.');
 if(config.services.some(s=>!config.hosts.includes(s.host)))fail('Unknown service host.');
 const state=structuredClone(config.initial),records=new Map(config.records.map(r=>[r.id,r])),used=new Set(),snapshots=new Map();
 if(!state?.artifacts||canonical(Object.keys(state.artifacts).sort())!==canonical([...config.artifacts].sort())||Object.values(state.artifacts).some(s=>s.location!==null||s.status!=='absent'))fail('Invalid initial state.');
 const nodes=()=>config.services.map(s=>({id:s.id,host:s.host,artifacts:config.artifacts.filter(id=>state.artifacts[id].location===s.id).map(id=>({id,...state.artifacts[id]}))}));
 snapshots.set('initial',{state:structuredClone(state),nodes:nodes(),flows:[]});
 for(const beat of config.beats){
  if(!Array.isArray(beat.records)||beat.records.length>256)fail('Invalid beat references.');
  const flows=[];
  for(const recordId of beat.records){
   const r=records.get(recordId);if(!r||used.has(recordId)||r.beat!==beat.id||r.pane!=='engineering'||!config.hosts.includes(r.host)||!config.services.some(s=>s.id===r.service)||!config.artifacts.includes(r.artifact)||!config.evidence.some(e=>e.id===r.evidence)||r.provenance!==(config.placeholder?'placeholder':'captured'))fail('Missing or invalid capture reference.');
   const prior=state.artifacts[r.artifact];
   if(!r.result||r.from!==prior.location||r.result.location!==r.service||r.result.status!==(statuses[r.action]??(r.action==='observe'?prior.status:null))||(['verify','evaluate'].includes(r.action)&&prior.status==='absent')||(r.action==='observe'&&canonical(r.result)!==canonical(prior)))fail('Record contradicts source, action or result.');
   used.add(recordId);state.artifacts[r.artifact]=structuredClone(r.result);
   // A displayed flow is identified by the capture record itself, not an invented topology edge.
   flows.push({id:r.id,from:r.from,to:r.service,host:r.host,artifact:r.artifact,action:r.action,result:r.result,evidence:r.evidence,raw:{archive:config.archive.id,root:config.archive.root,...config.evidence.find(e=>e.id===r.evidence)}});
  }
  if(canonical(state)!==canonical(beat.state))fail('Claimed state differs from capture-derived state.');
  snapshots.set(beat.id,{state:structuredClone(state),nodes:nodes(),flows});
 }
 if(used.size!==records.size)fail('Unused capture record.');
 return snapshots;
}
export function diagramSnapshot(config,stepId){const snapshots=inspect(config),snapshot=snapshots.get(stepId);if(!snapshot)fail('Unknown beat.');return readonlyPaneData(snapshot);}
export function flowWording(f){return f.from===f.to?`${f.artifact} stayed at ${f.to}`:f.from===null?`${f.artifact} placed at ${f.to}`:`${f.artifact} moved from ${f.from} to ${f.to}`;}
export function diagramGeometry(snapshot){
 const nodes=snapshot.nodes.map((node,i)=>({...node,x:15+(i%4)*150,y:5+Math.floor(i/4)*83}));
 return {nodes,edges:snapshot.flows.filter(f=>f.from!==null&&f.from!==f.to).map(f=>({...f})),absent:Object.entries(snapshot.state.artifacts).filter(([,a])=>a.location===null).map(([id])=>id)};
}
function graphicalDiagram(doc,snapshot,phase){
 const geometry=diagramGeometry(snapshot),svg=(tag,attrs={},text)=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 const image=svg('svg',{viewBox:'0 0 620 190',role:'img','aria-label':'Capture-derived locations and artifacts','data-diagram-svg':''});
 image.append(svg('title',{},'Engineering diagram · modeled'),svg('desc',{},'Locations and artifact states derived from capture records. Current flows and full text alternatives precede this diagram.'));
 const locations=new Map(geometry.nodes.map(n=>[n.id,n]));
 for(const f of geometry.edges){const a=locations.get(f.from),b=locations.get(f.to);if(!a||!b)fail('Flow points at an unknown location.');const x1=a.x+65,y1=a.y+35,x2=b.x+65,y2=b.y+35;const group=svg('g',{'aria-hidden':'true','data-flow-record':f.id});group.append(svg('path',{d:`M ${x1} ${y1} L ${x2} ${y2}`,stroke:'#b8c9da','stroke-width':2,fill:'none'}));const angle=Math.atan2(y2-y1,x2-x1),tipX=x2-Math.cos(angle)*38,tipY=y2-Math.sin(angle)*38;group.append(svg('path',{d:`M ${tipX-8*Math.cos(angle-.5)} ${tipY-8*Math.sin(angle-.5)} L ${tipX} ${tipY} L ${tipX-8*Math.cos(angle+.5)} ${tipY-8*Math.sin(angle+.5)}`,stroke:'#b8c9da',fill:'none'}));if(phase)group.append(svg('circle',{cx:x1+(x2-x1)*phase,cy:y1+(y2-y1)*phase,r:5,fill:'#ffd06d','data-graph-token':f.id}));image.append(group);}
 const cues={pinned:'■',failed:'×',completed:'✓',published:'◆',verified:'◎',reproduced:'▣',absent:'○'};
 for(const n of geometry.nodes){const group=svg('g',{'data-location-id':n.id});group.append(svg('rect',{x:n.x,y:n.y,width:132,height:78,rx:5,fill:'#152330',stroke:'#889fb5','aria-hidden':'true'}));group.append(svg('text',{x:n.x+5,y:n.y+17,'font-size':12,fill:'#f1f5fa'},n.id+' · '+n.host));for(const[aIndex,a]of n.artifacts.entries()){group.append(svg('text',{x:n.x+5,y:n.y+34+aIndex*12,'font-size':12,fill:'#f1f5fa','data-artifact-id':a.id,'data-status-cue':a.status},`${cues[a.status]} ${a.id}: ${a.status}`));}image.append(group);}
 image.append(svg('text',{x:15,y:183,'font-size':12,fill:'#c2d0dc'},geometry.absent.length?'○ absent (no location): '+geometry.absent.join(', '):'All recorded artifacts have a location.'));
 return image;
}
function draw(root,snapshot,config,phase=null,error=null,graphical=false){
 const doc=root.ownerDocument,element=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const frame=element('section',null,{class:'engineering-diagram','aria-label':'Engineering diagram and text alternative'});
 frame.append(element('h4','Diagram · modeled'));
 if(config.placeholder)frame.append(element('strong','Placeholder content',{'data-placeholder':'true'}));
 frame.append(element('p','Capture-derived model · not a live connection'));
 if(error){frame.append(element('p','Diagram unavailable · CIM-PANE-DIAGRAM-RECORDS'),element('p','Text alternative: capture records could not be resolved. Use the Explanation and check the capture references.'));root.replaceChildren(frame);return;}
 const grid=element('div',null,{class:'engineering-nodes'});
 for(const node of snapshot.nodes){const labels=node.artifacts.length?node.artifacts.map(a=>`${a.id}: ${words[a.status]}`).join('; '):'idle';grid.append(element('div',`${node.id} · ${node.host} — ${phase&&snapshot.flows.some(f=>f.to===node.id)?'in progress; ':''}${labels}`,{'data-node-id':node.id,'data-status':phase&&snapshot.flows.some(f=>f.to===node.id)?'progress':node.artifacts.at(-1)?.status??'absent'}));}
 const flow=element('div',null,{class:'engineering-flows','aria-label':'Current beat flow and evidence'});
 if(!snapshot.flows.length)flow.append(element('p','Waiting on next diagram action'));
 const evidence=element('details',null,{'data-diagram-evidence':''});evidence.append(element('summary','Show evidence'));
 for(const f of snapshot.flows){
  const row=element('p',`${flowWording(f)} · ${words[f.result.status]} · by ${f.host}`,{'data-edge-id':f.id});
  if(phase){const token=element('span','●',{'aria-hidden':'true','data-diagram-token':f.id});token.style.transform=`translateX(${phase*80}px)`;const track=element('span',null,{class:'engineering-edge','aria-hidden':'true'});track.append(token);row.append(track);}
  flow.append(row);
  evidence.append(element('p',`${f.id}: ${f.action} → ${f.result.status}; raw evidence: ${f.evidence} (${f.raw.archive}/${f.raw.root}/${f.raw.path}; SHA-256 ${f.raw.sha256})`));
 }
 frame.append(flow);frame.append(evidence);frame.append(grid);
 if(graphical){grid.replaceChildren(graphicalDiagram(doc,snapshot,phase));grid.className='engineering-graph';}root.replaceChildren(frame);
}
export function createEngineeringPane({graphical=false}={}){
 let config,root,disposed=false;
 const lifecycle=createPaneLifecycle({validate(state,c,context){diagramSnapshot(c,context.stepId);},
 frames:()=>[{delayMs:0,position:0.1},{delayMs:80,position:0.5},{delayMs:80}],
 settle(target,state,c,context){if(graphical)draw(target,diagramSnapshot(c,context.stepId),c,null,null,true);else draw(target,diagramSnapshot(c,context.stepId),c);},
 frame(target,frame,state,c,context){draw(target,diagramSnapshot(c,context.stepId),c,frame.position,null,graphical);},dispose(target){target.replaceChildren();}});
 const showError=()=>draw(root,null,config,null,true);
 return Object.freeze({mount(target,data,identity){if(data.fixtureOnly!==true)throw new TypeError('Engineering requires a test fixture.');config=readonlyPaneData(data);if(Object.keys(config).some(k=>!allowed.has(k)))throw new TypeError('Unexpected Engineering capability.');root=target;lifecycle.mount(target,config,identity);},
 settle(state,context){if(disposed)throw new Error('Engineering disposed.');try{lifecycle.settle(state,context);}catch(error){showError();}},
 async play(state,context){if(disposed)throw new Error('Engineering disposed.');const result=await lifecycle.play(state,context);if(result.status==='failed'&&!disposed)showError();return result;},
 dispose(){disposed=true;lifecycle.dispose();}});
}
