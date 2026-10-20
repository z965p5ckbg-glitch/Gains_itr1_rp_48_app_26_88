
// v47: which sets "apply to all" is allowed to touch. Sets you have already
// performed are NOT included - rewriting a logged set retroactively falsifies
// work you actually did, which was the weight-mangling bug. Warm-ups are held
// out too: they are deliberately a different load from the working sets.
function wsApplyTargets(ex){
  const list=(ex&&Array.isArray(ex.sets))?ex.sets:[];
  return list.filter(s=>s && !s._logged && !s.warmup);
}
function wsApplyLabels(){
  const ex=DAYS[curDay].items[curEx]; if(!ex) return;
  const n=wsApplyTargets(ex).length;
  const total=(ex.sets||[]).length;
  const held=total-n;
  const txt=document.getElementById('applyTxt');
  const lbl=document.getElementById('applyLbl');
  const track=document.getElementById('applyTrack');
  if(n===0){
    if(lbl) lbl.textContent='All sets already logged';
    if(txt) txt.textContent='Nothing left to apply to';
    if(track) track.classList.add('disabled');
    return;
  }
  if(track) track.classList.remove('disabled');
  if(lbl) lbl.textContent = held>0
    ? `Apply weight to ${n} unlogged set${n===1?'':'s'}`
    : `Apply weight to all ${n} sets`;
  if(txt) txt.textContent = `Slide to apply ${fmtW(editW)}kg to ${n} set${n===1?'':'s'}`;
}
function openEdit(ei,si){
  // v53: once logged, captureSessionRecord has frozen a snapshot into HISTORY.
  // Mutating the on-screen day afterwards changed what you SAW without changing
  // what was RECORDED — the screen and the log silently disagreed. Corrections
  // after logging belong in History -> Fix this session, which edits the record.
  if(DAYS[curDay] && DAYS[curDay].logged){
    if(typeof wsToastMsg==='function') wsToastMsg('Already logged — fix it in History');
    return;
  }
  curEx=ei;curSet=si;
  const ex=DAYS[curDay].items[ei];const set=ex.sets[si];
  editW=set.w;editR=set.r||8;
  document.getElementById('wVal').textContent=fmtW(editW);document.getElementById('rVal').textContent=editR;
  document.getElementById('shTitle').textContent=`Set ${si+1} — ${ex.name.split('—')[0].trim()}`;
  // v47: the warm-up toggle used to be decorative - it wrote nothing and never
  // reflected the set it was opened on, so its 'on' state bled across sets.
  const wt=document.getElementById('shWarmTog');
  if(wt) wt.classList.toggle('on', !!set.warmup);
  wsApplyLabels();
  resetApplyTrack();
  document.getElementById('overlay').classList.add('open');
}
function fmtW(w){return w%1===0?String(w):w.toFixed(1);}
function stepW(d){playKnock();editW=Math.max(0,Math.min(999,parseFloat((editW+d*0.5).toFixed(1))));const el=document.getElementById('wVal');el.textContent=fmtW(editW);el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');wsApplyLabels();resetApplyTrack();}
function stepR(d){playKnock();editR=Math.max(0,Math.min(100,editR+d));const el=document.getElementById('rVal');el.textContent=editR;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}
function resetApplyTrack(){const t=document.getElementById('applyTrack');const thumb=document.getElementById('applyThumb');if(t) t.classList.remove('applied');if(thumb){thumb.style.transition='transform .3s';thumb.style.transform='translateX(0)';}}
function saveSet(){
  const btn=document.getElementById('saveSetBtn');
  const ex=DAYS[curDay].items[curEx];const set=ex.sets[curSet];
  // v47: editing a value is NOT a claim that you performed the set. Ticking is
  // a separate, deliberate act (tap the circle). Previously every edit silently
  // marked the set as done, with no way to opt out.
  set.w=editW;set.r=editR;
  const _wt=document.getElementById('shWarmTog');
  if(_wt){ if(_wt.classList.contains('on')) set.warmup=true; else delete set.warmup; }
  playSaveSet(ex);
  btn.classList.add('saved');btn.textContent='SAVED';
  ex.rl=ex.rest;ex.rs='idle';
  wsPersistSave();
  renderAll(false);
  setTimeout(()=>{btn.textContent='SAVE SET';btn.classList.remove('saved');closeSheet();renderAll(false);},650);
}
function closeSheet(){document.getElementById('overlay').classList.remove('open');}
function overlayClick(e){if(e.target===document.getElementById('overlay'))closeSheet();}

function bindApplyDrag(){
  if(applyAbort) applyAbort.abort();
  applyAbort=new AbortController();const sig=applyAbort.signal;
  const track=document.getElementById('applyTrack');const thumb=document.getElementById('applyThumb');
  if(!track||!thumb) return;
  let dragging=false,startX=0,curX=0;
  const maxX=()=>track.offsetWidth-thumb.offsetWidth-8;
  const apply=()=>{
    if(track.classList.contains('applied')) return;
    if(track.classList.contains('disabled')) return;
    const ex=DAYS[curDay].items[curEx];
    // v47 - three bugs lived here:
    //   1. `ex.sets.forEach(s=>s.w=editW)` hit EVERY set, including ones already
    //      logged, retroactively rewriting work that was actually performed at a
    //      different weight. That was the weight mangling.
    //   2. no wsPersistSave(), so the change sat in memory only and landed (or
    //      didn't) depending on what the user happened to do next - hence
    //      "sometimes".
    //   3. no re-render, so the rows behind the sheet kept showing stale numbers.
    const targets=wsApplyTargets(ex);
    if(!targets.length){ wsApplyLabels(); return; }
    track.classList.add('applied');
    targets.forEach(s=>{ s.w=editW; });
    const n=targets.length;
    document.getElementById('applyTxt').textContent=`${fmtW(editW)} kg applied to ${n} set${n===1?'':'s'}`;
    thumb.style.transition='transform .35s';thumb.style.transform=`translateX(${maxX()}px)`;
    playSaveSet(ex);
    wsPersistSave();
    renderAll(false);
  };
  const startDrag=x=>{if(track.classList.contains('applied')) return;dragging=true;startX=x-curX;thumb.style.transition='none';};
  const moveDrag=x=>{if(!dragging) return;curX=Math.max(0,Math.min(maxX(),x-startX));thumb.style.transform=`translateX(${curX}px)`;if(curX>=maxX()-6){dragging=false;curX=0;apply();}};
  const endDrag=()=>{if(!dragging) return;dragging=false;if(curX<maxX()-6){thumb.style.transition='transform .25s';thumb.style.transform='translateX(0)';curX=0;}};
  track.addEventListener('mousedown',e=>startDrag(e.clientX),{signal:sig});
  window.addEventListener('mousemove',e=>moveDrag(e.clientX),{signal:sig});
  window.addEventListener('mouseup',endDrag,{signal:sig});
  track.addEventListener('touchstart',e=>{e.preventDefault();startDrag(e.touches[0].clientX);},{signal:sig});
  window.addEventListener('touchmove',e=>moveDrag(e.touches[0].clientX),{signal:sig,passive:true});
  window.addEventListener('touchend',endDrag,{signal:sig});
}

function bindSlide(){
  if(slideAbort){slideAbort.abort();}
  slideAbort=new AbortController();const sig=slideAbort.signal;
  const track=document.getElementById('slideTrack');const thumb=document.getElementById('slideThumb');
  if(!track||!thumb) return;
  if(track.classList.contains('disabled')||track.classList.contains('logged')) return;
  let dragging=false,startX=0,curX=0;
  const maxX=()=>track.offsetWidth-thumb.offsetWidth-18;
  const doLog=()=>{
    if(DAYS[curDay].logged) return;
    DAYS[curDay].logged=true;
    DAYS[curDay]._loggedAt=Date.now(); // for the completed-day TTL (see wsMaybeResetStaleDay)
    // Capture the immutable session record into HISTORY before clearing timers.
    try{
      const rec=captureSessionRecord(curDay);
      if(rec){ HISTORY.push(rec); }
    }catch(e){ if(console&&console.warn) console.warn('Session capture failed:',e&&e.message); }
    Object.keys(restIntervals).forEach(k=>clearInterval(restIntervals[k]));
    Object.keys(hiitIntervals).forEach(k=>clearInterval(hiitIntervals[k]));
    Object.keys(activityIntervals).forEach(k=>clearInterval(activityIntervals[k]));
    restIntervals={};hiitIntervals={};activityIntervals={};
    playSessionLog();
    // Immediate flush, not the debounced save: a logged session is the most
    // valuable write in the app and must not sit in a timer window where a
    // crash or instant tab-kill could drop it.
    wsPersistFlush();
    track.classList.add('logged');thumb.style.transform=`translateX(${maxX()}px)`;
    document.getElementById('slideLbl').textContent='SESSION LOGGED';
    setTimeout(()=>renderAll(false),700);
  };
  const start=x=>{dragging=true;startX=x-curX;thumb.style.transition='none';};
  const move=x=>{if(!dragging) return;curX=Math.max(0,Math.min(maxX(),x-startX));thumb.style.transform=`translateX(${curX}px)`;if(curX>=maxX()-8){dragging=false;doLog();}};
  const end=()=>{if(!dragging) return;dragging=false;if(curX<maxX()-8){thumb.style.transition='transform .3s';thumb.style.transform='translateX(0)';curX=0;}};
  track.addEventListener('mousedown',e=>start(e.clientX),{signal:sig});
  window.addEventListener('mousemove',e=>move(e.clientX),{signal:sig});
  window.addEventListener('mouseup',end,{signal:sig});
  track.addEventListener('touchstart',e=>{e.preventDefault();start(e.touches[0].clientX);},{signal:sig});
  window.addEventListener('touchmove',e=>move(e.touches[0].clientX),{signal:sig,passive:true});
  window.addEventListener('touchend',end,{signal:sig});
}
