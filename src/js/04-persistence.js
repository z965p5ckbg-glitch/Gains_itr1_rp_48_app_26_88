
// ─── Persistence ────────────────────────────────────────────────────
//
// localStorage-based save/load. One JSON blob under a single key with a
// schema version, plus a backup of the previous good load for recovery.
//
// What we persist:
//   - DAYS (the user's program — days, exercises, cardio, sets, etc.)
//   - EXERCISES (the catalog, including archived flags + user-added entries)
//   - settings object (audio + display preferences)
//   - UI prefs: wsLibGroupBy, wsLibExpandedGroups (as array), wsAdvancedTags
//
// Writes are debounced (200ms) so rapid edits don't hammer storage. A flush
// on visibilitychange + beforeunload covers sudden closes.
//
// Schema versioning: bump WS_PERSIST_VERSION if the on-disk shape changes
// in a backward-incompatible way. Loader compares and falls back to
// defaults if mismatch (with the bad blob backed up under a -corrupt key
// for potential manual recovery).

const WS_PERSIST_KEY='gains_v19_state';
const WS_PERSIST_BACKUP_KEY='gains_v19_state_backup';
const WS_PERSIST_CORRUPT_KEY='gains_v19_state_corrupt';
const WS_PERSIST_VERSION=7;
const WS_PERSIST_DEBOUNCE_MS=200;
// Routine console.log chatter (e.g. "[Gains] Injected N sessions") is OFF by default
// so the Claude-app preview's "Console Messages" drawer stays quiet during normal use.
// Genuine errors (console.warn/error) are NOT gated — they should still surface for
// diagnostics. Flip to true from the console (WS_DEBUG_LOG=true) when debugging.
let WS_DEBUG_LOG=false;

let _wsSaveTimer=null;
let _wsLoadedFromStorage=false;  // true if startup loaded saved state
let _wsResetting=false;          // true while an intentional reset+reload is underway

// Build the complete state blob from current in-memory values. Each
// let-declared global is read inside its own try/catch because at very
// early lifecycle events (visibilitychange on hot-reload, pagehide on a
// stale tab) this function can run *before* those declarations have
// executed. A bare reference would throw a TDZ ReferenceError; a try/catch
// gracefully falls back to a safe default so the save still succeeds with
// the parts we do have.
function wsBuildPersistBlob(){
  let settingsSnap={};
  try{ if(settings) settingsSnap=settings; }catch(_){}
  let libGroupBySnap='title';
  try{ if(wsLibGroupBy) libGroupBySnap=wsLibGroupBy; }catch(_){}
  let libExpandedSnap=[];
  try{ if(wsLibExpandedGroups) libExpandedSnap=Array.from(wsLibExpandedGroups); }catch(_){}
  let advancedTagsSnap=false;
  try{ advancedTagsSnap=!!wsAdvancedTags; }catch(_){}
  let historySnap=[];
  try{ if(Array.isArray(HISTORY)) historySnap=HISTORY; }catch(_){}
  let maxesSnap={};
  try{ if(wsMaxes && typeof wsMaxes==='object') maxesSnap=wsMaxes; }catch(_){}
  // Persist each day with items[] as the single source of truth. We DROP the
  // derived exercises[]/cardio[] arrays from the serialized form: keeping them
  // is redundant (they're rebuilt from items[] on load) and was the cause of
  // a duplication bug — JSON breaks the cross-array reference identity, so a
  // round-trip turned shared instances into separate objects. Storing only
  // items[] makes that class of bug impossible.
  let daysSnap=DAYS;
  try{
    daysSnap=DAYS.map(day=>{
      const copy={};
      for(const k in day){
        if(k==='exercises'||k==='cardio') continue; // derived — don't persist
        copy[k]=day[k];
      }
      return copy;
    });
  }catch(_){ daysSnap=DAYS; }
  return {
    version:WS_PERSIST_VERSION,
    savedAt:Date.now(),
    days:daysSnap,
    exercises:EXERCISES,
    favorites:Array.from(wsFavorites),
    history:historySnap,
    maxes:maxesSnap,
    settings:settingsSnap,
    ui:{
      libGroupBy:libGroupBySnap,
      libExpandedGroups:libExpandedSnap,
      advancedTags:advancedTagsSnap,
    },
  };
}

// Write to localStorage right now (no debounce). Safe to call on every change;
// we move the previous successful state to a backup slot so a corrupted write
// doesn't destroy the prior good state.
// Guard flag: stays false until module-init has finished defining all the
// let-bound globals the blob builder reads. Lifecycle handlers (pagehide,
// visibilitychange) can fire on hot-reload before init completes — without
// this guard, those early flushes would persist a half-built blob that
// overwrites the good saved state. Set true at the end of init.
let _wsPersistReady=false;

function wsPersistFlush(){
  if(_wsSaveTimer){ clearTimeout(_wsSaveTimer); _wsSaveTimer=null; }
  if(_wsResetting) return; // an intentional reset is in progress — do not re-write
  if(!_wsPersistReady) return; // skip pre-init flushes; nothing useful to save yet
  try{
    const blob=wsBuildPersistBlob();
    const json=JSON.stringify(blob);
    // Rotate: move current → backup before overwriting current
    try{
      const prev=localStorage.getItem(WS_PERSIST_KEY);
      if(prev) localStorage.setItem(WS_PERSIST_BACKUP_KEY,prev);
    }catch(_){}
    localStorage.setItem(WS_PERSIST_KEY,json);
    _wsStorageFailed=false;
  }catch(e){
    // Most likely cause: quota exceeded or Safari private mode (storage disabled).
    // Don't crash — the in-memory state is still good for the rest of this session.
    if(typeof console!=='undefined'&&console.warn) console.warn('Persist failed:',e&&e.message);
    // ...but DO tell the user. Silently failing to save is how a month of
    // training disappears without anyone noticing until it's gone.
    _wsStorageFailed=true;
    try{
      const now=Date.now();
      if(now-_wsStorageWarnedAt>60000){
        _wsStorageWarnedAt=now;
        if(typeof wsToastMsg==='function') wsToastMsg('Not saving — export a backup now');
      }
    }catch(_){}
  }
}
// True when the last write to localStorage failed. Surfaced in the data sheet
// so the state is inspectable, not just a toast that vanishes.
let _wsStorageFailed=false;
let _wsStorageWarnedAt=0;

// Schedule a save after a quiet period. Resets the timer on every call so
// bursty edits coalesce into one write.
function wsPersistSave(){
  if(_wsSaveTimer) clearTimeout(_wsSaveTimer);
  _wsSaveTimer=setTimeout(()=>{ _wsSaveTimer=null; wsPersistFlush(); },WS_PERSIST_DEBOUNCE_MS);
}

// Attempt to load from storage. Returns parsed blob or null. Validates the
// shape minimally; on parse error or version mismatch, archives the bad blob
// under -corrupt for diagnostics and returns null.
function wsPersistLoad(){
  try{
    const raw=localStorage.getItem(WS_PERSIST_KEY);
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object') return null;
    if(parsed.version!==WS_PERSIST_VERSION){
      // Schema mismatch — preserve bad blob, fall back to defaults.
      try{ localStorage.setItem(WS_PERSIST_CORRUPT_KEY,raw); }catch(_){}
      return null;
    }
    if(!Array.isArray(parsed.days)||!Array.isArray(parsed.exercises)) return null;
    return parsed;
  }catch(e){
    try{
      const raw=localStorage.getItem(WS_PERSIST_KEY);
      if(raw) localStorage.setItem(WS_PERSIST_CORRUPT_KEY,raw);
    }catch(_){}
    return null;
  }
}

// Apply a loaded blob to the in-memory state. Caller has already validated.
// Note: UI-prefs and settings are deferred via _wsPending* because the
// `let settings = …` and `let wsLib* = …` declarations live further down
// in the file. Applying them here would hit a temporal-dead-zone error.
let _wsPendingUiPrefs=null;
let _wsPendingSettings=null;
let _wsPendingFavorites=null;
// 1RM store: user-given maxes keyed by normalized exercise name.
// { "<name lower>": { kg:Number, setAt:epochMs } }. Survives day resets —
// a max is a property of the exercise, not of a session.
let wsMaxes={};
function wsPersistApply(blob){
  // Replace whole arrays (no merge) — saved blob is authoritative for these.
  DAYS=blob.days;
  EXERCISES=blob.exercises;
  if(blob.maxes && typeof blob.maxes==='object') wsMaxes=blob.maxes;
  // Settings and UI prefs are stashed for later application — the
  // `let settings = …` and `let wsLib* = …` declarations live further down
  // in the script. Accessing them here would hit a temporal-dead-zone
  // ReferenceError. wsApplyPendingPrefs() applies both after declarations.
  if(blob.settings) _wsPendingSettings=blob.settings;
  if(blob.ui) _wsPendingUiPrefs=blob.ui;
  if(Array.isArray(blob.favorites)) _wsPendingFavorites=blob.favorites;
}

// Apply pending settings + UI prefs once the let-declared state variables
// exist. Safe to call multiple times; clears holders after first run.
function wsApplyPendingPrefs(){
  try{
    if(_wsPendingSettings && typeof settings==='object'){
      Object.assign(settings,_wsPendingSettings);
    }
  }catch(_){}
  _wsPendingSettings=null;
  if(_wsPendingFavorites && typeof wsFavorites!=='undefined'){
    try{ wsFavorites=new Set(_wsPendingFavorites); }catch(_){}
    _wsPendingFavorites=null;
  }
  wsApplyPendingUiPrefs();
}

// Backward-compat alias — older code paths might still call this name.
function wsApplyPendingUiPrefs(){
  if(!_wsPendingUiPrefs) return;
  const ui=_wsPendingUiPrefs;
  try{
    if(typeof ui.libGroupBy==='string') wsLibGroupBy=ui.libGroupBy;
    if(Array.isArray(ui.libExpandedGroups)) wsLibExpandedGroups=new Set(ui.libExpandedGroups);
    if(typeof ui.advancedTags==='boolean') wsAdvancedTags=ui.advancedTags;
  }catch(_){}
  _wsPendingUiPrefs=null;
}
