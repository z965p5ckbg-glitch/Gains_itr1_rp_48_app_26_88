
// ─── Session record capture (data layer) ────────────────────────────
//
// Builds an immutable SessionRecord snapshot from the day's current state and
// appends it to HISTORY. Called once when a session is logged. Follows the
// schema: per-set detail for strength/bodyweight, summary blocks for cardio
// and HIIT, all three modalities first-class. Stores RAW facts only — volume,
// 1RM, pace, etc. are derived later at read time, never stored.
function wsNewSessionId(){
  return 's_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-5);
}

function captureSessionRecord(dayIdx){
  const d=DAYS[dayIdx];
  if(!d) return null;
  const entries=[];
  for(const ex of (d.items||[])){
    const kind=ex._itemKind||wsTagItemKind(ex);
    // Frozen identity + descriptive fields so history is self-contained even
    // if the library entry is later edited or deleted.
    const cat=ex.exId?EXERCISES.find(c=>c.exId===ex.exId):null;
    const entry={
      exId:ex.exId||null,
      iid:ex._iid||null,
      name:ex.name||'',
      kind: kind==='weighted'?'weighted'
           :kind==='cardio_intervals'?'hiit'
           :ex._bodyweight?'bodyweight':'cardio',
      muscles:(cat&&Array.isArray(cat.muscles))?cat.muscles.slice():[],
    };
    if(kind==='weighted'){
      // Per-set detail — only the sets the user actually completed.
      entry.kind = ex._bodyweight ? 'bodyweight' : 'weighted';
      entry.sets=[];
      (ex.sets||[]).forEach(s=>{
        if(!s._logged) return; // record what actually happened
        const rec={ reps:s.r||0, completed:true };
        if(ex._bodyweight){
          rec.offsetKg = (typeof s.offsetKg==='number') ? s.offsetKg : (s.w||0);
          rec.bodyweightKg = wsCurrentBodyweight();
        } else {
          rec.weightKg = s.w||0;
        }
        // actual rest is captured only if a timer ran (absent otherwise)
        if(typeof s._restActual==='number') rec.restSec=s._restActual;
        entry.sets.push(rec);
      });
    } else if(kind==='cardio_time' || kind==='cardio_distance'){
      entry.kind='cardio';
      entry.cardio={
        cardioKind: kind==='cardio_distance'?'distance':'time',
        durationSec: (typeof ex.actualDuration==='number' && ex.actualDuration>0)
                      ? ex.actualDuration
                      : (ex.timerMode==='open' ? (ex.rl||0) : Math.max(0,(ex.duration||0)-(ex.rl||0))),
      };
      if(typeof ex.distance==='number' && ex.distance>0) entry.cardio.distanceM=Math.round(ex.distance*1000);
      if(ex.intensity) entry.cardio.intensityTag=ex.intensity;
    } else if(kind==='cardio_intervals'){
      entry.kind='hiit';
      const segs=(typeof getHiitSegments==='function')?getHiitSegments(ex):[];
      const exercises=Array.isArray(ex.roundsCustom)&&ex.roundsCustom.length
        ? ex.roundsCustom.map(r=>Object.assign({name:r.name||'',workSec:r.work||0,restSec:r.rest||0},r.exId?{exId:r.exId}:{}))
        : [{name:ex.name||'',workSec:ex.workSec||0,restSec:ex.restSec||0}];
      const cycles=ex.totalRounds||ex.cycles||1;
      const exCount=exercises.length;
      const roundsPlanned=exCount*cycles;
      const roundsDone=(typeof ex._workDone==='number')?ex._workDone:(ex.rounds||0);
      // total work time = sum of work seconds across completed rounds
      let workSecTotal=0, restSecTotal=0;
      for(let i=0;i<roundsDone;i++){
        const exDef=exercises[i % exCount];
        workSecTotal += exDef.workSec||0;
        restSecTotal += exDef.restSec||0;
      }
      // exact engine-accounted totals override the estimate when the run recorded them
      if(typeof ex._workSecDone==='number'){ workSecTotal=ex._workSecDone; restSecTotal=ex._restSecDone||0; }
      entry.hiit={
        exercises, cycles, roundsPlanned, roundsDone,
        workSecTotal, restSecTotal,
        fullRounds:(typeof ex._roundsDone==='number')?ex._roundsDone:undefined,
        roundRest:ex.roundRest||0, amrap:!!ex.amrap, capMin:ex.capMin||0,
      };
      if(ex.setupSec) entry.hiit.setupSec=ex.setupSec;
      // live-captured peak effort (the in-workout pill) rides into the record
      if(typeof ex.peakRpe==='number') entry.hiit.peakRpe=ex.peakRpe;
      // pending RPE marker is attached separately by the prompt flow
    }
    // live-captured effort rating for strength/cardio entries
    if(kind!=='cardio_intervals' && typeof ex.rpe==='number') entry.rpe=ex.rpe;
    // v55: only what was performed enters the record. Until v54 every item on
    // the day was saved, so an untouched exercise appeared in History with zero
    // sets and a skipped HIIT finisher counted as conditioning work.
    if(wsItemPerformed(ex, entry)) entries.push(entry);
  }
  if(!entries.length) return null;   // nothing performed -> no session
  const rec={
    id:wsNewSessionId(),
    dayExId: d.dayExId || d.label || null,
    dayLabel: wsLibDayDisplayName?wsLibDayDisplayName(d):(d.label||''),
    date: new Date().toISOString(),
    entries,
  };
  return rec;
}

// v55: ONE definition of "performed", shared by the three things that must
// agree — the LOG SESSION slider (enabled only if logging would save
// something), the record capture, and the boot clean-up of what old builds
// saved. An entry counts only if it carries a measured fact: a ticked set, a
// completed work round or work time, a duration, or a distance.
//
// Deliberately NOT the item's "logged" flag: a cardio item is flagged logged
// when you merely pick an intensity or set a goal, so that flag would save
// work that never happened.
function wsEntryHasWork(e){
  if(!e) return false;
  if(e.kind==='weighted'||e.kind==='bodyweight') return Array.isArray(e.sets)&&e.sets.length>0;
  if(e.kind==='hiit'){ const h=e.hiit||{}; return (h.roundsDone||0)>0||(h.workSecTotal||0)>0; }
  if(e.kind==='cardio'){ const c=e.cardio||{}; return (c.durationSec||0)>0||(c.distanceM||0)>0; }
  return true;                           // unknown kinds: never guess
}

// The capture's test: a measured fact (above) that is not just the plan. A
// distance-based item carries its PLANNED distance from the template, so a
// distance alone proves nothing — the item must have been finished or its
// distance entered (ex.logged), or its timer must have run for at least
// WS_CARDIO_MIN_SEC (the long-standing threshold that also wakes the slider
// mid-run, so a timer started by accident is not logged as exercise).
const WS_CARDIO_MIN_SEC = 30;
function wsItemPerformed(ex, entry){
  if(!wsEntryHasWork(entry)) return false;
  if(entry.kind==='cardio') return !!ex.logged || ((entry.cardio&&entry.cardio.durationSec)||0)>=WS_CARDIO_MIN_SEC;
  return true;
}

// Would logging this day save a session? The slider asks exactly this.
function wsDayHasWork(dayIdx){
  try{ return !!captureSessionRecord(dayIdx); }catch(_){ return false; }
}

// Remove entries that record no work whatsoever (see wsEntryHasWork). A cardio
// entry with a non-zero duration is KEPT even though old builds sometimes
// saved a planned duration for untouched cardio — the data cannot tell those
// apart, so the user decides, not a heuristic. Sessions left with nothing are
// kept too (deleting a whole session is the user's call). Returns how many
// entries were removed.
function wsPruneEmptyEntries(history){
  let removed=0;
  for(const rec of (Array.isArray(history)?history:[])){
    if(!rec||!Array.isArray(rec.entries)) continue;
    const keep=rec.entries.filter(wsEntryHasWork);
    if(keep.length && keep.length<rec.entries.length){ removed+=rec.entries.length-keep.length; rec.entries=keep; }
  }
  return removed;
}

// Current bodyweight from profile (latest reading), or null if unset.
function wsCurrentBodyweight(){
  try{
    if(settings && settings.profile && Array.isArray(settings.profile.bodyweight) && settings.profile.bodyweight.length){
      const series=settings.profile.bodyweight;
      return series[series.length-1].value;
    }
  }catch(_){}
  return null;
}

function reviewSession(){
  // Quiet acknowledgment that the session was logged. (Single-user app; the
  // real session summary will live in History once the data layer is built.)
  wsToast('Session logged');
}
