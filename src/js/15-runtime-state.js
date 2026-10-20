// When the on-screen keyboard opens, iOS shrinks the VISUAL viewport but leaves
// the layout viewport alone — so a field low on the screen ends up hidden behind
// the keyboard while you're typing into it. Nudge the focused field into view.
// Passive listener on the document: no per-input wiring, works for fields that
// are rendered later (History set edits, Workshop, restore textarea).
try{
  document.addEventListener('focusin',function(e){
    const t=e&&e.target;
    if(!t||!t.tagName) return;
    const tag=t.tagName.toLowerCase();
    if(tag!=='input'&&tag!=='textarea') return;
    if(t.type==='range'||t.type==='checkbox') return;
    setTimeout(function(){
      try{
        const r=t.getBoundingClientRect();
        const vh=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
        // Only scroll if the field is actually in the covered zone — otherwise
        // every tap would jump the list under the user's thumb.
        if(r.bottom>vh-12||r.top<0) t.scrollIntoView({block:'center',behavior:'smooth'});
      }catch(_){}
    },320);
  },{passive:true});
}catch(_){}
function wsToastMsg(m){
  try{
    let t=document.getElementById('wsToast');
    if(!t){ t=document.createElement('div'); t.id='wsToast'; t.className='ws-toast'; document.body.appendChild(t); }
    t.textContent=m; t.classList.add('on');
    clearTimeout(window.__wsToastT);
    window.__wsToastT=setTimeout(()=>t.classList.remove('on'),2200);
  }catch(_){}
}
// Console helper: wipe + reload the plan history (for testing). e.g. wsForcePlanHistory()
function wsForcePlanHistory(){
  HISTORY=[];
  if(settings) settings._planHistoryInjected=false;
  wsInjectPlanHistory();
  return HISTORY.length;
}

const WS_SEED_HISTORY=false;
setTimeout(()=>{
  try{
    if(WS_SEED_HISTORY && Array.isArray(HISTORY) && HISTORY.length===0){
      HISTORY=wsSeedHistory(8);
      wsPersistSave();
      if(WS_DEBUG_LOG && console&&console.log) console.log('[Gains] Seeded',HISTORY.length,'demo sessions. Call wsClearSeedHistory() to remove.');
    }
  }catch(e){ if(console&&console.warn) console.warn('Seed failed:',e&&e.message); }
},50);
setTimeout(()=>{
  try{
    // Inject the modeled plan history once. Runs on fresh start OR on an existing
    // install that hasn't received it yet (tracked by a marker in settings), so
    // testers see the history without needing to reset. Idempotent.
    const already = settings && settings._planHistoryInjected;
    if(_wsInjectPlanOnFreshStart || !already){
      wsInjectPlanHistory();
      if(settings) settings._planHistoryInjected=true;
      wsPersistSave();
    }
  }catch(_){}
},60);
let curDay=0,curEx=0,curSet=0;
// Workshop foundation: if curDay ever points at a banked day, snap to the first published one.
// This is called after any operation that might bank/unbank/delete a day.
function ensureCurDayPublished(){
  if(DAYS[curDay]&&DAYS[curDay].published!==false) return;
  const firstPub=DAYS.findIndex(d=>d.published!==false);
  if(firstPub>=0) curDay=firstPub;
}
let editW=14,editR=8;
let restIntervals={};
let hiitIntervals={};
let activityIntervals={};
let settings={stepper:true,save:true,session:true,timer:true,interval:true,complete:true,master:true,rim:true,keepEdits:true,progPins:[],shimmer:true,wakeLock:'active',showIntensityScore:true,wsHintsDismissed:{}};
// If the persistence load earlier stashed settings to apply, merge them in
// now that `settings` is declared. Avoids the TDZ that crashes the app on
// fresh loads with saved state.
if(_wsPendingSettings){ Object.assign(settings,_wsPendingSettings); _wsPendingSettings=null; }
