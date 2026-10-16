import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsoleWrapBinding} from '../wordpress/assets/console-wrap-binding.mjs';
function line(text,prior='') {
  const values=new Map(prior?[['--cim-continuation-indent',prior]]:[]);
  return {textContent:text,style:{getPropertyValue:key=>values.get(key)??'',setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key),get length(){return values.size;}},removeAttribute(){}};
}
test('continuation indentation follows preserved authored spaces without rewriting text',()=>{
  const nodes=[0,2,4,8].map(spaces=>line(' '.repeat(spaces)+'text'));
  const binding=createConsoleWrapBinding({rendererRoot:{querySelectorAll:()=>nodes}});
  binding.refresh();
  for(const [i,spaces] of [0,2,4,8].entries()) {
    assert.equal(nodes[i].style.getPropertyValue('--cim-continuation-indent'),`${spaces+2}ch`);
    assert.equal(nodes[i].textContent,' '.repeat(spaces)+'text');
  }
});
test('continuation geometry refreshes after renderer text or nodes change',()=>{
  const nodes=[line('  before')];const binding=createConsoleWrapBinding({rendererRoot:{querySelectorAll:()=>nodes}});
  binding.refresh();nodes[0].textContent='    after';nodes.push(line('new'));
  binding.refresh();assert.equal(nodes[0].style.getPropertyValue('--cim-continuation-indent'),'6ch');
  assert.equal(nodes[1].style.getPropertyValue('--cim-continuation-indent'),'2ch');
});
test('continuation disposal restores prior presentation and prevents later writes',()=>{
  const nodes=[line('  owned'),line('  borrowed','7ch')];const binding=createConsoleWrapBinding({rendererRoot:{querySelectorAll:()=>nodes}});
  binding.refresh();binding.dispose();binding.dispose();binding.refresh();
  assert.equal(nodes[0].style.getPropertyValue('--cim-continuation-indent'),'');
  assert.equal(nodes[1].style.getPropertyValue('--cim-continuation-indent'),'7ch');
});

test('extreme indentation is capped without altering authored spaces',()=>{
  const node=line(' '.repeat(100)+'text');
  createConsoleWrapBinding({rendererRoot:{querySelectorAll:()=>[node]}}).refresh();
  assert.equal(node.style.getPropertyValue('--cim-continuation-indent'),'12ch');
  assert.equal(node.textContent,' '.repeat(100)+'text');
});
