// Restore. Refuses anything that isn't ours; always states what it will do.

/* ============================================================================
   LEGACY IMPORT — Lovable prototype -> Gains history                    (v45)
   ----------------------------------------------------------------------------
   The old app kept {train_sessions, train_plan} in localStorage. Two traps:

   1) Its exercise `id` is a SLOT, not an identity. When the plan was edited the
      name changed but the id persisted: e16 is "Hamstring Curl" in April and
      "Hack squat" from 6 May; ex-1777372460961 is "Incline Bench Press" then
      "Cable row". Two slots even swapped contents on 30 June. Keying on id
      would silently fuse different movements into one progress line.
      => EVERYTHING HERE KEYS ON NAME.

   2) It stored planned sets alongside performed ones, distinguished only by
      `completed`. Importing the unticked ones would invent training that never
      happened. => ONLY completed===true survives.

   Grouping is by CALENDAR DAY in Israel local time, because the user often
   performed parts of several plan-days as one real session.
   ============================================================================ */

const WS_LEGACY_BW_KG = 76;   // no historical bodyweight exists; stamped flat

// normalised legacy name -> canonical label + catalog exId (+ bodyweight flag)
const WS_LEGACY_MAP = {
  'db shoulder press'                                : {to:'DB Shoulder Press',        exId:'dumbbell-shoulder-press'},
  'shoulder press'                                   : {to:'DB Shoulder Press',        exId:'dumbbell-shoulder-press'},
  'db bicep curls'                                   : {to:'Bicep Curls',              exId:'barbell-curl'},
  'bicep curls'                                      : {to:'Bicep Curls',              exId:'barbell-curl'},
  'lateral raises'                                   : {to:'Lateral Raises',           exId:'side-lateral-raise'},
  'lat raises (flys)'                                : {to:'Lateral Raises',           exId:'side-lateral-raise'},
  'lateral raises (flys)'                            : {to:'Lateral Raises',           exId:'side-lateral-raise'},
  'goblet squats'                                    : {to:'Goblet Squats',            exId:'goblet-squat'},
  'dips'                                             : {to:'Dips',                     exId:'dips', bw:true},
  'weighted dips'                                    : {to:'Dips',                     exId:'dips', bw:true},
  'pull ups - weighted'                              : {to:'Weighted Pull-Up',         exId:'weighted-pull-ups', bw:true},
  'weighted pull ups'                                : {to:'Weighted Pull-Up',         exId:'weighted-pull-ups', bw:true},
  'weighted chins'                                   : {to:'Weighted Pull-Up',         exId:'weighted-pull-ups', bw:true},
  'hanging leg raises'                               : {to:'Hanging Leg Raises',       exId:'hanging-leg-raise', bw:true},
  'hanging leg raises + l-sit'                       : {to:'Hanging Leg Raises',       exId:'hanging-leg-raise', bw:true},
  'leg raises from dip position'                     : {to:'Leg Raises (dip bars)',    exId:'hanging-leg-raise', bw:true},
  'bench press'                                      : {to:'Bench Press',              exId:'bench-press-barbell'},
  'incline bench press'                              : {to:'Incline Bench Press',      exId:'barbell-incline-bench-press'},
  'tricep pushdown'                                  : {to:'Tricep Pushdown',          exId:'triceps-pushdown'},
  'face pulls'                                       : {to:'Face Pulls',               exId:'face-pull'},
  'lat pulldown'                                     : {to:'Lat Pulldown',             exId:'wide-grip-lat-pulldown'},
  'single leg lunge, stability pad, weight transfer' : {to:'Single-Leg Lunge',         exId:'dumbbell-lunges'},
  'back hyperextension - roman chair'                : {to:'Back Hyperextension',      exId:'hyperextensions-back-extensions'},
  'cable row'                                        : {to:'Cable Row',                exId:'seated-cable-rows'},
  'rdl'                                              : {to:'RDL',                      exId:'romanian-deadlift'},
  'hip thrust'                                       : {to:'Hip Thrust',               exId:'barbell-hip-thrust'},
  'hip thrust - glute bridge'                        : {to:'Hip Thrust',               exId:'barbell-hip-thrust'},
  'hack squat'                                       : {to:'Hack Squat',               exId:'hack-squat'},
  'hamstring curl'                                   : {to:'Hamstring Curl',           exId:'lying-leg-curls'},
  'leg press'                                        : {to:'Leg Press',                exId:'leg-press'},
  'calf raises'                                      : {to:'Calf Raises',              exId:'standing-calf-raises'},
  'toe press'                                        : {to:'Toe Press',                exId:'calf-press-on-the-leg-press-machine'},
};

function wsLegacyNorm(s){ return String(s==null?'':s).replace(/\s+/g,' ').trim().toLowerCase(); }

// Calendar day in Israel local time. Intl handles DST; the slice() is a fallback.
function wsLegacyDayKey(iso){
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
  }catch(_){ return String(iso||'').slice(0,10); }
}

// Pure: text -> {ok, msg, records, stats}. Touches no global state.
function wsImportLegacy(text){
  let raw;
  try{ raw=JSON.parse(text); }catch(_){ return {ok:false,msg:'That is not valid JSON.'}; }
  const sessions = Array.isArray(raw) ? raw
                 : (raw && Array.isArray(raw.train_sessions) ? raw.train_sessions : null);
  if(!sessions) return {ok:false,msg:'No train_sessions found in that text.'};
  if(!sessions.length) return {ok:false,msg:'That export has no sessions in it.'};

  const byDay=new Map();
  let kept=0, dropped=0, mergedPairs=0;
  const unmapped=Object.create(null);

  for(const s of sessions){
    if(!s||!s.date) continue;
    const key=wsLegacyDayKey(s.date);
    if(!byDay.has(key)) byDay.set(key,{key,date:s.date,titles:[],byName:new Map()});
    const day=byDay.get(key);
    if(new Date(s.date)<new Date(day.date)) day.date=s.date;   // earliest stamp wins
    if(s.dayTitle && day.titles.indexOf(s.dayTitle)<0) day.titles.push(s.dayTitle);

    for(const ex of (s.exercises||[])){
      const all=(ex&&Array.isArray(ex.sets))?ex.sets:[];
      const done=all.filter(st=>st&&st.completed===true);
      dropped += all.length-done.length;
      if(!done.length) continue;

      const n=wsLegacyNorm(ex.name);
      const m=WS_LEGACY_MAP[n]||null;
      if(!m) unmapped[String(ex.name||'').trim()]=(unmapped[String(ex.name||'').trim()]||0)+1;
      const label=m?m.to:String(ex.name==null?'':ex.name).trim();
      const bw=!!(m&&m.bw);
      const exId=m?(m.exId||null):null;

      if(day.byName.has(label)) mergedPairs++;
      else day.byName.set(label,{exId,name:label,bw,sets:[]});
      const entry=day.byName.get(label);

      for(const st of done){
        const w=(typeof st.weight==='number'&&isFinite(st.weight))?st.weight:0;
        const r=(typeof st.reps==='number'&&isFinite(st.reps))?st.reps:0;
        if(bw) entry.sets.push({reps:r,completed:true,offsetKg:w,bodyweightKg:WS_LEGACY_BW_KG});
        else   entry.sets.push({reps:r,completed:true,weightKg:w});
        kept++;
      }
    }
  }

  const records=[];
  let mixedDays=0;
  Array.from(byDay.keys()).sort().forEach(k=>{
    const d=byDay.get(k);
    const entries=[];
    d.byName.forEach(e=>{
      if(!e.sets.length) return;
      let cat=null;
      try{ if(e.exId&&typeof EXERCISES!=='undefined') cat=EXERCISES.find(c=>c.exId===e.exId)||null; }catch(_){}
      entries.push({
        exId:e.exId,
        iid:e.exId?('legacy_'+e.exId):null,
        name:e.name,
        kind:e.bw?'bodyweight':'weighted',
        muscles:(cat&&Array.isArray(cat.muscles))?cat.muscles.slice():[],
        sets:e.sets,
        _legacy:true,
      });
    });
    if(!entries.length) return;
    const mixed=d.titles.length>1;
    if(mixed) mixedDays++;
    records.push({
      id:'legacy-'+k,
      dayExId:null,
      dayLabel: mixed ? 'Mixed session' : (d.titles[0]||'Session'),
      date:new Date(d.date).toISOString(),
      entries,
      _legacy:true,
      _mixed:mixed,          // Progress must not draw a like-for-like arrow on these
      _sources:d.titles.slice(),
    });
  });

  if(!records.length) return {ok:false,msg:'Nothing to import — no completed sets found.'};
  return {
    ok:true,
    records,
    stats:{
      sourceSessions:sessions.length,
      days:records.length,
      setsKept:kept,
      setsDropped:dropped,
      mixedDays:mixedDays,
      mergedExercises:mergedPairs,
      unmapped:Object.keys(unmapped),
      first:records[0].id.slice(7),
      last:records[records.length-1].id.slice(7),
    },
    msg:'Imported '+records.length+' training days ('+kept+' sets).',
  };
}
