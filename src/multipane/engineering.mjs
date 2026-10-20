// Fixture-only diagram/v1. No registration, admission, network or engine authority.
import {createPaneLifecycle,readonlyPaneData} from '../contracts/pane.mjs';
const fail=message=>{throw new Error('CIM-DIAGRAM-RECORDS: '+message);};
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
function draw(root,snapshot,config,phase=null,error=null){
 const doc=root.ownerDocument,element=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const frame=element('section',null,{class:'engineering-diagram','aria-label':'Engineering diagram and text alternative'});
 frame.append(element('h4','Diagram · modeled'));
 if(config.placeholder)frame.append(element('strong','Placeholder content',{'data-placeholder':'true'}));
 frame.append(element('p','Capture-derived model · not a live connection'));
 if(error){frame.append(element('p','Diagram unavailable · CIM-DIAGRAM-RECORDS'),element('p','Text alternative: capture records could not be resolved. Use the Explanation and check the capture references.'));root.replaceChildren(frame);return;}
 const grid=element('div',null,{class:'engineering-nodes'});
 for(const node of snapshot.nodes){const labels=node.artifacts.length?node.artifacts.map(a=>`${a.id}: ${words[a.status]}`).join('; '):'idle';grid.append(element('div',`${node.id} · ${node.host} — ${phase&&snapshot.flows.some(f=>f.to===node.id)?'in progress; ':''}${labels}`,{'data-node-id':node.id,'data-status':phase&&snapshot.flows.some(f=>f.to===node.id)?'progress':node.artifacts.at(-1)?.status??'absent'}));}
 frame.append(grid);
 const flow=element('div',null,{class:'engineering-flows','aria-label':'Current beat flow and evidence'});
 if(!snapshot.flows.length)flow.append(element('p','Waiting on next diagram action'));
 for(const f of snapshot.flows){const row=element('p',`${f.id}: ${f.host}; ${f.artifact}: ${f.from??'initial'} → ${f.to}; ${f.action} → ${f.result.status}; raw evidence: ${f.evidence} (${f.raw.archive}/${f.raw.root}/${f.raw.path}; SHA-256 ${f.raw.sha256})`,{'data-edge-id':f.id});if(phase){const token=element('span','●',{'aria-hidden':'true','data-diagram-token':f.id});token.style.transform=`translateX(${phase*80}px)`;const track=element('span',null,{class:'engineering-edge','aria-hidden':'true'});track.append(token);row.append(track);}flow.append(row);}
 frame.append(flow);root.replaceChildren(frame);
}
export function createEngineeringPane(){
 let config,root,disposed=false;
 const lifecycle=createPaneLifecycle({validate(state,c,context){diagramSnapshot(c,context.stepId);},
 frames:()=>[{delayMs:0,position:0.1},{delayMs:80,position:0.5},{delayMs:80}],
 settle(target,state,c,context){draw(target,diagramSnapshot(c,context.stepId),c);},
 frame(target,frame,state,c,context){draw(target,diagramSnapshot(c,context.stepId),c,frame.position);},dispose(target){target.replaceChildren();}});
 const showError=()=>draw(root,null,config,null,true);
 return Object.freeze({mount(target,data,identity){if(data.fixtureOnly!==true)throw new TypeError('Engineering requires a test fixture.');config=readonlyPaneData(data);if(Object.keys(config).some(k=>!allowed.has(k)))throw new TypeError('Unexpected Engineering capability.');root=target;lifecycle.mount(target,config,identity);},
 settle(state,context){if(disposed)throw new Error('Engineering disposed.');try{lifecycle.settle(state,context);}catch(error){showError();}},
 async play(state,context){if(disposed)throw new Error('Engineering disposed.');const result=await lifecycle.play(state,context);if(result.status==='failed'&&!disposed)showError();return result;},
 dispose(){disposed=true;lifecycle.dispose();}});
}



