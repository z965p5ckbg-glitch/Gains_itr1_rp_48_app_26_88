
// ─── Seed history generator (development / demo) ─────────────────────
//
// Generates ~8 weeks of realistic, progressively-overloading session history
// so the data features (History / Progress / PRs) have something to render
// against without hand-logging dozens of sessions. Produces SessionRecords in
// the exact schema captureSessionRecord() uses, so views can't tell seeded
// from real data. Strength shows gradual overload; cardio shows improving
// pace; HIIT shows rising rounds/work-time. Includes occasional missed days
// (adherence gaps) and partial sessions for realism.
//
// Call wsSeedHistory() from the console, or it auto-runs once if HISTORY is
// empty AND the dev seed flag is on (see wsMaybeSeedHistory at startup).
function wsSeedHistory(weeks){
  weeks = weeks || 8;
  const out=[];
  const now=Date.now();
  const DAY_MS=86400000;
  // A simple weekly template: which day-index trains on which weekday.
  // We rotate through the published days across the week, skipping some for
  // realistic adherence gaps. Index 2 is the Mixed Day (strength + cardio +
  // HIIT) — included so History shows every modality, not just strength.
  const schedule=[0,1,2,3,4]; // ~5 sessions/week, includes the mixed day
  // progression factor grows each week (load/pace/rounds creep up)
  for(let w=weeks-1; w>=0; w--){
    const prog = (weeks-1-w); // 0 at oldest week, grows toward present
    schedule.forEach((dayIdx,si)=>{
      // ~12% chance to skip a scheduled session (adherence gap)
      if(Math.random()<0.12) return;
      const d=DAYS[dayIdx];
      if(!d) return;
      // date: w weeks ago, offset by session index within the week
      const daysAgo = w*7 + (6 - si*1.5);
      const date=new Date(now - daysAgo*DAY_MS);
      date.setHours(7+Math.floor(Math.random()*12), Math.floor(Math.random()*60), 0, 0);
      const entries=[];
      for(const ex of (d.items||[])){
        const kind=ex._itemKind||wsTagItemKind(ex);
        const cat=ex.exId?EXERCISES.find(c=>c.exId===ex.exId):null;
        const base={
          exId:ex.exId||null, iid:(ex._iid||'seed')+'_'+w+'_'+dayIdx,
          name:ex.name||'', muscles:(cat&&Array.isArray(cat.muscles))?cat.muscles.slice():[],
        };
        if(kind==='weighted'){
          base.kind='weighted';
          base.sets=[];
          const planned=(ex.sets||[]);
          // base weight from the template's first set, creeping up ~1.5kg/week
          const baseW=(planned[0]&&planned[0].w)||20;
          const w0=Math.max(0, baseW + prog*1.5 + (Math.random()<0.5?0:0.5));
          const reps0=(planned[0]&&planned[0].r)||8;
          // occasionally a partial session (didn't finish all sets)
          const doSets = (Math.random()<0.1) ? Math.max(1,planned.length-1) : planned.length;
          for(let s=0;s<doSets;s++){
            // small rep variation per set, weight steady within session
            const reps=Math.max(1, reps0 - (s>1?Math.floor(Math.random()*2):0));
            base.sets.push({ reps, completed:true, weightKg:Math.round(w0*2)/2 });
          }
        } else if(kind==='cardio_time' || kind==='cardio_distance'){
          base.kind='cardio';
          const plannedDur=ex.duration||600;
          base.cardio={ cardioKind: kind==='cardio_distance'?'distance':'time',
            durationSec: plannedDur + Math.floor((Math.random()*120)-40) };
          if(kind==='cardio_distance' || (typeof ex.distance==='number'&&ex.distance>0)){
            // distance improving slightly over time (pace gets better)
            const baseDist=(ex.distance||5);
            base.cardio.distanceM=Math.round((baseDist + prog*0.05)*1000);
          }
          base.cardio.intensityTag=ex.intensity||'Mod';
        } else if(kind==='cardio_intervals'){
          base.kind='hiit';
          const exs=Array.isArray(ex.roundsCustom)&&ex.roundsCustom.length
            ? ex.roundsCustom.map(r=>({name:r.name||'',workSec:r.work||20,restSec:r.rest||10}))
            : [{name:ex.name||'',workSec:ex.workSec||20,restSec:ex.restSec||10}];
          const exCount=exs.length;
          const cycles=ex.totalRounds||4;
          const roundsPlanned=exCount*cycles;
          // rounds done improves over weeks (early weeks cut short more often)
          const completion = Math.min(1, 0.7 + prog*0.04 + Math.random()*0.1);
          const roundsDone=Math.max(1, Math.round(roundsPlanned*completion));
          let workSecTotal=0, restSecTotal=0;
          for(let i=0;i<roundsDone;i++){ const e=exs[i%exCount]; workSecTotal+=e.workSec; restSecTotal+=e.restSec; }
          base.hiit={ exercises:exs, cycles, roundsPlanned, roundsDone, workSecTotal, restSecTotal };
          // ~40% of HIIT sessions have an RPE logged (optional metric demo)
          if(Math.random()<0.4) base.hiit.peakRpe = 6 + Math.floor(Math.random()*4);
        }
        entries.push(base);
      }
      out.push({
        id:wsNewSessionId(),
        dayExId: d.dayExId || d.label || null,
        dayLabel: wsLibDayDisplayName?wsLibDayDisplayName(d):(d.label||''),
        date: date.toISOString(),
        entries,
        seeded:true, // flag so we can identify/clear demo data later
      });
    });
  }
  // sort oldest → newest
  out.sort((a,b)=> new Date(a.date)-new Date(b.date));
  return out;
}

// Replace HISTORY with fresh seed data and persist. For console/dev use.
function wsInjectSeedHistory(weeks){
  HISTORY = wsSeedHistory(weeks);
  wsPersistSave();
  if(typeof wsToast==='function') wsToast(`Seeded ${HISTORY.length} sessions`);
  return HISTORY.length;
}

// Remove only seeded records, keeping any real logged sessions.
function wsClearSeedHistory(){
  HISTORY = HISTORY.filter(r=>!r.seeded);
  wsPersistSave();
  if(typeof wsToast==='function') wsToast('Seed data cleared');
  return HISTORY.length;
}

function resetDay(){
  const d=DAYS[curDay];d.logged=false;delete d._loggedAt;
  for(const ex of (d.items||[])){
    // effort capture resets with the day
    delete ex.rpe; delete ex.peakRpe;
    delete ex._rpePulsed; delete ex._rpeOpen; delete ex._rpeInfo;
    delete ex._rmOpen; delete ex._rmPending; delete ex._rmSanity; // 1RM panel state only — wsMaxes persists
    const k=ex._itemKind||wsTagItemKind(ex);
    if(k==='weighted'){
      ex.sets=(ex.sets||[]).filter(s=>!s._session);
      ex.sets.forEach(s=>{delete s._logged;});
      ex.rl=ex.rest;ex.rs='idle';ex.deletedSets=[];
    } else {
      ex.logged=false;
      if(k==='cardio_time'){
        ex.actualDuration=null;ex.distance=null;
        ex.rl=ex.timerMode==='open'?0:(ex.duration||0);
        ex.rs='idle';
      } else if(k==='cardio_distance'){
        ex.actualDuration=null;
        ex.rl=ex.timerMode==='open'?0:(ex.duration||0);
        ex.rs='idle';
      } else if(k==='cardio_intervals'){
        clearHiitSnapshot(ex);
        ex.rounds=0;ex.phase='idle';ex.phaseIdx=0;
        const segs=getHiitSegments(ex);
        ex.phaseLeft=segs[0]?segs[0].duration:(ex.workSec||40);
      }
    }
  }
  renderAll(false);
}

function switchDay(i){wsLogPush('tap_day_tab',{i});
  Object.keys(restIntervals).forEach(k=>clearInterval(restIntervals[k]));
  Object.keys(hiitIntervals).forEach(k=>clearInterval(hiitIntervals[k]));
  Object.keys(activityIntervals).forEach(k=>clearInterval(activityIntervals[k]));
  restIntervals={};hiitIntervals={};activityIntervals={};
  curDay=i;
renderTabs();renderHeader();renderAll(true);
}

// Reset a COMPLETED day only after a time window, so glancing away and back
// doesn't wipe the summary. In-progress (unlogged) days are NEVER auto-reset
// here — accidental navigation must never cost a user their in-flight session.
// The session is already saved to HISTORY at log time, so resetting a stale
// completed day discards only leftover live UI state, never data.
const WS_COMPLETED_DAY_TTL_MS = 3*60*60*1000; // 3 hours
function wsResetCompletedDayOnLeave(){
  // Retained for compatibility; the TTL logic now lives in maybeResetStaleDay,
  // called when returning to Today. Leaving this a no-op keeps the route hook
  // simple and centralizes the decision in one place.
}
// Called when Today becomes visible (view switch, app resume, startup). If
// the current day was logged more than the TTL ago, refresh it to a clean
// day; otherwise leave it (summary stays). Returns true if a reset happened
// so callers can re-render.
function wsMaybeResetStaleDay(){
  try{
    const d=DAYS[curDay];
    if(d && d.logged && typeof d._loggedAt==='number'){
      if(Date.now()-d._loggedAt > WS_COMPLETED_DAY_TTL_MS){ resetDay(); return true; }
    }
  }catch(_){}
  return false;
}

function openSettings(){
  wsLogPush('open_settings');
  // Sync persisted preference values into the toggle UI
  const tog=document.getElementById('togAdvTags');
  if(tog) tog.classList.toggle('on',!!wsAdvancedTags);
  const togIS=document.getElementById('togIntensityScore');
  if(togIS) togIS.classList.toggle('on',!!settings.showIntensityScore);
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings(){wsLogPush('close_settings');document.getElementById('settingsOverlay').classList.remove('open');}
function toggleSetting(key,el){settings[key]=!settings[key];if(el) el.classList.toggle('on',settings[key]);}

// Toggle the Intensity Score (RPE) layer. Default off — the minimalist never
// sees RPE UI. When on, History surfaces per-exercise Effort Scores and a
// per-exercise Effort display in History. (Session-level scores retired.)
// Re-renders History live if it's the current view so the change shows at once.
function toggleIntensityScore(el){
  settings.showIntensityScore=!settings.showIntensityScore;
  if(el) el.classList.toggle('on',!!settings.showIntensityScore);
  wsLogPush('toggle_intensity_score',{on:!!settings.showIntensityScore});
  if(currentView==='history'){ try{ hiRender(); }catch(_){} }
  wsPersistSave();
}

// Toggle the Advanced Exercise Tags preference. When ON, the library editor
// shows the muscle/pattern tag block, and the library's Group-by chips
// expose Muscle / Pattern as additional grouping options. Default off so
// new users see a clean, uncluttered library.
function toggleAdvancedTags(el){
  wsAdvancedTags=!wsAdvancedTags;
  if(el) el.classList.toggle('on',wsAdvancedTags);
  // If the user just turned it OFF while in a muscle/pattern group-by view,
  // fall back to title grouping so we don't render orphaned chip state.
  if(!wsAdvancedTags && (wsLibGroupBy==='muscle'||wsLibGroupBy==='pattern')){
    wsLibGroupBy='title';
  }
  // Re-render the library (and editor if open) so the change shows up live.
  try{ wsRender(); }catch(_){}
  if(wsLibEditCtx){
    try{ wsRenderLibEditor(); }catch(_){}
  }
  wsLogPush('toggle_adv_tags',{on:wsAdvancedTags});
  wsPersistSave();
}
function toggleSettingsSection(name){
  const body=document.getElementById(name+'SectionBody');
  const chev=document.getElementById(name+'Chevron');
  if(!body) return;
  const open=body.classList.toggle('open');
  if(chev){
    chev.classList.toggle('open',open);
    chev.textContent=open?'−':'+';
  }
}
// Backward compat for any legacy references
function toggleAudioSection(){toggleSettingsSection('audio');}

function toggleMasterSound(){
  settings.master=!settings.master;
  document.getElementById('togMaster').classList.toggle('on',settings.master);
  const d=DAYS[curDay];if(!d.logged) renderAll(false);
}
