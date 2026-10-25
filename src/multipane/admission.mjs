// Production admission for compiled panes/v1 lessons (ADR 0061 step 7 Part C).
// The Admin check and the public Player use this one boundary. It issues an
// unforgeable token bound to the exact admitted data; fixtures keep testFixture.
import {validateExperience} from '../experience/validate-experience.mjs';
import {ENGINE_IDENTITY} from '../contracts/engine-identity.mjs';
import {readonlyPaneData} from '../contracts/pane.mjs';
import {validateMediaMap} from './media-map.mjs';
import {validateEngineeringRecords} from './engineering.mjs';
import {panesProjectionProblem,panesModelProblem} from './projection.mjs';

export const PANES_ENGINE_TARGET='1.1.0';
const issuedIdentities=new WeakMap(),tokens=new WeakMap();
const release=v=>typeof v==='string'&&/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(v);
const compare=(a,b)=>{for(let i=0;i<3;i++){const d=Number(a.split('.')[i])-Number(b.split('.')[i]);if(d)return d;}return 0;};
const fail=message=>{throw new TypeError('CIM-PANES-ADMISSION: '+message);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/** Host identity is issued here, never read from lesson data. Development mode is explicit. */
export function createHostIdentity({developmentAdmission=false}={}){
 if(developmentAdmission!==true&&developmentAdmission!==false)throw new TypeError('Development admission must be an explicit boolean.');
 const identity=Object.freeze(developmentAdmission?{version:'1.1.0-dev',channel:'development'}:{version:ENGINE_IDENTITY.version,channel:'release'});
 // The development identity stands in for exactly the tested target; the interval itself is never widened.
 issuedIdentities.set(identity,developmentAdmission?PANES_ENGINE_TARGET:ENGINE_IDENTITY.version);
 return identity;
}

export function admitPanesLesson({experience,capture,identity}={}){
 const effective=object(identity)?issuedIdentities.get(identity):undefined;
 if(!release(effective))fail('Unrecognised host identity. Use the identity issued by createHostIdentity.');
 let doc,records;
 try{doc=readonlyPaneData(experience);records=readonlyPaneData(capture);}catch{fail('Lesson and capture must be plain JSON data.');}
 if(!object(doc)||doc.schema!=='localis.cim/v2'||doc.renderer!=='panes/v1')fail('Expected a compiled localis.cim/v2 panes/v1 lesson.');
 if(!release(doc.engine_min))fail('engine_min must be a release semantic version.');
 if(compare(effective,doc.engine_min)<0)fail(`This lesson needs CiM ${doc.engine_min} or later; this host is ${identity.version}.`);
 const errors=validateExperience(doc);
 if(errors.length)fail('Invalid lesson envelope: '+errors.slice(0,3).map(e=>e.path+' '+e.message).join('; '));
 const config=doc.renderer_config;
 // Every stored snapshot must equal the replay the Player will settle (PR #111 review).
 const projection=panesProjectionProblem(doc);
 if(projection)fail(projection);
 // Then the Player model's own preconditions, shared so admission and the model cannot disagree (review round 3).
 const model=panesModelProblem(doc);
 if(model)fail(model.reason);
 // 1.1.0 admits placeholder lessons only: no real-capture verification exists yet.
 if(config?.placeholder?.enabled!==true||config.placeholder.label!=='Placeholder content'||doc.initial_state.placeholder!==true||doc.steps.some(s=>s.state.placeholder!==true))fail('Only placeholder multi-pane lessons are admitted in 1.1.0.');
 const media=config.media;
 const mediaErrors=validateMediaMap(media);
 if(mediaErrors.length)fail('Invalid media map: '+mediaErrors[0].id+' at '+mediaErrors[0].path);
 if(media.status!=='pack'||media.placeholder!==true)fail('Pack media must use the pack form in placeholder mode.');
 const assets=new Set(media.assets.map(a=>a.id));
 for(const snapshot of [doc.initial_state,...doc.steps.map(s=>s.state)]){
  for(const pane of config.panes.filter(p=>p.type==='motion/v1')){const asset=snapshot.panes[pane.id]?.asset;if(asset!==undefined&&!assets.has(asset))fail('A GUI action names an unknown media asset.');}
 }
 if(!object(records)||records.schema!=='localis.cim/engineering-capture/v1'||records.id!==config.capture_id)fail('Capture does not match the lesson.');
 if(records.placeholder!==true||!Array.isArray(records.records)||records.records.some(r=>r?.provenance!=='placeholder'))fail('Placeholder lessons require placeholder capture records; captured evidence is not admitted in 1.1.0.');
 const engineeringPane=config.panes.find(p=>p.type==='diagram/v1')?.id;
 const engineering=readonlyPaneData({placeholder:true,hosts:config.architecture.hosts,services:config.architecture.services,artifacts:config.architecture.artifacts,initial:doc.initial_state.panes[engineeringPane],archive:{id:records.archive.id,root:records.archive.root},records:records.records,evidence:records.archive.files,beats:doc.steps.map(s=>({id:s.id,records:s.state.engineering_records.map(r=>r.id),state:s.state.panes[engineeringPane]}))});
 try{validateEngineeringRecords(engineering);}catch(error){fail('Engineering records do not reproduce the lesson state: '+error.message);}
 const token=Object.freeze({});
 tokens.set(token,Object.freeze({experience:JSON.stringify(doc),engineering:JSON.stringify(engineering)}));
 return Object.freeze({token,experience:doc,engineering,media});
}

/** True only for a token issued above whose bound lesson text equals this experience. */
export function isAdmittedExperience(token,experience){
 const bound=object(token)?tokens.get(token):undefined;
 try{return bound!==undefined&&bound.experience===JSON.stringify(experience);}catch{return false;}
}
export function isAdmittedEngineering(token,config){
 const bound=object(token)?tokens.get(token):undefined;
 try{return bound!==undefined&&bound.engineering===JSON.stringify(config);}catch{return false;}
}
