
// ─── Items-model migration (iteration 1 of mixed-day support) ────────
//
// Each day historically had two separate arrays: d.exercises[] (strength)
// and d.cardio[] (cardio). To support mixed days with arbitrary ordering,
// we introduce d.items[] as the canonical ordered list. Each item is the
// same instance object as before (same fields, same identity), just
// referenced from items[].
//
// For iteration 1, items[] is *additive*: we build it from the legacy
// arrays (preserving their order), keep the legacy arrays as derived
// views, and ship no visible behavior change. Later iterations will move
// the renderer + mutators to read from items[] directly.
//
// IMPORTANT: items[] holds the SAME OBJECT REFERENCES as exercises[]/
// cardio[]. Mutating an instance through either reaches the same data.

// Tag an instance with a synthetic kind for the items list, so we can
// tell what type of card to render later without inspecting other fields.
function wsTagItemKind(inst,defaultKind){
  // Already tagged? Trust it.
  if(inst._itemKind) return inst._itemKind;
  // Strength instances had no .kind field historically.
  if(defaultKind==='weighted'){ inst._itemKind='weighted'; return 'weighted'; }
  // Cardio instances carry a .kind: 'time' | 'distance' | 'intervals'.
  if(inst.kind==='time')      { inst._itemKind='cardio_time';      return 'cardio_time'; }
  if(inst.kind==='distance')  { inst._itemKind='cardio_distance';  return 'cardio_distance'; }
  if(inst.kind==='intervals') { inst._itemKind='cardio_intervals'; return 'cardio_intervals'; }
  // Defensive fallback: assume strength if we can't classify.
  inst._itemKind='weighted';
  return 'weighted';
}

// Build/refresh d.items[] for a single day from its legacy arrays. Idempotent;
// safe to call repeatedly. Order: existing items[] (if any) wins, with any
// instance from legacy arrays not yet in items[] appended at the end.
function wsDayItemsBuild(day){
  if(!day) return;
  // If items[] already exists, it is the single source of truth. We don't
  // re-derive from the legacy arrays (that caused duplication across reloads,
  // since JSON breaks object-reference identity). We just kind-tag, ensure
  // every instance has a stable iid, and rebuild the derived legacy arrays.
  if(Array.isArray(day.items) && day.items.length>0){
    day.items.forEach(i=>{ wsTagItemKind(i); wsEnsureIid(i); });
    wsDayItemsSync(day);
    return;
  }
  // First-time migration only (no items[] yet): build from legacy arrays,
  // strength block then cardio block, preserving each one's order.
  const ex=Array.isArray(day.exercises)?day.exercises:[];
  const cd=Array.isArray(day.cardio)?day.cardio:[];
  ex.forEach(i=>{ wsTagItemKind(i,'weighted'); wsEnsureIid(i); });
  cd.forEach(i=>{ wsTagItemKind(i); wsEnsureIid(i); });
  day.items=[].concat(ex,cd);
}

// Sync the derived legacy arrays from the canonical items[]. Inverse of
// wsDayItemsBuild: used when items[] is the authoritative edit and the
// back-compat exercises[]/cardio[] views need to mirror it.
function wsDayItemsSync(day){
  if(!day || !Array.isArray(day.items)) return;
  const ex=[],cd=[];
  for(const inst of day.items){
    const k=wsTagItemKind(inst);
    if(k==='weighted') ex.push(inst);
    else cd.push(inst);
  }
  day.exercises=ex;
  day.cardio=cd;
}

// Identity-based dedup. Every instance carries a unique iid, so the only
// thing this removes is a repeated iid — a state normal use can't produce.
// It's kept purely as a cheap integrity guard. Crucially, two *distinct*
// instances of the same exercise (same exId, different iids) are preserved,
// so a day can contain the same exercise as many times as the user wants.
//
// (The earlier content-signature repair for pre-iid corrupted data has been
// removed: the only data it protected is disposable test data that will be
// wiped at go-live, and dormant-but-active cleanup code is a latent trap.
// Instances missing an iid simply get one stamped in wsDayItemsBuild.)
function wsDedupItems(days){
  if(!Array.isArray(days)) return;
  for(const day of days){
    if(!Array.isArray(day.items)||day.items.length<2) continue;
    const seen=new Set();
    const cleaned=[];
    let foundDup=false;
    for(const inst of day.items){
      if(!inst) continue;
      // Items without an iid haven't been stamped yet; let them through —
      // wsDayItemsBuild assigns iids right after this runs.
      if(inst._iid && seen.has(inst._iid)){ foundDup=true; continue; }
      if(inst._iid) seen.add(inst._iid);
      cleaned.push(inst);
    }
    if(foundDup) day.items=cleaned;
  }
}

// Module-level migration: walk every day and ensure items[] exists. Called
// from the startup path after legacy migration runs.
function wsMigrateToItemsModel(days){
  if(!Array.isArray(days)) return;
  // Integrity guard (identity-only), then (re)build items[], stamp any
  // missing iids, and rebuild the derived arrays.
  wsDedupItems(days);
  for(const day of days) wsDayItemsBuild(day);
}

// Remove an instance object from both the day's items[] and its legacy array.
// Returns true if anything was removed. Mutates in place.
function wsDayRemoveInstance(day,inst){
  if(!day || !inst) return false;
  if(!Array.isArray(day.items)) return false;
  const i=day.items.indexOf(inst);
  if(i<0) return false;
  day.items.splice(i,1);
  // Rebuild the derived exercises[]/cardio[] views from items[].
  wsDayItemsSync(day);
  return true;
}

// Remove an instance by its iid (identity key). Preferred over reference-based
// removal when the caller only has an id, or after any path where references
// might not be shared. Touches items[] and rebuilds derived arrays.
function wsDayRemoveByIid(day,iid){
  if(!day || !iid || !Array.isArray(day.items)) return false;
  const before=day.items.length;
  day.items=day.items.filter(i=>i._iid!==iid);
  const removed=day.items.length<before;
  if(removed) wsDayItemsSync(day);
  return removed;
}
function wsDayRemoveByExId(day,exId){
  if(!day) return 0;
  let removed=0;
  if(Array.isArray(day.items)){
    const before=day.items.length;
    day.items=day.items.filter(i=>i.exId!==exId);
    removed=before-day.items.length;
    // Rebuild the derived views from the now-authoritative items[].
    wsDayItemsSync(day);
  } else {
    // Defensive fallback for any day without items[] (shouldn't happen).
    if(Array.isArray(day.exercises)) day.exercises=day.exercises.filter(e=>e.exId!==exId);
    if(Array.isArray(day.cardio))    day.cardio=day.cardio.filter(e=>e.exId!==exId);
  }
  return removed;
}

function makeDays(){
  return [
    {label:'Day 1',titleHtml:'Push +<br><em>Pull</em>',published:true,exercises:[
      {name:'Bench Press',exId:'bench-press-barbell',cue:'',sets:[{w:65,r:8},{w:65,r:8},{w:65,r:8},{w:65,r:8}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:true,sound:true,_bodyweight:false},
      {name:'Single-Leg Squat (balance pad)',exId:'smith-single-leg-split-squat',cue:'',sets:[{w:5,r:10},{w:5,r:10},{w:5,r:10},{w:5,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Cable Triceps Extension (standing)',exId:'cable-rope-overhead-triceps-extension',cue:'',sets:[{w:20,r:10},{w:20,r:10},{w:20,r:10},{w:20,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Face Pull (standing)',exId:'face-pull',cue:'',sets:[{w:20,r:10},{w:20,r:10},{w:20,r:10},{w:20,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Lat Pulldown',exId:'wide-grip-lat-pulldown',cue:'',sets:[{w:65,r:10},{w:65,r:10},{w:65,r:10},{w:65,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false}
    ],cardio:[
      {kind:'intervals',name:'Finisher HIIT',icon:'kettlebell',cue:'',simpleMode:false,roundsCustom:[{name:'Kettlebell Swing 30kg',work:40,rest:20},{name:'Push-Ups',work:30,rest:20},{name:'Mountain Climbers',work:30,rest:20},{name:'Battle Ropes',work:30,rest:30}],workSec:40,restSec:20,totalRounds:2,roundRest:60,amrap:false,capMin:0,rounds:0,logged:false,phase:'idle',phaseIdx:0,phaseLeft:40,sound:true}
    ],logged:false},
    {label:'Day 2',titleHtml:'Upper<br><em>DB</em>',published:true,exercises:[
      {name:'DB Shoulder Press (seated)',exId:'dumbbell-shoulder-press',cue:'',sets:[{w:20,r:6},{w:20,r:6},{w:20,r:6},{w:20,r:6}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:true,sound:true,_bodyweight:false},
      {name:'DB Bicep Curl (seated)',exId:'machine-bicep-curl',cue:'',sets:[{w:12,r:10},{w:12,r:10},{w:12,r:10},{w:12,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Lateral Raise (DB, standing)',exId:'side-lateral-raise',cue:'',sets:[{w:10,r:7},{w:10,r:7},{w:10,r:7},{w:10,r:7}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Weighted Pull-Up',exId:'weighted-pull-ups',cue:'',sets:[{w:16,r:7},{w:16,r:7},{w:16,r:7}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:true},
      {name:'Dips',exId:'dips',cue:'',sets:[{w:0,r:8},{w:0,r:8},{w:0,r:8},{w:0,r:8}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:true},
      {name:'Dip-Bar Leg Raise → L-sit',exId:'hanging-leg-raise',cue:'',sets:[{w:0,r:10},{w:0,r:10},{w:0,r:10},{w:0,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:true}
    ],cardio:[
      {kind:'distance',name:'Interval Rowing',exId:'rowing-stationary',icon:'row',cue:'',duration:300,actualDuration:null,intensity:'Hard',distance:1.15,logged:false,timerMode:'limit',rl:300,rs:'idle',rv:true,sound:true}
    ],logged:false},
    {label:'Day 3',titleHtml:'Legs +<br><em>Posterior</em>',published:true,exercises:[
      {name:'Romanian Deadlift',exId:'romanian-deadlift',cue:'',sets:[{w:60,r:10},{w:60,r:10},{w:60,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:true,sound:true,_bodyweight:false},
      {name:'Hack Squat',exId:'hack-squat',cue:'',sets:[{w:30,r:8},{w:30,r:8},{w:30,r:8}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Calf Raise (hack machine)',exId:'barbell-seated-calf-raise',cue:'',sets:[{w:30,r:15},{w:30,r:15},{w:30,r:15}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Glute Bridge (machine)',exId:'barbell-glute-bridge',cue:'',sets:[{w:30,r:10},{w:30,r:10},{w:30,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false},
      {name:'Roman Chair Back Extension',exId:'hyperextensions-back-extensions',cue:'',sets:[{w:0,r:10},{w:0,r:10},{w:0,r:10},{w:0,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:true}
    ],logged:false},
    {label:'Day 4',titleHtml:'Home<br><em>Circuit</em>',published:true,exercises:[
      {name:'Pull-Up',exId:'pull-up',cue:'',sets:[{w:0,r:12},{w:0,r:12},{w:0,r:12}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:true,sound:true,_bodyweight:true},
      {name:'Push-Up',exId:'decline-push-up',cue:'',sets:[{w:0,r:20},{w:0,r:20},{w:0,r:20}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:true},
      {name:'Ab Roller',exId:'ab-roller',cue:'',sets:[{w:0,r:12},{w:0,r:12},{w:0,r:12}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:true},
      {name:'DB Squat (on shoulders)',exId:'dumbbell-squat',cue:'',sets:[{w:15,r:10},{w:15,r:10},{w:15,r:10}],deletedSets:[],rest:90,rl:90,rs:'idle',rv:false,sound:true,_bodyweight:false}
    ],logged:false},
    {label:'Day 5',titleHtml:'Mobility +<br><em>Intervals</em>',published:true,exercises:[],cardio:[
      {kind:'time',name:'Jump Rope',exId:'rope-jumping',icon:'jump',cue:'',duration:300,actualDuration:null,intensity:'Mod',distance:null,logged:false,timerMode:'limit',rl:300,rs:'idle',rv:true,sound:true},
      {kind:'intervals',name:'Conditioning Circuit',icon:'kettlebell',cue:'',simpleMode:false,roundsCustom:[{name:'Jump in Place',work:30,rest:15},{name:'Butt Kicks',work:30,rest:15},{name:'Alternating Lunges',work:30,rest:15},{name:'Mountain Climbers',work:30,rest:15},{name:'Plank Jacks',work:30,rest:15},{name:'Plank Elbow Touches',work:30,rest:15}],workSec:30,restSec:15,totalRounds:3,roundRest:60,amrap:false,capMin:0,rounds:0,logged:false,phase:'idle',phaseIdx:0,phaseLeft:30,sound:true},
      {kind:'distance',name:'Cool-Down Walk',exId:'walking-treadmill',icon:'walk',cue:'',duration:600,actualDuration:null,intensity:'Low',distance:1.0,logged:false,timerMode:'limit',rl:600,rs:'idle',rv:true,sound:true}
    ],logged:false}
  ];
}
