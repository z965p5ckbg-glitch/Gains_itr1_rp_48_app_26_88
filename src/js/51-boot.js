

// DEBUG: initialize the persistent log on first load
if(typeof wsLogStartTime!=='undefined'&&wsLogStartTime===0){
  wsLogStartTime=Date.now();
  wsLogPush('app_loaded',{
    viewport:{w:window.innerWidth,h:window.innerHeight},
    ua:navigator.userAgent.slice(0,100),
  });
  if(typeof dbgUpdateFloat==='function') dbgUpdateFloat();
}

// Startup TTL check: a day logged before the last close may have gone stale
// while the app was away (page loads don't pass through setView('today')).
try{ wsMaybeResetStaleDay(); }catch(_){}
renderTabs();renderHeader();renderAll(true);setTimeout(bindApplyDrag,100);
window.addEventListener('resize',()=>{syncHiitPerimeters();});

// Attempt to lock orientation to portrait — works in PWA contexts (added to home screen)
// On regular Safari/Chrome, the lock isn't permitted, so we fall back to a CSS overlay
// that prompts users to rotate back when the app is held landscape.
async function tryLockPortrait(){
  if(!screen.orientation||!screen.orientation.lock) return;
  try{await screen.orientation.lock('portrait');}catch(e){/* not allowed in this context */}
}
tryLockPortrait();

;(function wsCarryBoot(){
  try{
    if(wsPersistLoad()) return; // matched blob applied — nothing to carry
    const raw=localStorage.getItem(WS_PERSIST_CORRUPT_KEY);
    if(!raw) return;
    const prev=JSON.parse(raw);
    if(!prev||!Array.isArray(prev.days)) return;
    wsCarryEdits(prev);
    if(typeof wsPersistSave==='function') wsPersistSave();
    if(typeof renderAll==='function') renderAll(false);
  }catch(_){}
})();

;(function(){ try{
  const __cap0=captureSessionRecord;
  captureSessionRecord=function(){ const r=__cap0.apply(this,arguments);
    try{ if(typeof currentView!=='undefined'&&currentView==='progress') wsProgRender(); }catch(_){}
    return r; };
}catch(_){}})();
