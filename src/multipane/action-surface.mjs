export function attachMotionFixtureSurface(root,session){
 root.setAttribute('data-motion-fixture','');
 const update=state=>{for(const panel of root.querySelectorAll('[role="tabpanel"]')){const inactive=panel.getAttribute('data-mp-panel')!==state.tab;panel.setAttribute('aria-hidden',String(inactive));panel.inert=inactive;}};
 update(session.read());const off=session.subscribe(update);
 return Object.freeze({dispose(){off();root.removeAttribute('data-motion-fixture');}});
}
