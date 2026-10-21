
// Wake Lock state — keeps the screen on during workouts
// settings.wakeLock: 'always' = always on while app foregrounded, 'active' = only during running timers, 'off' = no
let _wakeLockSentinel=null;
async function acquireWakeLock(){
  if(!('wakeLock' in navigator)) return; // unsupported (e.g. older browsers, artifact preview)
  if(_wakeLockSentinel) return; // already held
  try{
    _wakeLockSentinel=await navigator.wakeLock.request('screen');
    _wakeLockSentinel.addEventListener('release',()=>{_wakeLockSentinel=null;});
  }catch(e){/* user denied or page hidden */}
}
async function releaseWakeLock(){
  if(!_wakeLockSentinel) return;
  try{await _wakeLockSentinel.release();}catch(e){}
  _wakeLockSentinel=null;
}
// Acquire when a timer is starting if mode is 'active' or 'always'
function acquireWakeLockIfActive(){
  if(settings.wakeLock==='off') return;
  acquireWakeLock();
}
// Release when timers stop, but only if mode is 'active' (always-mode keeps it)
function maybeReleaseWakeLock(){
  if(settings.wakeLock!=='active') return;
  // Only release if no other timers are active across the app
  if(anyTimerActive()) return;
  releaseWakeLock();
}
// Check if any timer (rest, hiit, activity) is currently running
function anyTimerActive(){
  const d=DAYS[curDay];if(!d) return false;
  for(const ex of (d.items||[])){
    const k=ex._itemKind||wsTagItemKind(ex);
    if(k==='weighted'){
      if(ex.rs==='running') return true;
    } else if(k==='cardio_intervals'){
      if(ex.phase==='work'||ex.phase==='rest'||ex.phase==='setup') return true;
    } else if(k==='cardio_time'||k==='cardio_distance'){
      if(ex.rs==='running') return true;
    }
  }
  return false;
}
// On visibility change, re-acquire wake lock if needed (browser auto-releases when tab hidden)
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&settings.wakeLock!=='off'){
    if(settings.wakeLock==='always'||anyTimerActive()) acquireWakeLock();
  }
});
// On app resume, check the completed-day TTL. iOS re-opens fire
// visibilitychange (not a reload), so without this a day logged yesterday
// would still show its summary the next morning until the user switched
// views. Only re-render if something actually reset.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  try{
    if(currentView==='today' && wsMaybeResetStaleDay()){
      renderTabs();renderHeader();renderAll(false);
    }
  }catch(_){}
});
function setWakeLockMode(mode){
  settings.wakeLock=mode;
  if(mode==='off'){
    releaseWakeLock();
  } else if(mode==='always'){
    acquireWakeLock();
  } else if(mode==='active'){
    if(anyTimerActive()) acquireWakeLock(); else releaseWakeLock();
  }
}
function setWakeLockModeUI(mode){
  setWakeLockMode(mode);
  document.querySelectorAll('#wakeLockSeg .seg-opt').forEach(el=>{
    el.classList.toggle('active',el.dataset.mode===mode);
  });
}
let slideAbort=null,applyAbort=null;
let cardioEditCtx=null,iconPickerCtx=null;

let actx=null;
function ac(){if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();return actx;}
// Global category sound (master + setting toggle)
function snd(key){return settings.master&&settings[key];}
// Per-exercise sound check — both global category AND per-exercise must be on
function exSnd(ex,key){return snd(key)&&ex.sound!==false;}
