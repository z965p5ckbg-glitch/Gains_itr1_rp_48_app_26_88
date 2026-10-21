
// Applies an import over the current log. Same contract as wsRestoreBackup.

/* ════════════════════════════════════════════════════════════════════════════
   v54 — MERGE IMPORT (keep what you have logged here)
   ────────────────────────────────────────────────────────────────────────────
   wsApplyLegacyImport does `HISTORY = r.records` — a flat replace. That was
   right when the app held nothing but demo data. It is wrong now: sessions
   logged in Gains during field testing are real training, and a replace would
   delete them silently.

   Merge rules:
   • Existing records are never touched.
   • Legacy records are added only if their id is not already present. Legacy
     ids are deterministic (`legacy-YYYY-MM-DD`), so re-running the import is
     safe and idempotent rather than duplicating everything.
   • The result is sorted by date ASCENDING, because two call sites read
     HISTORY[length-1] as "the most recent session" — appending older records
     at the end would silently break the post-workout comparison card.
   • Declared 1RMs and bodyweight are left alone on merge. They are yours from
     real use here; only a full replace clears them.
   • Same-day collisions between an imported day and a session logged here are
     reported, not silently fused — that is a judgement call, not a rule.
   ════════════════════════════════════════════════════════════════════════════ */

function wsHistorySortByDate(list){
  return list.slice().sort((a,b)=>{
    const ta=new Date(a&&a.date).getTime(), tb=new Date(b&&b.date).getTime();
    if(isNaN(ta)&&isNaN(tb)) return 0;
    if(isNaN(ta)) return -1;
    if(isNaN(tb)) return 1;
    return ta-tb;
  });
}

function wsPlanLegacyMerge(text){
  const r=wsImportLegacy(text);
  if(!r.ok) return r;
  const existing=Array.isArray(HISTORY)?HISTORY:[];
  const haveIds=Object.create(null);
  existing.forEach(x=>{ if(x&&x.id) haveIds[x.id]=true; });

  const dayKey=d=>{ try{ return wsLegacyDayKey(d); }catch(_){ return String(d||'').slice(0,10); } };
  const existingDays=Object.create(null);
  existing.forEach(x=>{ if(x&&x.date) (existingDays[dayKey(x.date)]=existingDays[dayKey(x.date)]||[]).push(x); });

  const toAdd=[], dupes=[], collisions=[];
  for(const rec of r.records){
    if(haveIds[rec.id]){ dupes.push(rec.id); continue; }
    const k=dayKey(rec.date);
    if(existingDays[k]) collisions.push({day:k, existing:existingDays[k].length});
    toAdd.push(rec);
  }
  return {ok:true, records:r.records, toAdd, dupes, collisions,
          existingCount:existing.length, stats:r.stats};
}

function wsApplyLegacyMerge(text){
  const p=wsPlanLegacyMerge(text);
  if(!p.ok) return p;
  try{
    const existing=Array.isArray(HISTORY)?HISTORY:[];
    HISTORY=wsHistorySortByDate(existing.concat(p.toAdd));
    if(typeof settings==='object'&&settings){
      settings._planHistoryInjected=true;      // stop demo seeding over real data
      if(!Array.isArray(settings.bodyLog)) settings.bodyLog=[];
      // NOTE: bodyweight and wsMaxes deliberately untouched — on a merge those
      // came from real use of this app and are not the import's to overwrite.
    }
    if(typeof wsPersistFlush==='function') wsPersistFlush();
    else if(typeof wsPersistSave==='function') wsPersistSave();
    if(typeof wsRender==='function') wsRender();
    return {ok:true, added:p.toAdd.length, skipped:p.dupes.length,
            kept:p.existingCount, total:HISTORY.length, collisions:p.collisions,
            msg:'Merged '+p.toAdd.length+' imported day'+(p.toAdd.length===1?'':'s')
                +' with '+p.existingCount+' already here.'};
  }catch(e){ return {ok:false,msg:'Merge failed: '+(e&&e.message||'unknown')}; }
}

function wsApplyLegacyImport(text){
  const r=wsImportLegacy(text);
  if(!r.ok) return r;
  try{
    HISTORY=r.records;
    if(typeof settings==='object'&&settings){
      settings._planHistoryInjected=true;                  // never re-seed demo over real data
      if(!Array.isArray(settings.bodyLog)) settings.bodyLog=[];
      if(settings.profile) settings.profile.bodyweight=[{t:Date.now(),value:WS_LEGACY_BW_KG}];
    }
    // Declared 1RMs are a user assertion, not something to infer from history.
    // Clearing stops demo PRs standing over real training.
    try{ if(typeof wsMaxes==='object'&&wsMaxes){ for(const k in wsMaxes) delete wsMaxes[k]; } }catch(_){}
    if(typeof wsPersistFlush==='function') wsPersistFlush();
    if(typeof wsRender==='function') wsRender();
    return r;
  }catch(e){ return {ok:false,msg:'Import failed: '+(e&&e.message||'unknown')}; }
}

function wsRestoreBackup(text){
  let b;
  try{ b=JSON.parse(text); }catch(_){ return {ok:false,msg:'That is not valid backup text.'}; }
  if(!b||!b._gainsBackup||!Array.isArray(b.history)) return {ok:false,msg:'That file is not a Gains backup.'};
  try{
    HISTORY=b.history;
    if(b.settings&&typeof settings==='object'){
      const keepPins=b.settings.progPins;
      Object.assign(settings,b.settings);
      if(Array.isArray(keepPins)) settings.progPins=keepPins;
      settings._planHistoryInjected=true;   // never re-inject demo data over real data
    }
    if(b.maxes&&typeof wsMaxes==='object') Object.assign(wsMaxes,b.maxes);
    if(b.cal&&typeof WS_CAL==='object') Object.assign(WS_CAL,b.cal);
    if(typeof wsPersistFlush==='function') wsPersistFlush();
    if(typeof wsRender==='function') wsRender();
    return {ok:true,msg:'Restored '+b.history.length+' sessions.'};
  }catch(e){ return {ok:false,msg:'Restore failed: '+(e&&e.message||'unknown')}; }
}
// Start empty: clear the demo history, keep the user's own program.
function wsStartEmpty(){
  HISTORY=[];
  // PRs/e1RM live in wsMaxes, not HISTORY. Clearing only HISTORY left the demo
  // records standing, which is why a "clear" looked like it hadn't cleared.
  try{ if(typeof wsMaxes==='object'&&wsMaxes){ for(const k in wsMaxes) delete wsMaxes[k]; } }catch(_){}
  if(typeof settings==='object'&&settings){
    settings._planHistoryInjected=true;
    settings.bodyLog=[];                                   // v42 bodyweight log
    if(settings.profile) settings.profile.bodyweight=[];    // demo-seeded 73kg reading
  }
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  if(typeof wsRender==='function') wsRender();
  wsToastMsg('Cleared — your log starts now');
  // Reload after the toast: in-memory view state (charts, PR caches, expanded
  // cards) is rebuilt from scratch, so nothing stale can survive the wipe.
  try{ setTimeout(function(){ try{ if(typeof location!=='undefined'&&location.reload) location.reload(); }catch(_){} }, 750); }catch(_){}
}
