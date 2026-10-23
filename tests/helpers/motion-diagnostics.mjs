import {writeFile} from 'node:fs/promises';

// Investigation-only instrumentation, injected by Playwright into its served module.
// The production module and release packages remain untouched.
export function instrumentMotionSource(source) {
  const replace = (from, to) => {
    if (source.split(from).length !== 2) throw new Error(`Motion diagnostic anchor changed: ${from}`);
    source = source.replace(from, to);
  };
  replace("function cancelPlay(reason=", "const debug=(event,data={})=>globalThis.__motionDebug?.(event,{...data,video:video?{time:video.currentTime,duration:video.duration,ended:video.ended,seeking:video.seeking,readyState:video.readyState,paused:video.paused}:null});\n function cancelPlay(reason=");
  replace('async function finalStill(){', "async function finalStill(){debug('final-start');");
  replace('await settleFinalVideoFrame(target,{signal:io?.signal,timeoutMs});', "await settleFinalVideoFrame(target,{signal:io?.signal,timeoutMs});debug('final-resolved');");
  replace('const task={finish(result){if(done)return;', "const task={finish(result){debug('finish',{result:{status:result.status,error:String(result.error)}});if(done)return;");
  replace('const pinPause=()=>{', "const pinPause=()=>{debug('pinPause',{clock:context.clock.now(),start,finalising});");
  replace('const fail=()=>{if(done)return;', "const fail=()=>{debug('fail');if(done)return;");
  return source;
}

export async function installMotionDiagnostics(page) {
  await page.route('**/src/multipane/motion.mjs', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: instrumentMotionSource(await response.text())});
  });
  await page.addInitScript(() => {
    const events = []; let dropped = 0;
    window.__motionDebug = (event, data) => {
      if (events.length === 512) { events.shift(); dropped++; }
      events.push({event, data, stamp: performance.now()});
    };
    const state = v => ({time:v.currentTime,duration:v.duration,ended:v.ended,seeking:v.seeking,readyState:v.readyState,paused:v.paused});
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {...descriptor, set(time) {
      window.__motionDebug('seek-write', {requested:time, before:state(this)});
      descriptor.set.call(this, time);
    }});
    for (const event of ['seeking','seeked','timeupdate','ended','pause','play','playing','waiting','canplay']) {
      document.addEventListener(event, e => {
        if (e.target instanceof HTMLMediaElement) window.__motionDebug('native-'+event, state(e.target));
      }, true);
    }
    window.__motionDiagnosticSnapshot = () => ({events:[...events],dropped});
  });
}

export async function recordMotionCheck(page, video, info) {
  const record = await video.evaluate(v => ({
    check:{time:v.currentTime,duration:v.duration,ended:v.ended,seeking:v.seeking,readyState:v.readyState,paused:v.paused,ok:v.ended||v.currentTime>=v.duration-0.15},
    session:fixture.session.read(),clock:fixture.clockEvents, ...window.__motionDiagnosticSnapshot()
  }));
  const text = JSON.stringify(record, null, 2), path = info.outputPath('motion-diagnostics.json');
  await writeFile(path, text);
  await info.attach('motion-diagnostics', {path,contentType:'application/json'});
  // Keep the failure data in the job log even if artifact upload cannot run.
  if (!record.check.ok) console.log('MOT-07_DIAGNOSTICS '+JSON.stringify(record));
  return record.check.ok;
}
