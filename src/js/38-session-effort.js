
/* ════════════════════════════════════════════════════════════════════════════
   v49 — SESSION EFFORT (sRPE)
   ────────────────────────────────────────────────────────────────────────────
   Effort was per-exercise and optional, so the Effort trend inherited the same
   composition problem as load: a week of heavy compounds and a week of curls
   average different exercise mixes, and unrated exercises silently drop out.

   Session RPE is the construct the literature actually validates for resistance
   training (ICC 0.88 across high/moderate/low intensity protocols), and it is
   composition-proof by nature: one rating for the whole session, regardless of
   what was in it. It is also one tap instead of one per exercise, which is the
   difference between a line that gets filled in and one that doesn't.

   Resolution order for a session's effort:
     1. sessionRpe   — the user rated the session outright
     2. derived      — mean of whatever per-exercise ratings exist
     3. null         — never zero, never guessed
   ════════════════════════════════════════════════════════════════════════════ */

function wsSessionEffort(rec){
  if(!rec) return null;
  if(typeof rec.sessionRpe==='number'){
    return { value:rec.sessionRpe, source:(rec.sessionRpeEstimated?'estimated':'rated') };
  }
  let sum=0,n=0;
  for(const e of (rec.entries||[])){
    const v=(typeof e.rpe==='number') ? e.rpe
          : (typeof e.peakRpe==='number' ? e.peakRpe : null);
    if(v!=null){ sum+=v; n++; }
  }
  if(!n) return null;
  return { value:Math.round((sum/n)*10)/10, source:'derived' };
}

function wsSetSessionEffort(sessionId, val){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const rec=hist.find(r=>r&&r.id===sessionId);
  if(!rec) return false;
  if(val==null){ delete rec.sessionRpe; delete rec.sessionRpeEstimated; }
  else { rec.sessionRpe=val; delete rec.sessionRpeEstimated; }   // a real rating clears the estimate flag
  wsPersistSave();
  return true;
}

// 1-10 chip strip. Used at the bottom of a finished workout and in History.
function wsEffortStripHtml(sessionId, current, source){
  let chips='';
  for(let n=1;n<=10;n++){
    const on = (current!=null && Math.round(current)===n) ? ' on' : '';
    chips += '<button class="wsse-n'+on+'" onclick="wsPickSessionEffort(\''+sessionId+'\','+n+')">'+n+'</button>';
  }
  const note = current==null
    ? 'Rate the whole session — 1 easy, 10 all-out'
    : (source==='derived' ? 'Averaged from the exercises you rated · tap to set it yourself'
      : (source==='estimated' ? 'Estimated · tap to correct' : 'Session effort'));
  return '<div class="wsse">'
    +'<div class="wsse-h">How hard was that session?'
      + (source==='estimated'?'<span class="wsse-est">est</span>':'')
    +'</div>'
    +'<div class="wsse-row">'+chips+'</div>'
    +'<div class="wsse-note">'+note+'</div>'
  +'</div>';
}

function wsPickSessionEffort(id,n){
  try{ playKnock(); }catch(_){}
  wsSetSessionEffort(id,n);
  try{ renderAll(false); }catch(_){}
}

/* Backfill for sessions that predate effort tracking. Marked estimated so it is
   always distinguishable from a real rating, always visible as such in the UI,
   and reversible. Filling silently would falsify the log. */
function wsSeedEffort(lo,hi){
  lo=(typeof lo==='number')?lo:7; hi=(typeof hi==='number')?hi:9;
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let n=0;
  for(const rec of hist){
    if(typeof rec.sessionRpe==='number') continue;      // never overwrite a real rating
    if(wsSessionEffort(rec)) continue;                  // nor a derived one
    let hard=0,total=0;
    for(const e of (rec.entries||[])){
      if(e.kind!=='weighted'&&e.kind!=='bodyweight') continue;
      for(const s of (e.sets||[])){
        if(s.completed===false||s.warmup) continue;
        total++;
        const load=(typeof s.weightKg==='number')?s.weightKg:((s.bodyweightKg||0)+(s.offsetKg||0));
        const reps=(typeof s.reps==='number')?s.reps:0;
        if(load>0&&reps>0&&reps<=8) hard++;              // low-rep loaded work skews high
      }
    }
    if(!total) continue;
    const frac=hard/total;
    rec.sessionRpe=Math.round(lo+(hi-lo)*Math.min(1,frac*1.4));
    rec.sessionRpeEstimated=true;
    n++;
  }
  if(n) wsPersistSave();
  return n;
}
function wsClearSeededEffort(){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let n=0;
  for(const rec of hist){
    if(rec.sessionRpeEstimated){ delete rec.sessionRpe; delete rec.sessionRpeEstimated; n++; }
  }
  if(n) wsPersistSave();
  return n;
}
