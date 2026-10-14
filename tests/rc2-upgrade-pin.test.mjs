import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {resolveWordPressUpgradePair} from '../tools/build-wordpress-upgrade-fixture.mjs';
test('RC2 upgrade pin starts at live 0.1.10, skips intervening 0.1.11 and rejects a mismatched version',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cim-pinned-upgrade-'));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try {
    git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
    const commits=[];
    for(const version of ['0.1.10','0.1.11','0.2.0']) {writeFileSync(join(root,'package.json'),JSON.stringify({version}));git('add','package.json');git('commit','-m',version);commits.push(git('rev-parse','HEAD'));}
    const pinned=await resolveWordPressUpgradePair(root,{priorRef:commits[0],priorVersion:'0.1.10'});
    assert.deepEqual(pinned.prior,{sha:commits[0],version:'0.1.10'});assert.equal(pinned.current.version,'0.2.0');
    await assert.rejects(()=>resolveWordPressUpgradePair(root,{priorRef:commits[1],priorVersion:'0.1.10'}),/pinned prior release version/);
    assert.equal((await resolveWordPressUpgradePair(root)).prior.version,'0.1.11');
  } finally {assert.ok(resolve(root).startsWith(resolve(tmpdir(),'cim-pinned-upgrade-')));rmSync(root,{recursive:true,force:true});}
});
