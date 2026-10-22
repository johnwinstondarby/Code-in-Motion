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
export const DIAGRAM_CAPACITY=Object.freeze({locations:12,artifactsPerLocation:4,labelLines:4,maxHeight:190,width:620,fontSize:12});
const cues={pinned:'■',failed:'×',completed:'✓',published:'◆',verified:'◎',reproduced:'▣',absent:'○'};
const wrapLabel=(text,size=14)=>Array.from({length:Math.ceil(text.length/size)},(_,i)=>text.slice(i*size,(i+1)*size));
export function diagramDescription(snapshot){
 return 'Capture-derived model. '+snapshot.nodes.map(n=>`Location ${n.id} on host ${n.host}.`).join(' ')+' '+
  Object.entries(snapshot.state.artifacts).map(([id,a])=>`Artifact ${id}: ${a.status} (${words[a.status]}), ${a.location===null?'absent with no location':'at '+a.location}.`).join(' ')+' '+
  (snapshot.flows.length?snapshot.flows.map(f=>`Flow ${f.id}: ${flowWording(f)}; ${f.action}; ${f.result.status} (${words[f.result.status]}); by ${f.host}; evidence ${f.evidence}.`).join(' '):'Waiting on next diagram action.');
}
export function diagramGeometry(snapshot){
 const width=620,gap=20;
 const nodes=snapshot.nodes.map((node,i)=>{
  const labels=[{text:node.id+' · '+node.host},...node.artifacts.map(a=>({text:`${cues[a.status]} ${a.id}: ${a.status}`,artifact:a.id,status:a.status}))];
  if(!node.artifacts.length)labels.push({text:'○ idle'});
  for(const label of labels)label.lines=wrapLabel(label.text);
  return {...node,x:15+(i%4)*150,y:0,width:132,height:8+14*labels.reduce((n,l)=>n+l.lines.length,0),labels};
 });
 let bottom=20;
 for(let i=0;i<nodes.length;i+=4){const row=nodes.slice(i,i+4),height=Math.max(...row.map(n=>n.height));for(const n of row){n.y=bottom;let line=0;for(const label of n.labels){label.bounds=label.lines.map(text=>({x:n.x+6,y:n.y+2+14*line++,width:text.length*8,height:14}));}}bottom+=height+(i+4<nodes.length?gap:0);}
 const absent=Object.entries(snapshot.state.artifacts).filter(([,a])=>a.location===null).map(([id])=>id);
 const footerText=absent.length?'○ absent (no location): '+absent.join(', '):'All recorded artifacts have a location.';
 const footer={text:footerText,lines:wrapLabel(footerText,74),x:15,y:bottom+14};
 const height=bottom+footer.lines.length*14+8;
 const edges=snapshot.flows.filter(f=>f.from!==null&&f.from!==f.to).map(f=>({...f}));
 const locations=new Map(nodes.map(n=>[n.id,n]));
 for(const edge of edges){const a=locations.get(edge.from),b=locations.get(edge.to);if(!a||!b)fail('Flow points at an unknown location.');
  const x1=a.x+66,x2=b.x+66,lane1=a.y-12,lane2=b.y-12;
  edge.fromCenter={x:x1,y:a.y+a.height/2};edge.toCenter={x:x2,y:b.y+b.height/2};
  edge.points=[{x:x1,y:a.y-3},{x:x1,y:lane1},...(a.y===b.y?[]:[{x:610,y:lane1},{x:610,y:lane2}]),{x:x2,y:lane2},{x:x2,y:b.y-3}];
 }
 const labels=nodes.flatMap(n=>n.labels);
 const reason=nodes.length>DIAGRAM_CAPACITY.locations?'More than 12 locations.':nodes.some(n=>n.artifacts.length>DIAGRAM_CAPACITY.artifactsPerLocation)?'More than four artifacts at a location.':labels.some(l=>l.lines.length>DIAGRAM_CAPACITY.labelLines)||footer.lines.length>DIAGRAM_CAPACITY.labelLines?'A label needs more than four wrapped lines.':height>DIAGRAM_CAPACITY.maxHeight?'The complete drawing needs more than 190 pixels of height.':'';
 const within=reason==='';
 const elements=nodes.flatMap(n=>[{kind:'rect',x:n.x,y:n.y,width:n.width,height:n.height},...n.labels.flatMap(l=>l.bounds.map(b=>({kind:'text',...b})))]);
 footer.lines.forEach((line,i)=>elements.push({kind:'footer',x:15,y:footer.y-12+i*14,width:line.length*8,height:14}));
 for(const edge of edges){const xs=edge.points.map(p=>p.x),ys=edge.points.map(p=>p.y),end=edge.points.at(-1);elements.push({kind:'path',x:Math.min(...xs)-1,y:Math.min(...ys)-1,width:Math.max(...xs)-Math.min(...xs)+2,height:Math.max(...ys)-Math.min(...ys)+2},{kind:'arrow',x:end.x-5,y:end.y-8,width:10,height:8});for(const phase of [.1,.5,.9]){const t=diagramToken(edge,phase);elements.push({kind:'token',x:t.x-5,y:t.y-5,width:10,height:10});}}
 return {mode:within?'graph':'text',reason,width,height,nodes,edges,absent,footer,elements:within?elements:[]};
}
export function diagramToken(edge,phase){
 const points=edge.points;const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));let remaining=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,phase));
 for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]&&lengths[i]>0){const t=remaining/lengths[i];return{x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};}remaining-=lengths[i];}
 return {...points.at(-1)};
}
function graphicalDiagram(doc,snapshot,geometry,phase){
 const svg=(tag,attrs={},text)=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 const image=svg('svg',{viewBox:`0 0 ${geometry.width} ${geometry.height}`,role:'img','aria-label':'Capture-derived locations and artifacts','data-diagram-svg':'',style:`--cim-diagram-height:${geometry.height}px`});
 image.append(svg('title',{},'Engineering diagram · modeled'),svg('desc',{},diagramDescription(snapshot)));
 for(const edge of geometry.edges){const group=svg('g',{'aria-hidden':'true','data-flow-record':edge.id}),end=edge.points.at(-1);group.append(svg('path',{d:edge.points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '),stroke:'#b8c9da','stroke-width':2,fill:'none'}),svg('path',{d:`M ${end.x-5} ${end.y-8} L ${end.x} ${end.y} L ${end.x+5} ${end.y-8}`,stroke:'#b8c9da',fill:'none'}));if(phase){const p=diagramToken(edge,phase);group.append(svg('circle',{cx:p.x,cy:p.y,r:5,fill:'#ffd06d','data-graph-token':edge.id}));}image.append(group);}
 for(const n of geometry.nodes){const group=svg('g',{'data-location-id':n.id});group.append(svg('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:5,fill:'#152330',stroke:'#889fb5','aria-hidden':'true'}));
  for(const label of n.labels){const attrs={'font-size':12,'font-family':'monospace','xml:space':'preserve',fill:'#f1f5fa','data-label-raw':label.text};if(label.artifact){attrs['data-artifact-id']=label.artifact;attrs['data-status-cue']=label.status;}const text=svg('text',attrs);label.lines.forEach((line,i)=>text.append(svg('tspan',{x:label.bounds[i].x,y:label.bounds[i].y+12},line)));group.append(text);}image.append(group);
 }
 const footer=svg('text',{'font-size':12,'font-family':'monospace','xml:space':'preserve',fill:'#c2d0dc','data-label-raw':geometry.footer.text});geometry.footer.lines.forEach((line,i)=>footer.append(svg('tspan',{x:15,y:geometry.footer.y+i*14},line)));image.append(footer);
 return image;
}
function draw(root,snapshot,config,phase=null,error=null,graphical=false){
 const doc=root.ownerDocument,element=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const frame=element('section',null,{class:'engineering-diagram','aria-label':'Engineering diagram and text alternative'});
 frame.append(element('h4','Diagram · modeled'));
 if(config.placeholder)frame.append(element('strong','Placeholder content',{'data-placeholder':'true'}));
 frame.append(element('p','Capture-derived model · not a live connection'));
 if(error){frame.append(element('p','Diagram unavailable · CIM-PANE-DIAGRAM-RECORDS'),element('p','Text alternative: capture records could not be resolved. Use the Explanation and check the capture references.'));root.replaceChildren(frame);return;}
 const geometry=graphical?diagramGeometry(snapshot):null;
 if(graphical&&geometry.mode==='text')frame.append(element('p','This diagram is too large to draw here. The full state is listed below. '+geometry.reason,{role:'status','aria-live':'polite','data-diagram-capacity-note':''}));
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
 if(graphical){
  const full=element('p',diagramDescription(snapshot),{'data-diagram-full-state':''});
  if(geometry.mode==='graph'){const text=element('details',null,{'data-diagram-text':''});text.append(element('summary','Full text view'),full);grid.replaceChildren(graphicalDiagram(doc,snapshot,geometry,phase),text);grid.className='engineering-graph';}
  else {grid.className='engineering-capacity-text';grid.append(full);}
 }root.replaceChildren(frame);
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
