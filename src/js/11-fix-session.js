// Correction sheet — everything reversible-by-hand in one place.

/* ════════════════════════════════════════════════════════════════════════════
   v51 — RETROACTIVELY ADD AN EXERCISE TO A LOGGED SESSION
   ────────────────────────────────────────────────────────────────────────────
   Fix session could only REMOVE. Link did an extra exercise one day, forgot to
   add it before logging, and had no way to record it afterwards — so the work
   simply never existed as far as the app was concerned.

   The entry built here matches captureSessionRecord's shape exactly, including
   muscles pulled from the catalog, so every downstream reader (trends, the
   fixed-basket load index, like-for-like comparison, PRs, muscle volume) picks
   it up with no special-casing. Nothing downstream knows it was added later.
   ════════════════════════════════════════════════════════════════════════════ */

let wsAddExCtx = null;   // {sessionId, exId, name, kind}

function wsAddExSearch(sessionId, q){
  q=String(q||'').trim().toLowerCase();
  const box=document.getElementById('wsAddExResults');
  if(!box) return;
  if(q.length<2){ box.innerHTML='<div class="ws-data-note">Type at least two letters.</div>'; return; }
  const cat=(typeof EXERCISES!=='undefined'&&Array.isArray(EXERCISES))?EXERCISES:[];
  const hits=cat.filter(e=>{
    const t=String(e.title||'').toLowerCase();
    if(t.indexOf(q)>=0) return true;
    return (e.aliases||[]).some(a=>String(a).toLowerCase().indexOf(q)>=0);
  }).slice(0,6);
  if(!hits.length){ box.innerHTML='<div class="ws-data-note">Nothing matched. You can still add it by name below.</div>'; return; }
  box.innerHTML=hits.map(e=>
    '<div class="ws-addex-hit" onclick="wsAddExChoose(\''+sessionId+'\',\''+e.exId+'\')">'
    +'<span class="ws-addex-hn">'+hiEscape(e.title)+'</span>'
    +'<span class="ws-addex-hm">'+hiEscape((e.muscles||[]).slice(0,2).join(' · '))+'</span></div>').join('');
}

// Default weighted-vs-bodyweight from how this lift was logged before, not from
// a guess — if past sessions recorded it as bodyweight, it almost certainly is.
function wsAddExPriorKind(exId){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  for(let i=hist.length-1;i>=0;i--){
    for(const e of (hist[i].entries||[])){
      if(e.exId===exId && (e.kind==='weighted'||e.kind==='bodyweight')) return e.kind;
    }
  }
  return 'weighted';
}

function wsAddExChoose(sessionId, exId){
  const cat=(typeof EXERCISES!=='undefined'&&Array.isArray(EXERCISES))?EXERCISES:[];
  const ex=cat.find(e=>e.exId===exId);
  if(!ex) return;
  wsAddExCtx={sessionId:sessionId, exId:exId, name:ex.title, kind:wsAddExPriorKind(exId)};
  const box=document.getElementById('wsAddExResults');
  if(box) box.innerHTML='';
  const form=document.getElementById('wsAddExForm');
  if(form) form.innerHTML=wsAddExFormHtml();
  const si=document.getElementById('wsAddExSearchInput');
  if(si) si.value=ex.title;
}

function wsAddExFormHtml(){
  const c=wsAddExCtx; if(!c) return '';
  const bw = c.kind==='bodyweight';
  return '<div class="ws-addex-form">'
    +'<div class="ws-addex-picked">'+hiEscape(c.name)+'</div>'
    +'<div class="ws-addex-kind">'
      +'<button class="ws-addex-k'+(!bw?' on':'')+'" onclick="wsAddExSetKind(\'weighted\')">Weighted</button>'
      +'<button class="ws-addex-k'+(bw?' on':'')+'" onclick="wsAddExSetKind(\'bodyweight\')">Bodyweight</button>'
    +'</div>'
    +'<div class="ws-addex-fields">'
      +'<label class="ws-addex-f"><span>Sets</span><input id="wsAddExSets" type="number" inputmode="numeric" min="1" max="20" value="3"></label>'
      +'<label class="ws-addex-f"><span>Reps</span><input id="wsAddExReps" type="number" inputmode="numeric" min="1" max="100" value="10"></label>'
      +'<label class="ws-addex-f"><span>'+(bw?'Added kg':'Weight kg')+'</span><input id="wsAddExKg" type="number" inputmode="decimal" min="0" step="0.5" value="'+(bw?'0':'20')+'"></label>'
    +'</div>'
    +'<div class="ws-data-note">Every set is recorded at the same weight and reps. Fine-tune individual sets afterwards in the full session view.</div>'
    +'<div class="ws-data-btn" onclick="wsAddExCommit()">Add to this session</div>'
  +'</div>';
}

function wsAddExSetKind(k){
  if(!wsAddExCtx) return;
  wsAddExCtx.kind=k;
  const form=document.getElementById('wsAddExForm');
  if(form) form.innerHTML=wsAddExFormHtml();
}

function wsAddExCommit(){
  const c=wsAddExCtx; if(!c) return;
  const rd=id=>{ const el=document.getElementById(id); return el?parseFloat(el.value):NaN; };
  let nSets=Math.round(rd('wsAddExSets')), reps=Math.round(rd('wsAddExReps')), kg=rd('wsAddExKg');
  if(!isFinite(nSets)||nSets<1) nSets=1;  if(nSets>20) nSets=20;
  if(!isFinite(reps)||reps<1) reps=1;     if(reps>100) reps=100;
  if(!isFinite(kg)||kg<0) kg=0;
  const {rec}=wsFindRec(c.sessionId);
  if(!rec){ wsToastMsg('Session not found'); return; }
  const cat=(typeof EXERCISES!=='undefined'&&Array.isArray(EXERCISES))?EXERCISES:[];
  const ce=cat.find(e=>e.exId===c.exId);
  const bwKg=(function(){
    // use the bodyweight already on record for this session's era, not today's
    const hist=Array.isArray(HISTORY)?HISTORY:[];
    for(let i=hist.length-1;i>=0;i--){
      for(const e of (hist[i].entries||[])){
        for(const s of (e.sets||[])) if(typeof s.bodyweightKg==='number') return s.bodyweightKg;
      }
    }
    return 76;
  })();
  const sets=[];
  for(let i=0;i<nSets;i++){
    sets.push(c.kind==='bodyweight'
      ? {reps:reps, completed:true, offsetKg:kg, bodyweightKg:bwKg}
      : {reps:reps, completed:true, weightKg:kg});
  }
  rec.entries=Array.isArray(rec.entries)?rec.entries:[];
  rec.entries.push({
    exId:c.exId, iid:'added_'+c.exId, name:c.name, kind:c.kind,
    muscles:(ce&&Array.isArray(ce.muscles))?ce.muscles.slice():[],
    sets:sets, _addedLater:true
  });
  if(typeof wsPersistFlush==='function') wsPersistFlush(); else wsPersistSave();
  if(typeof hiRender==='function') hiRender();
  try{ if(typeof currentView!=='undefined'&&currentView==='progress') wsProgRender(); }catch(_){}
  wsAddExCtx=null;
  wsToastMsg(c.name+' added — records and trends updated');
  wsFixSession(c.sessionId);
}

function wsAddExSectionHtml(sessionId){
  return '<div class="ws-data-sep">Add an exercise you forgot</div>'
    +'<div class="ws-data-note">Did something at the rack that never made it into the log? Add it here — it counts toward your records, trends and comparisons exactly as if you had logged it at the time.</div>'
    +'<input id="wsAddExSearchInput" class="ws-addex-search" type="text" placeholder="Search the library…" '
      +'oninput="wsAddExSearch(\''+sessionId+'\',this.value)">'
    +'<div id="wsAddExResults"></div>'
    +'<div id="wsAddExForm"></div>';
}

function wsFixSession(id){
  const {rec}=wsFindRec(id); if(!rec) return;
  let el=document.getElementById('wsFixSheet');
  if(!el){ el=document.createElement('div'); el.id='wsFixSheet'; el.className='ws-data-wrap'; document.body.appendChild(el); }
  const rows=(rec.entries||[]).map((e,i)=>{
    let sub='';
    if(e.kind==='weighted'||e.kind==='bodyweight'){
      const n=(e.sets||[]).filter(st=>st.completed!==false).length;
      sub=n+' set'+(n===1?'':'s');
    } else if(e.kind==='cardio'&&e.cardio){
      sub=e.cardio.distanceM?((e.cardio.distanceM/1000).toFixed(1)+' km'):fmtMS(e.cardio.durationSec||0);
    } else if(e.kind==='hiit'&&e.hiit){
      sub=(e.hiit.roundsDone||0)+' rounds';
    }
    return '<div class="ws-fix-row"><div class="ws-fix-m"><div class="ws-fix-n">'+hiEscape(e.name||'(unnamed)')+
      '</div><div class="ws-fix-s">'+hiEscape(sub)+'</div></div>'+
      '<div class="ws-fix-x" onclick="wsFixRemoveEntry(\'' + id + '\',' + i + ')">Remove</div></div>';
  }).join('');
  el.innerHTML='<div class="ws-data-scrim" onclick="wsCloseFix()"></div>'+
    '<div class="ws-data-sheet">'+
      '<div class="ws-data-h">Fix session</div>'+
      '<div class="ws-data-stat"><span>'+hiEscape(rec.date||'')+'</span></div>'+
      '<div class="ws-data-note">Remove an exercise you did not actually do, or delete the whole session. Corrections update your records and trends immediately.</div>'+
      (rows||'<div class="ws-data-note">No exercises in this session.</div>')+
      '<div class="ws-data-sep">Session effort</div>'+(function(){var _se=wsSessionEffort(rec);return wsEffortStripHtml(id,_se?_se.value:null,_se?_se.source:null);})()+wsAddExSectionHtml(id)+'<div class="ws-data-sep">Date</div>'+
      '<div class="ws-data-note">Logged on the wrong day? Set the real date — records and trends re-sort immediately.</div>'+
      '<input type="date" id="wsFixDate" class="ws-fix-date" value="'+((rec.date||'').slice(0,10))+'">'+
      '<div class="ws-data-btn" onclick="wsFixSetDate(\''+id+'\')">Save date</div>'+
      '<div class="ws-data-sep">Whole session</div>'+
      '<div class="ws-data-btn danger" onclick="wsFixDeleteSession(\'' + id + '\')">Delete this session</div>'+
      '<div class="ws-data-btn close" onclick="wsCloseFix()">Done</div>'+
    '</div>';
  requestAnimationFrame(()=>el.classList.add('on'));
}
function wsCloseFix(){ const el=document.getElementById('wsFixSheet'); if(el) el.classList.remove('on'); }
function wsFixRemoveEntry(id,idx){
  const {rec}=wsFindRec(id); if(!rec) return;
  const nm=(rec.entries[idx]&&rec.entries[idx].name)||'this exercise';
  if(!confirm('Remove '+nm+' from this session?')) return;
  const wasLast=(rec.entries||[]).length<=1;
  wsDeleteEntry(id,idx);
  if(wasLast) wsCloseFix(); else wsFixSession(id);
}
function wsFixSetDate(id){
  const {rec}=wsFindRec(id); if(!rec) return;
  const inp=document.getElementById('wsFixDate'); if(!inp) return;
  const v=(inp.value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){ wsToastMsg('Pick a valid date'); return; }
  const t=new Date(v+'T12:00:00');
  if(isNaN(t.getTime())){ wsToastMsg('Pick a valid date'); return; }
  if(t.getTime() > Date.now()+86400000){ wsToastMsg('That date is in the future'); return; }
  // preserve the original time-of-day where we have one
  const old=new Date(rec.date);
  if(!isNaN(old.getTime())) t.setHours(old.getHours(), old.getMinutes(), 0, 0);
  rec.date=t.toISOString();
  HISTORY.sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  if(typeof hiRender==='function') hiRender();
  try{ if(typeof currentView!=='undefined'&&currentView==='progress') wsProgRender(); }catch(_){}
  wsToastMsg('Date updated');
  wsCloseFix();
}
function wsFixDeleteSession(id){
  if(!confirm('Delete this entire session? This cannot be undone.')) return;
  wsDeleteSession(id); wsCloseFix();
}
