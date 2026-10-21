
// Reset all persisted state and restart from defaults. Used by the
// Settings → Reset action and the slide-to-confirm in the danger zone.

// ═══ Keep-my-edits: user training edits survive version-bump regens ═══
function wsCarryEdits(prev){
  try{
    if(!prev||typeof prev!=='object') return;
    const pset=prev.settings||{};
    if(pset.keepEdits===false) return;
    try{ if(Array.isArray(pset.progPins)&&typeof settings==='object') settings.progPins=pset.progPins.slice(0,40); }catch(_){}
    // Profile and body log are user data by definition — always carried.
    try{ if(pset.profile&&typeof settings==='object') settings.profile=pset.profile; }catch(_){}
    try{ if(Array.isArray(pset.bodyLog)&&typeof settings==='object') settings.bodyLog=pset.bodyLog.slice(-2000); }catch(_){}
    try{ if(pset.coachAsk&&typeof settings==='object') settings.coachAsk=pset.coachAsk; }catch(_){}
    if(Array.isArray(prev.exercises)&&Array.isArray(EXERCISES)){
      const have=new Set(EXERCISES.map(e=>e&&e.exId));
      prev.exercises.forEach(e=>{ if(e&&e.exId&&!have.has(e.exId)){ EXERCISES.push(e); have.add(e.exId); } });
    }
    if(Array.isArray(prev.days)&&Array.isArray(DAYS)){
      const COMMON=['name'];
      const BYKIND={
        weighted:['sets'],
        intervals:['roundsCustom','totalRounds','roundRest','setupSec','amrap','capMin','simpleMode','workSec','restSec','sound','voice','startMode'],
        time:['durationMin','intensity','sound'],
        distance:['distanceKm','durationMin','intensity','sound'],
      };
      DAYS.forEach((nd,di)=>{
        const od=prev.days[di]; if(!od||!nd) return;
        if(od.label) nd.label=od.label;
        if(od.titleHtml) nd.titleHtml=od.titleHtml;
        const map={}; (od.items||[]).forEach(it=>{ if(it&&it.iid) map[it.iid]=it; });
        (nd.items||[]).forEach(nit=>{
          const oit=nit&&nit.iid?map[nit.iid]:null; if(!oit) return;
          (BYKIND[oit.kind]||[]).concat(COMMON).forEach(k=>{
            if(oit[k]!==undefined){ try{ nit[k]=JSON.parse(JSON.stringify(oit[k])); }catch(_){} }
          });
          if(oit.kind==='weighted'&&Array.isArray(nit.sets)) nit.sets.forEach(st=>{ if(st) st.completed=false; });
        });
      });
    }
  }catch(_){}
}

function wsPersistResetAll(){
  // Suppress the page-lifecycle exit-flush: location.reload() fires pagehide /
  // visibilitychange, whose handlers call wsPersistFlush() and would otherwise
  // immediately re-write the in-memory state we're trying to clear (the reset
  // would silently undo itself). This flag makes flush a no-op during teardown.
  _wsResetting=true;
  try{
    localStorage.removeItem(WS_PERSIST_KEY);
    localStorage.removeItem(WS_PERSIST_BACKUP_KEY);
  }catch(_){}
  // Reload — simplest path. State will fall back to makeDays() + starter catalog.
  location.reload();
}

// Bind page-lifecycle hooks for save-on-close. Pagehide and visibilitychange
// catch the common iOS Safari paths where unload doesn't fire reliably.
function wsBindPersistLifecycle(){
  function flushOnExit(){ wsPersistFlush(); }
  window.addEventListener('beforeunload',flushOnExit);
  window.addEventListener('pagehide',flushOnExit);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden') wsPersistFlush();
  });
}
wsBindPersistLifecycle();
