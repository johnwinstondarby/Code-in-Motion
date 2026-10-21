// Opt-in experimental fixture controls. No WordPress/legacy entry point imports this.
export function mountMultiPaneControls({root,session,experience,slots,instanceId,composed=false}) {
  if(experience.renderer!=='panes/v1'||!instanceId||!/^[a-z0-9-]+$/.test(instanceId))throw new TypeError('Controls require a panes fixture and safe instance identity.');
  const document=root.ownerDocument,cleanups=[];let disposed=false;
  const element=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;};
  const on=(node,type,fn)=>{node.addEventListener(type,fn);cleanups.push(()=>node.removeEventListener(type,fn));};
  const command=event=>{if(!disposed)session.dispatch(event);};
  const button=(label,fn,attrs={})=>{const node=element('button',{type:'button',title:label,...attrs},label);on(node,'click',fn);return node;};
  root.classList.add('mp-fixture');root.setAttribute('data-mp-fixture','');
  const heading=element('header'),title=element('h2',{},experience.presentation.title),badge=element('strong',{'data-mp-placeholder':''},'Placeholder content');heading.append(title,badge);
  const action=element('section',{'data-mp-action':''}),tablist=element('div',{role:'tablist','aria-label':'Action panes'});
  const config=experience.renderer_config.panes,actions=config.filter(p=>['console/v1','motion/v1'].includes(p.type));
  const tabs=[],panels=new Map(),waits=new Map();
  for(const p of actions){
    const tabId=`${instanceId}-tab-${p.id}`,panelId=`${instanceId}-panel-${p.id}`;
    const tab=button(p.type==='console/v1'?'Console – CLI':'Motion – GUI',()=>command({type:'tab',tab:p.id}),{role:'tab',id:tabId,'aria-controls':panelId,'data-mp-tab':p.id});
    const panel=element('section',{role:'tabpanel',id:panelId,'aria-labelledby':tabId,'data-mp-panel':p.id});
    const label=element('h3',{},p.type==='console/v1'?'Console':'Placeholder GUI · simulated'),wait=element('p',{'data-mp-wait':p.id});
    if(!composed)panel.append(label);panel.append(slots[p.id],wait);panels.set(p.id,panel);waits.set(p.id,wait);tabs.push(tab);tablist.append(tab);
  }
  const sharedLabel=element('h3',{'data-action-heading':''},'Console');if(composed)tablist.append(sharedLabel);action.append(tablist,...panels.values());
  const contexts=element('div',{'data-mp-context-row':''});
  for(const p of config.filter(p=>!actions.includes(p))){const panel=element('section',{'data-mp-context':p.id,'aria-label':p.type==='explanation/v1'?'Explanation':'Diagram'});if(!composed||p.type==='explanation/v1')panel.append(element('h3',{},p.type==='explanation/v1'?'Explanation':'Diagram · modeled (test stub)'));panel.append(slots[p.id]);contexts.append(panel);}
  const bar=element('nav',{'data-mp-transport':'','aria-label':'Lesson controls'}),identity=element('span',{'data-mp-identity':'',title:experience.presentation.title},experience.presentation.title),buttons=element('div',{'data-mp-buttons':''}),status=element('output',{'data-mp-status':'','aria-live':'polite'});
  const previous=button('Previous',()=>command({type:'previous'}),{'data-mp-command':'previous'});
  const playback=button('Play',()=>command({type:session.read().playing?'pause':'play'}),{'data-mp-command':'playback'});
  const next=button('Next',()=>command({type:'next'}),{'data-mp-command':'next'});
  const menu=element('div',{role:'dialog','aria-modal':'false','aria-label':'Beats',id:`${instanceId}-beats`,'data-mp-menu':''});
  const beats=button('Beats',()=>{if(session.read().panelOpen){closeMenu();return;}command({type:'panelOpen'});(beatButtons[session.read().index]??start).focus({preventScroll:true});},{'aria-haspopup':'dialog','aria-controls':menu.id,'data-mp-command':'beats'});
  const restart=button('Restart',()=>command({type:'restart'}),{'data-mp-command':'restart'});
  const paths={previous:'M6 4v16M19 4 7 12l12 8Z',play:'m8 4 12 8-12 8Z',pause:'M8 4v16M16 4v16',next:'M18 4v16M5 4l12 8-12 8Z',beats:'M4 6h16M4 12h16M4 18h16',restart:'M20 7v5h-5M20 12a8 8 0 1 1-2-6'};
  function decorate(node,kind){
    const label=element('span',{},node.textContent),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
    for(const [name,value]of Object.entries({viewBox:'0 0 24 24','aria-hidden':'true',focusable:'false','data-mp-icon':'',width:'20',height:'20'}))svg.setAttribute(name,value);
    path.setAttribute('d',paths[kind]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');svg.append(path);node.replaceChildren(svg,label);return{label,path};
  }
  decorate(previous,'previous');const playbackParts=decorate(playback,'play');decorate(next,'next');decorate(beats,'beats');decorate(restart,'restart');
  const menuButtons=element('div');
  const start=button('Start',()=>{command({type:'start'});closeMenu();});
  const beatButtons=experience.steps.map((step,index)=>button(`${index+1} ${step.label}`,()=>{command({type:'jump',index});closeMenu();},{'data-mp-beat':String(index)}));
  const end=button('End',()=>{command({type:'end'});closeMenu();});
  const close=button('Close',closeMenu);
  menuButtons.append(start,...beatButtons,end,close);menu.append(element('p',{},'Playback continues while Beats is open.'),menuButtons);
  buttons.append(previous,playback,next,beats,restart);bar.append(identity,buttons,status);root.append(heading,action,contexts,bar,menu);
  function closeMenu(){command({type:'panelClose'});if(!disposed)beats.focus({preventScroll:true});}
  on(tablist,'keydown',event=>{
    const index=tabs.indexOf(event.target.closest('[role="tab"]'));if(index<0)return;let to;
    if(event.key==='ArrowRight')to=(index+1)%tabs.length;
    if(event.key==='ArrowLeft')to=(index+tabs.length-1)%tabs.length;
    if(event.key==='Home')to=0;if(event.key==='End')to=tabs.length-1;
    if(to!==undefined){event.preventDefault();command({type:'tab',tab:actions[to].id});tabs[to].focus({preventScroll:true});}
  });
  on(menu,'keydown',event=>{
    const nodes=[start,...beatButtons,end,close],index=nodes.indexOf(document.activeElement);let to;
    if(['ArrowDown','ArrowRight'].includes(event.key))to=(index+1)%nodes.length;
    if(['ArrowUp','ArrowLeft'].includes(event.key))to=(index+nodes.length-1)%nodes.length;
    if(event.key==='Home')to=0;if(event.key==='End')to=nodes.length-1;
    if(to!==undefined){event.preventDefault();nodes[to].focus({preventScroll:true});}
  });
  on(root,'keydown',event=>{if(event.key==='Escape'&&session.read().panelOpen){event.preventDefault();closeMenu();}});
  function update(state){
    if(disposed)return;
    if(composed)sharedLabel.textContent=state.tab==='motion'?(experience.renderer_config.placeholder.enabled?'Placeholder GUI · simulated':'Recorded in the lab'):'Console – CLI';
    for(let i=0;i<tabs.length;i++){
      const id=actions[i].id,selected=state.tab===id;
      tabs[i].setAttribute('aria-selected',String(selected));tabs[i].tabIndex=selected?0:-1;panels.get(id).hidden=!selected;
      const waiting=state.waiting[id],initial=experience.initial_state.panes[id];
      const note=!waiting?'':actions[i].type==='motion/v1'&&JSON.stringify(state.panes[id])===JSON.stringify(initial)?'No GUI recording has played yet':`Waiting on next ${actions[i].type==='motion/v1'?'GUI':'Console'} action`;
      if(waits.get(id).textContent!==note)waits.get(id).textContent=note;
    }
    if(status.textContent!==state.status)status.textContent=state.status;
    const label=state.playing?'Pause':'Play';if(playbackParts.label.textContent!==label)playbackParts.label.textContent=label;
    playback.setAttribute('title',label);
    playbackParts.path.setAttribute('d',paths[state.playing?'pause':'play']);
    menu.hidden=!state.panelOpen;beats.setAttribute('aria-expanded',String(state.panelOpen));
    beatButtons.forEach((node,index)=>{if(index===state.index)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  }
  const unsubscribe=session.subscribe(update);update(session.read());
  function dispose(){if(disposed)return;disposed=true;unsubscribe();for(const cleanup of cleanups.reverse())cleanup();root.replaceChildren();root.classList.remove('mp-fixture');root.removeAttribute('data-mp-fixture');}
  return Object.freeze({dispose});
}
