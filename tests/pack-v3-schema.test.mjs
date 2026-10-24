import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import {SCHEMAS,validateShape,validateDocument} from '../authoring/v3/validate.mjs';
import {packSource} from './helpers/pack-v3-source.mjs';
test('[PB-26] pack media schema and bounded checker agree with Ajv on production shapes',async()=>{
 const s=await packSource(),ajv=new Ajv2020({strict:false,allErrors:true}),check=ajv.compile(SCHEMAS.media);assert(check(s.media));assert.deepEqual(validateDocument(s.media,'media').diagnostics,[]);
 for(const change of [m=>delete m.assets[0].codec,m=>delete m.assets[0].webm.codec,m=>m.assets[0].source={type:'attachment',id:12},m=>m.extra=true,m=>m.assets[0].size=4194305,m=>m.assets[0].captions.extra=true]){const m=structuredClone(s.media);change(m);assert.equal(check(m),false);assert.equal(validateShape(m,SCHEMAS.media).length===0,check(m));assert(validateDocument(m,'media').diagnostics.length>0);}
});
