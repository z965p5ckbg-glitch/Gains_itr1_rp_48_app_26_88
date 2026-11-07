
/* ════════════════════════════════════════════════════════════════════════════
   v57 — THE WORKOUT SCREEN
   ────────────────────────────────────────────────────────────────────────────
   One scrolling page for the whole session. Each exercise marks its own next
   set; the rest timer starts by itself under the set you just ticked; logging
   opens a summary of what was actually saved. Only function declarations here
   (they hoist across the joined script); no top-level let/const.
   ════════════════════════════════════════════════════════════════════════════ */

// ── sets ─────────────────────────────────────────────────────────────────────
// The next set of an exercise is its first unticked set (ticking out of order
// is allowed; the mark goes back to the earliest gap).
function wsNextSetIdx(ex){
  const sets=(ex&&ex.sets)||[];
  for(let i=0;i<sets.length;i++) if(!sets[i]._logged) return i;
  return -1;
}
// Weight as shown in a row. Bodyweight lifts show the added load (+10) or BW.
function wsSetWText(ex,s){
  const w=Number(s&&s.w)||0;
  if(ex&&ex._bodyweight) return w>0?'+'+fmtSetW(w):'BW';
  return fmtSetW(w);
}
// Remember a set's planned numbers before its first edit, so a later tick can
// tell "still the plan" from "you chose this".
function wsMarkTouched(set){
  if(!set) return;
  if(!set._plan) set._plan={w:set.w,r:set.r};
  set._touched=true;
}
// After ticking set si: later unticked, untouched sets that still hold the same
// planned numbers as set si did take the numbers you actually used. A pyramid
// (different planned numbers per set) is left alone.
function wsCarryForward(ex,si){
  const sets=(ex&&ex.sets)||[]; const done=sets[si]; if(!done) return;
  const plan=done._plan||{w:done.w,r:done.r};
  if(plan.w===done.w && plan.r===done.r) return;          // nothing changed
  for(let j=si+1;j<sets.length;j++){
    const s=sets[j];
    if(s._logged||s._touched||s.warmup) continue;
    if(s.w===plan.w && s.r===plan.r){ s.w=done.w; s.r=done.r; }
  }
}

// ── last time ────────────────────────────────────────────────────────────────
// The most recent logged session that contains this exercise, as one line:
// "LAST 65 × 8·8·8·8 · 13 OCT". Mixed weights are grouped: "60 × 10, 65 × 8·8".
function wsLastPerf(ex){
  try{
    const hist=Array.isArray(HISTORY)?HISTORY:[];
    const key=wsTrendExKey({exId:ex.exId,name:ex.name});
    let best=null, bt=-Infinity;
    for(const rec of hist){
      const t=new Date(rec&&rec.date).getTime(); if(isNaN(t)||t<=bt) continue;
      for(const e of (rec.entries||[])){
        if(e.kind!=='weighted'&&e.kind!=='bodyweight') continue;
        if(wsTrendExKey(e)!==key) continue;
        const sets=(e.sets||[]).filter(s=>s.completed!==false&&!s.warmup);
        if(!sets.length) continue;
        best={e:e,sets:sets,date:rec.date}; bt=t;
      }
    }
    if(!best) return null;
    const bw=best.e.kind==='bodyweight';
    const txt=wsGroupSets(best.sets.map(s=>({w:bw?(s.offsetKg||0):(s.weightKg||0), r:s.reps||0})), bw);
    const d=new Date(best.date);
    const when=d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toUpperCase();
    return {text:'LAST '+txt+' · '+when, sets:best.sets, bw:bw, date:best.date};
  }catch(_){ return null; }
}
function wsGroupSets(list,bw){
  const groups=[];
  for(const s of list){ const g=groups[groups.length-1]; if(g&&g.w===s.w) g.reps.push(s.r); else groups.push({w:s.w,reps:[s.r]}); }
  const wt=w=>bw?(w>0?'+'+fmtSetW(w):'BW'):fmtSetW(w);
  return groups.map(g=>wt(g.w)+' × '+g.reps.join('·')).join(', ');
}

// ── session progress, top of the list ─────────────────────────────────────────
// v58: the set counter is the most prominent thing here (ember, large), and the
// time reads as what it is: time since your first ticked set, with the clock
// time you started. It ticks on its own (wsElapsedTick), not only on redraw.
function wsWorkoutProgressHtml(d){
  let done=0,total=0;
  for(const ex of (d.items||[])){
    const k=ex._itemKind||wsTagItemKind(ex);
    if(k!=='weighted') continue;
    for(const s of (ex.sets||[])){ total++; if(s._logged) done++; }
  }
  if(!total) return '';
  const pct=Math.round(done/total*100);
  return `<div class="fk-prog">
    <div class="fk-prog-row">
      <span class="fk-prog-time" id="fkElapsed">${wsElapsedText(d)}</span>
      <span class="fk-prog-count" aria-label="${done} of ${total} sets done"><b>${done}</b><i>/${total}</i><em>SETS</em></span>
    </div>
    <div class="fk-prog-bar"><span style="width:${pct}%"></span></div>
  </div>`;
}
function wsElapsedText(d){
  if(d.logged) return 'SESSION LOGGED';
  if(!d._startedAt) return 'NOT STARTED · TICK A SET TO BEGIN';
  const st=new Date(d._startedAt);
  const hh=String(st.getHours()).padStart(2,'0'), mm=String(st.getMinutes()).padStart(2,'0');
  const mins=Math.max(0,Math.floor((Date.now()-d._startedAt)/60000));
  const dur=mins<60?mins+' MIN':Math.floor(mins/60)+' H '+String(mins%60).padStart(2,'0')+' MIN';
  return 'STARTED '+hh+':'+mm+' · '+dur+' IN';
}
function wsElapsedTick(){
  try{
    const el=document.getElementById('fkElapsed'); if(!el) return;
    const d=DAYS[curDay]; if(d) el.textContent=wsElapsedText(d);
  }catch(_){}
}

// ── supersets ────────────────────────────────────────────────────────────────
// ex.ss = true means "paired with the next exercise". A chain of ss flags makes
// a superset (two) or giant set (three or more). Stored on the workout's item,
// so the pairing stands every time you do that workout. No migration: absent
// means not paired.
function wsSsGroups(items){
  const out=new Array(items.length).fill(null); let letter=0;
  for(let i=0;i<items.length;i++){
    const k=items[i]._itemKind||wsTagItemKind(items[i]);
    if(k!=='weighted'||out[i]) continue;
    if(!items[i].ss) continue;
    let j=i; const members=[i];
    while(items[j] && items[j].ss && items[j+1] && (items[j+1]._itemKind||wsTagItemKind(items[j+1]))==='weighted'){ j++; members.push(j); }
    if(members.length<2) continue;
    const L=String.fromCharCode(65+letter++);
    members.forEach((m,pos)=>{ out[m]={letter:L,pos:pos+1,size:members.length,first:members[0],last:members[members.length-1]}; });
  }
  return out;
}
function wsSsInfo(ei){ const items=(DAYS[curDay]&&DAYS[curDay].items)||[]; return wsSsGroups(items)[ei]; }
function wsTogglePair(ei){
  const d=DAYS[curDay]; const ex=d&&d.items&&d.items[ei]; if(!ex) return;
  ex.ss=!ex.ss; if(!ex.ss) delete ex.ss;
  wsPersistSave(); renderAll(false);
}
// After ticking a set in a superset: if a partner still has sets, the round is
// not over, so no rest. The partner to go to next is the next member (wrapping)
// that still has a set left.
function wsSsPartnerNext(ei){
  const g=wsSsInfo(ei); if(!g) return -1;
  const items=DAYS[curDay].items;
  for(let step=1;step<g.size;step++){
    const m=g.first+((ei-g.first+step)%g.size);
    if(wsNextSetIdx(items[m])>=0) return m;
  }
  return -1;
}
function wsSsRoundOpen(ei){
  // the round stays open while a LATER member of the group still has a set at
  // the same depth as the set just done
  const g=wsSsInfo(ei); if(!g||ei===g.last) return false;
  const items=DAYS[curDay].items;
  const done=(items[ei].sets||[]).filter(s=>s._logged).length;
  for(let m=ei+1;m<=g.last;m++){ const n=(items[m].sets||[]).filter(s=>s._logged).length; if(n<done && wsNextSetIdx(items[m])>=0) return true; }
  return false;
}

// ── rest timer ───────────────────────────────────────────────────────────────
// State lives on the exercise: ex.rs ('idle'|'running'|'paused'|'ready'),
// ex.rl (seconds left), ex.rest (length), ex._restRow (the set it follows),
// ex._restEnd (wall-clock end while running, so a phone that sleeps or reloads
// mid-rest shows the right time when it wakes).
// One rule for every change: the rest is a LENGTH you are partway through.
// Changing the length (±15 or the slider) moves "time left" by the same amount.
// Both numbers are always on screen ("1:20 left · of 1:45"), so they can't
// look like they disagree.
// v58: rest starts by itself only when settings.restAuto is on (off by
// default). Otherwise ticking a set puts a ready-to-start timer under it.
function wsRestAuto(){ try{ return !!settings.restAuto; }catch(_){ return false; } }
function wsSetRestAuto(on){
  try{ settings.restAuto=!!on; wsPersistSave(); }catch(_){}
  const t1=document.getElementById('togRestAuto'); if(t1) t1.classList.toggle('on',!!on);
  const t2=document.getElementById('fkrAutoTog'); if(t2) t2.classList.toggle('on',!!on);
}
function wsRestBegin(ei,si){
  const d=DAYS[curDay]; const ex=(d.items||[])[ei]; if(!ex) return;
  (d.items||[]).forEach((o,oi)=>{ if(oi!==ei && (o._itemKind||wsTagItemKind(o))==='weighted' && o._restRow!=null) wsRestStop(oi,true); });
  if(restIntervals[ei]) clearInterval(restIntervals[ei]);
  const len=Math.max(0,Number(ex.rest)||0);
  // mid-superset: the round isn't over, go straight to the partner
  if(!len || wsSsRoundOpen(ei)){ wsRestStop(ei,true); return; }
  ex._restRow=si; ex.rl=len;
  if(wsRestAuto()){ ex.rs='running'; ex._restEnd=Date.now()+len*1000; try{ acquireWakeLockIfActive(); }catch(_){} }
  else { ex.rs='idle'; delete ex._restEnd; }
}
function wsRestStop(ei,quiet){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  if(restIntervals[ei]){ clearInterval(restIntervals[ei]); delete restIntervals[ei]; }
  delete ex._restRow; delete ex._restEnd; ex.rs='idle'; ex.rl=ex.rest;
  try{ maybeReleaseWakeLock(); }catch(_){}
  if(!quiet){ wsRestDockUpdate(); }
}
// Start, pause, resume: one button.
function wsRestToggle(ei){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  if(ex.rs==='running'){
    ex.rl=wsRestLeft(ex); ex.rs='paused'; delete ex._restEnd;
    if(restIntervals[ei]){ clearInterval(restIntervals[ei]); delete restIntervals[ei]; }
    try{ maybeReleaseWakeLock(); }catch(_){}
  } else if(ex.rs==='paused'||ex.rs==='idle'){
    if(ex.rs==='idle') ex.rl=Math.max(1,Number(ex.rest)||1);
    ex.rs='running'; ex._restEnd=Date.now()+Math.max(1,ex.rl)*1000;
    try{ acquireWakeLockIfActive(); }catch(_){}
  }
  renderAll(false); wsPersistSave();     // re-render swaps the button; running rests restart
}
function wsRestSkip(ei){ wsRestStop(ei); renderAll(false); wsPersistSave(); }
function wsRestLeft(ex){
  if(ex.rs==='running' && typeof ex._restEnd==='number') return Math.max(0,Math.ceil((ex._restEnd-Date.now())/1000));
  return Math.max(0,Number(ex.rl)||0);
}
// Change the length to `len`; time left moves by the same amount.
function wsRestSetLength(ex,len){
  len=Math.max(15,Math.min(900,Math.round(len)));
  const old=Math.max(1,Number(ex.rest)||1);
  const left=wsRestLeft(ex);
  const elapsed=Math.max(0,old-left);
  ex.rest=len;
  if(ex.rs==='running'){ const l=Math.max(1,len-elapsed); ex._restEnd=Date.now()+l*1000; ex.rl=l; }
  else if(ex.rs==='paused'){ ex.rl=Math.max(1,len-elapsed); }
  else ex.rl=len;
}
function wsRestNudge(ei,delta){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  try{ playKnock(); }catch(_){}
  wsRestSetLength(ex,(Number(ex.rest)||0)+delta);
  wsRestRefresh(ei); wsPersistSave();
}
function wsRestSound(ei){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  ex.sound=ex.sound===false?true:false;
  wsPersistSave(); renderAll(false);
}
// Collapsed or full is a standing preference, not per exercise.
function wsRestSetMini(on){
  try{ settings._restMini=!!on; wsPersistSave(); }catch(_){}
  renderAll(false);
}
function wsRestIsMini(){ try{ return !!(settings&&settings._restMini); }catch(_){ return false; } }

// What comes after this rest: the superset partner, this exercise's next set,
// or the next exercise with sets left.
function wsRestNextText(ei){
  const items=DAYS[curDay].items||[];
  const p=wsSsPartnerNext(ei);
  const order=(p>=0?[p]:[]).concat([ei], items.map((_,i)=>i).filter(i=>i>ei), items.map((_,i)=>i).filter(i=>i<ei));
  for(const i of order){
    const ex=items[i]; if((ex._itemKind||wsTagItemKind(ex))!=='weighted') continue;
    const n=wsNextSetIdx(ex); if(n<0) continue;
    const s=ex.sets[n];
    return 'Next: '+wsExDisplayParts(ex).title+' · '+wsSetWText(ex,s)+' × '+s.r;
  }
  return 'All sets done · slide to log';
}
function wsRestMainText(ex){
  if(ex.rs==='ready') return 'REST OVER';
  if(ex.rs==='idle') return 'REST '+fmtMS(Number(ex.rest)||0);
  return fmtMS(wsRestLeft(ex));
}
function wsRestSubText(ex){
  if(ex.rs==='idle') return 'Tap ▶ to start';
  if(ex.rs==='ready') return 'Rest of '+fmtMS(Number(ex.rest)||0)+' is over';
  return (ex.rs==='paused'?'Paused · ':'Left · ')+'of '+fmtMS(Number(ex.rest)||0);
}
function wsRestPct(ex){
  const len=Math.max(1,Number(ex.rest)||1);
  if(ex.rs==='ready') return 100;
  if(ex.rs==='idle') return 0;
  return Math.max(0,Math.min(100,Math.round((1-wsRestLeft(ex)/len)*100)));
}
function wsRestPlayIcon(ex){
  return ex.rs==='running'
    ?'<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" class="fkr-fillsvg"/><rect x="14" y="4" width="4" height="16" rx="1" class="fkr-fillsvg"/></svg>'
    :'<svg viewBox="0 0 24 24"><polygon points="7 4 20 12 7 20" class="fkr-fillsvg"/></svg>';
}
function wsRestInline(ex,ei){
  const next=wsEscape(wsRestNextText(ei));
  const pct=wsRestPct(ex);
  const st=ex.rs;
  const playLbl=st==='running'?'Pause rest':(st==='paused'?'Resume rest':'Start rest');
  if(st==='ready'){
    return `<div class="fkr fkr-mini ready" id="fkr${ei}" data-state="ready">
      <button class="fkr-mini-main" onclick="wsRestSkip(${ei})" aria-label="Dismiss">
        <span class="fkr-bar" style="width:100%"></span>
        <span class="fkr-t">REST OVER</span><span class="fkr-next">${next}</span><span class="fkr-x">✕</span>
      </button></div>`;
  }
  if(wsRestIsMini()){
    return `<div class="fkr fkr-mini" id="fkr${ei}" data-state="${st}">
      <button class="fkr-mini-play" onclick="wsRestToggle(${ei})" aria-label="${playLbl}">${wsRestPlayIcon(ex)}</button>
      <button class="fkr-mini-main" onclick="wsRestSetMini(false)" aria-label="Show the full timer">
        <span class="fkr-bar" id="fkrbar${ei}" style="width:${pct}%"></span>
        <span class="fkr-t" id="fkrt${ei}">${wsRestMainText(ex)}</span>
        <span class="fkr-next">${st==='idle'?'Ready':next}</span>
        <svg class="fkr-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button></div>`;
  }
  const snd=exSnd(ex,'timer');
  return `<div class="fkr" id="fkr${ei}" data-state="${st}">
    <span class="fkr-fill" id="fkrbar${ei}" style="width:${pct}%"></span>
    <div class="fkr-top">
      <button class="fkr-time" onclick="wsRestEdit(${ei})" aria-label="Change rest length">
        <span class="fkr-t" id="fkrt${ei}">${wsRestMainText(ex)}</span>
        <span class="fkr-sub" id="fkrs${ei}">${wsRestSubText(ex)}</span>
      </button>
      <button class="fkr-icon${snd?'':' off'}" onclick="wsRestSound(${ei})" aria-label="${snd?'Sound on — tap to mute':'Muted — tap for sound'}">${snd
        ?'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>'
        :'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>'}</button>
      <button class="fkr-icon" onclick="wsRestSetMini(true)" aria-label="Make the timer smaller"><svg viewBox="0 0 24 24"><polyline points="6 15 12 9 18 15"/></svg></button>
    </div>
    <div class="fkr-ctrls">
      <button class="fkr-btn" onclick="wsRestNudge(${ei},-15)" aria-label="15 seconds less">−15</button>
      <button class="fkr-btn fkr-play" onclick="wsRestToggle(${ei})" aria-label="${playLbl}">${wsRestPlayIcon(ex)}</button>
      <button class="fkr-btn" onclick="wsRestNudge(${ei},15)" aria-label="15 seconds more">+15</button>
      <button class="fkr-btn fkr-skip" onclick="wsRestSkip(${ei})">Skip</button>
    </div>
    <div class="fkr-next fkr-next-line">${next}</div>
  </div>`;
}
// Per-second update without re-rendering the page.
function wsRestRefresh(ei){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  const t=document.getElementById('fkrt'+ei), b=document.getElementById('fkrbar'+ei), s=document.getElementById('fkrs'+ei);
  if(t) t.textContent=wsRestMainText(ex);
  if(s) s.textContent=wsRestSubText(ex);
  if(b) b.style.width=wsRestPct(ex)+'%';
  const live=document.getElementById('fkrSheetLeft'); if(live) live.textContent=wsRestSheetLeftText(ex);
  wsRestDockUpdate();
}

// ── edit sheet: one slider for the length ────────────────────────────────────
function wsRestSheetLeftText(ex){
  if(ex.rs==='running') return 'This rest: '+fmtMS(wsRestLeft(ex))+' left';
  if(ex.rs==='paused') return 'This rest: '+fmtMS(wsRestLeft(ex))+' left, paused';
  return 'Not running';
}
function wsRestEdit(ei){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  wsRestEditClose(true);
  const max=Math.max(300,Number(ex.rest)||0);
  const ov=document.createElement('div');
  ov.className='fkr-ov open'; ov.id='fkrSheet';
  ov.onclick=e=>{ if(e.target===ov) wsRestEditClose(); };
  ov.innerHTML=`<div class="sheet fkr-sheet">
    <div class="sh-handle"></div>
    <div class="fkr-sh-k">REST LENGTH · ${wsEscape(wsExDisplayParts(ex).title).toUpperCase()}</div>
    <div class="fkr-sh-v" id="fkrSheetV">${fmtMS(ex.rest)}</div>
    <div class="fkr-sh-left" id="fkrSheetLeft">${wsRestSheetLeftText(ex)}</div>
    <input class="fkr-range" id="fkrRange" type="range" min="15" max="${max}" step="15" value="${ex.rest}" aria-label="Rest length" oninput="wsRestEditInput(${ei},this.value)">
    <div class="fkr-sh-scale"><span>0:15</span><span>${fmtMS(Math.round(max/2/15)*15)}</span><span>${fmtMS(max)}</span></div>
    <div class="fkr-sh-note">Applies to this rest and the next ones for this exercise. If a rest is running, the time left moves by the same amount.</div>
    <button class="fkr-sh-row" aria-label="Start rest automatically after each set" onclick="wsSetRestAuto(!wsRestAuto())"><span>Start rest automatically after each set</span><span class="tog${wsRestAuto()?' on':''}" id="fkrAutoTog"></span></button>
    <button class="fkr-sh-done" onclick="wsRestEditClose()">Done</button>
  </div>`;
  document.getElementById('app').appendChild(ov);
}
function wsRestEditInput(ei,v){
  const ex=(DAYS[curDay].items||[])[ei]; if(!ex) return;
  wsRestSetLength(ex,Number(v));
  const out=document.getElementById('fkrSheetV'); if(out) out.textContent=fmtMS(ex.rest);
  wsRestRefresh(ei);
}
function wsRestEditClose(silent){
  const ov=document.getElementById('fkrSheet');
  if(ov){ ov.remove(); if(!silent){ wsPersistSave(); renderAll(false); } }
}

// ── docked timer: follows you while the running rest is scrolled away ─────────
// Slides up from the tab bar when the rest leaves the screen; when the rest
// scrolls back into view it glides to its place in the list and fades; when
// paused, skipped or over it slides away. Transform and opacity only, 260 ms,
// no bounce; instant with Reduce Motion.
function wsRestActiveIdx(){
  const items=(DAYS[curDay]&&DAYS[curDay].items)||[];
  for(let i=0;i<items.length;i++){ const ex=items[i]; if(ex._restRow!=null && ex.rs==='running') return i; }
  return -1;
}
function wsRestAnyIdx(){
  const items=(DAYS[curDay]&&DAYS[curDay].items)||[];
  for(let i=0;i<items.length;i++){ const ex=items[i]; if(ex._restRow!=null && ex.rs!=='idle') return i; }
  return -1;
}
function wsRestDockUpdate(){
  try{
    const app=document.getElementById('app'), sc=document.getElementById('scroll');
    let dock=document.getElementById('fkrDock');
    const onToday=sc && sc.offsetParent!==null && !(DAYS[curDay]&&DAYS[curDay].logged);
    if(sc) sc.classList.toggle('fk-resting', wsRestAnyIdx()>=0 && !!onToday);
    const ei=wsRestActiveIdx();
    let show=false, row=null, rowVisible=false;
    if(ei>=0 && onToday){
      row=document.getElementById('fkr'+ei);
      if(row){
        const a=sc.getBoundingClientRect(), b=row.getBoundingClientRect();
        rowVisible = !(b.bottom < a.top+8 || b.top > a.bottom-8);
        show=!rowVisible;
      }
    }
    if(!dock){
      if(!show) return;
      dock=document.createElement('button'); dock.id='fkrDock'; dock.className='fkr-dock';
      dock.setAttribute('aria-label','Rest timer — tap to go back to it');
      dock.onclick=()=>{ const i=wsRestActiveIdx(); const r=document.getElementById('fkr'+i); if(r) r.scrollIntoView({behavior:wsReduceMotion()?'auto':'smooth',block:'center'}); };
      app.appendChild(dock);
    }
    const nav=document.getElementById('nav');
    dock.style.bottom=((nav?nav.offsetHeight:70)+10)+'px';
    if(show){
      const ex=DAYS[curDay].items[ei];
      dock.innerHTML=`<span class="fkr-bar" style="width:${wsRestPct(ex)}%"></span><span class="fkr-t">${fmtMS(wsRestLeft(ex))}</span><span class="fkr-next">${wsEscape(wsExDisplayParts(ex).title)} · tap to go back</span>`;
      if(!dock.classList.contains('on')){ dock.style.transform=''; dock.classList.add('on'); }
      return;
    }
    if(!dock.classList.contains('on')) return;
    // leaving: glide toward the timer's place in the list if it is on screen,
    // otherwise slide back down behind the tab bar
    if(rowVisible && row && !wsReduceMotion()){
      const dr=dock.getBoundingClientRect(), rr=row.getBoundingClientRect();
      dock.style.transform='translateY('+Math.round(rr.top-dr.top)+'px)';
    } else dock.style.transform='';
    dock.classList.remove('on');
  }catch(_){}
}
function wsReduceMotion(){ try{ return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; } }
function wsRestDockBind(){
  const sc=document.getElementById('scroll');
  if(!sc || sc._fkrBound) return;
  sc._fkrBound=true;
  let pending=false;
  sc.addEventListener('scroll',()=>{ if(pending) return; pending=true; requestAnimationFrame(()=>{ pending=false; wsRestDockUpdate(); }); },{passive:true});
  if(!window._fkElapsedTimer) window._fkElapsedTimer=setInterval(wsElapsedTick,15000);
}

// ── weight step per exercise ─────────────────────────────────────────────────
// How much one tap of + or − changes the weight. Chosen per exercise (it
// follows that exercise into every workout), with a default from the
// equipment: a barbell moves by the smallest plate pair, a dumbbell rack by its
// usual gap, added bodyweight load by the smallest plate.
function wsWStepDefault(ex){
  const s=((ex&&(ex.exId||''))+' '+((ex&&ex.name)||'')).toLowerCase();
  if(ex&&ex._bodyweight) return 1.25;
  if(/dumbbell|kettlebell|\bdb\b/.test(s)) return 2;
  if(/barbell|smith|trap bar|trap-bar|hex bar|ez[- ]bar|landmine|machine|cable|pulldown|leg press|sled/.test(s)) return 2.5;
  return 1;
}
function wsWStep(ex){
  try{
    const k=wsTrendExKey({exId:ex.exId,name:ex.name});
    const v=settings.wSteps&&settings.wSteps[k];
    if(v>0) return v;
  }catch(_){}
  return wsWStepDefault(ex);
}
function wsSetWStep(ex,v){
  try{
    if(!settings.wSteps) settings.wSteps={};
    settings.wSteps[wsTrendExKey({exId:ex.exId,name:ex.name})]=v;
    wsPersistSave();
  }catch(_){}
}
function wsRoundTo(v,step){ return Math.round(Math.round(v/step)*step*100)/100; }

// ── the set sheet's sliders (tap a value to open it) ─────────────────────────
function wsEditSlidersInit(){
  try{
    const ex=DAYS[curDay].items[curEx]; if(!ex) return;
    const step=wsWStep(ex);
    const wr=document.getElementById('wRange'), rr=document.getElementById('rRange');
    if(wr){
      const lo=Math.max(0,wsRoundTo(Math.min(editW*0.5,editW-10*step),step));
      const hi=wsRoundTo(Math.max(editW*1.5,editW+10*step,20),step);
      wr.min=lo; wr.max=hi; wr.step=step; wr.value=editW;
    }
    if(rr){ rr.min=1; rr.max=Math.max(30,editR); rr.step=1; rr.value=editR; }
    const chips=document.getElementById('wStepChips');
    if(chips) chips.innerHTML=[0.5,1,1.25,2,2.5,5].map(v=>`<button class="fk-stepchip${v===step?' on':''}" onclick="wsEditPickStep(${v})" aria-label="Weight step ${v} kilograms">${v}</button>`).join('');
  }catch(_){}
}
function wsEditPickStep(v){
  const ex=DAYS[curDay].items[curEx]; if(!ex) return;
  try{ playKnock(); }catch(_){}
  wsSetWStep(ex,v);
  wsEditSlidersInit();
}
function wsEditSlideW(v){
  editW=Math.max(0,parseFloat(Number(v).toFixed(2)));
  const el=document.getElementById('wVal'); if(el) el.textContent=fmtW(editW);
  try{ wsApplyLabels(); resetApplyTrack(); }catch(_){}
}
function wsEditSlideR(v){
  editR=Math.max(1,Math.round(Number(v)));
  const el=document.getElementById('rVal'); if(el) el.textContent=editR;
}

// ── after logging: what was saved ─────────────────────────────────────────────
// Built from the saved record itself, so the summary can never disagree with
// History. Each exercise is compared with the last time you did it; a record is
// a best estimated 1RM (Epley, sets of 10 reps or fewer, as everywhere in the
// app) above every earlier session. Added-weight bodyweight lifts never claim a
// record: without bodyweight there is no honest 1RM.
function wsFinishSummary(rec,dayIdx){
  const hist=(Array.isArray(HISTORY)?HISTORY:[]).filter(r=>r&&r.id!==rec.id);
  const t=new Date(rec.date).getTime();
  const rows=[]; let sets=0, recs=0;
  for(const e of (rec.entries||[])){
    if(e.kind==='weighted'||e.kind==='bodyweight'){
      const bw=e.kind==='bodyweight';
      const now=(e.sets||[]).filter(s=>s.completed!==false);
      const work=now.filter(s=>!s.warmup);
      sets+=work.length;
      const key=wsTrendExKey(e);
      let last=null, lt=-Infinity, bestBefore=0;
      for(const r of hist){
        const rt=new Date(r.date).getTime(); if(isNaN(rt)||rt>=t) continue;
        for(const pe of (r.entries||[])){
          if((pe.kind!=='weighted'&&pe.kind!=='bodyweight')||wsTrendExKey(pe)!==key) continue;
          const ps=(pe.sets||[]).filter(s=>s.completed!==false&&!s.warmup);
          if(!ps.length) continue;
          if(!bw) for(const s of ps){ const v=wsEpley(s.weightKg,s.reps); if(v&&v>bestBefore) bestBefore=v; }
          if(rt>lt){ lt=rt; last=ps; }
        }
      }
      const W=s=>bw?(s.offsetKg||0):(s.weightKg||0);
      const nowTxt=wsGroupSets(work.map(s=>({w:W(s),r:s.reps||0})),bw);
      let tag='FIRST TIME', cls='new', wasTxt='';
      if(last){
        wasTxt=wsGroupSets(last.map(s=>({w:W(s),r:s.reps||0})),bw);
        let bestNow=0; if(!bw) for(const s of work){ const v=wsEpley(s.weightKg,s.reps); if(v&&v>bestNow) bestNow=v; }
        const topNow=Math.max.apply(null,work.map(W).concat([0])), topThen=Math.max.apply(null,last.map(W).concat([0]));
        if(!bw && bestBefore>0 && bestNow>bestBefore+0.01){ tag='RECORD'; cls='rec'; recs++; }
        else if(topNow>topThen) { tag='HEAVIER'; cls='up'; }
        else if(topNow<topThen) { tag='LIGHTER'; cls='flat'; }
        else {
          const n=Math.min(work.length,last.length); let diff=0;
          for(let i=0;i<n;i++) diff+=(work[i].reps||0)-(last[i].reps||0);
          if(work.length<last.length && diff<=0){ tag=work.length+' OF '+last.length+' SETS'; cls='flat'; }
          else if(diff>0){ tag='+'+diff+(diff===1?' REP':' REPS'); cls='up'; }
          else if(diff<0){ tag='−'+(-diff)+(diff===-1?' REP':' REPS'); cls='flat'; }
          else { tag='HELD'; cls='flat'; }
        }
      }
      rows.push({name:e.name, was:wasTxt, now:nowTxt, tag:tag, cls:cls});
    } else if(e.kind==='cardio'){
      const c=e.cardio||{};
      rows.push({name:e.name, was:'', now:(c.durationSec?hiFmtMS(c.durationSec):'')+(c.distanceM?' · '+(c.distanceM/1000).toFixed(2)+' km':''), tag:'CARDIO', cls:'cardio'});
    } else if(e.kind==='hiit'){
      const h=e.hiit||{};
      rows.push({name:e.name, was:'', now:(h.roundsDone||0)+' rounds'+(h.workSecTotal?' · '+hiFmtMS(h.workSecTotal)+' work':''), tag:'INTERVALS', cls:'cardio'});
    }
  }
  // what was on the day but not done, so not saved
  const saved=new Set((rec.entries||[]).map(e=>e.iid||e.name));
  const skipped=[];
  const d=DAYS[dayIdx];
  for(const ex of ((d&&d.items)||[])) if(!saved.has(ex._iid||ex.name) && !saved.has(ex.name)) skipped.push(wsExDisplayParts(ex).title);
  return {rows, sets, recs, exCount:(rec.entries||[]).length, skipped};
}
function wsFinishOpen(id,dayIdx){
  const rec=(HISTORY||[]).find(r=>r&&r.id===id); if(!rec) return;
  wsFinishClose(true);
  const ov=document.createElement('div');
  ov.id='fkFinish'; ov.className='fkf';
  ov.dataset.id=id; ov.dataset.day=dayIdx;
  ov._undoUntil=Date.now()+10000;
  document.getElementById('app').appendChild(ov);
  wsFinishRender();
  ov._undoTimer=setInterval(()=>{
    const el=document.getElementById('fkUndo'); if(!el){ clearInterval(ov._undoTimer); return; }
    const left=Math.ceil((ov._undoUntil-Date.now())/1000);
    if(left<=0){ el.remove(); clearInterval(ov._undoTimer); } else el.textContent='Undo · '+left+'s';
  },500);
}
function wsFinishRender(){
  const ov=document.getElementById('fkFinish'); if(!ov) return;
  const rec=(HISTORY||[]).find(r=>r&&r.id===ov.dataset.id); if(!rec){ wsFinishClose(); return; }
  const dayIdx=+ov.dataset.day;
  const S=wsFinishSummary(rec,dayIdx);
  const d=DAYS[dayIdx]||{};
  const mins=d._startedAt?Math.max(1,Math.round((new Date(rec.date).getTime()-d._startedAt)/60000)):null;
  const when=new Date(rec.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();
  const se=wsSessionEffort(rec);
  const cur=se?se.value:null;
  let chips=''; for(let n=1;n<=10;n++) chips+=`<button class="fkf-chip${cur!=null&&Math.round(cur)===n?' on':''}" onclick="wsFinishEffort(${n})">${n}</button>`;
  const undoLeft=Math.ceil(((ov._undoUntil||0)-Date.now())/1000);
  ov.innerHTML=`<div class="fkf-scroll">
    <div class="fkf-k">LOGGED · ${when}${mins?' · '+mins+' MIN':''}</div>
    <div class="fkf-title">${wsEscape(rec.dayLabel||'Session')}</div>
    <div class="fkf-stats">
      <div><b>${S.sets}</b><span>${S.sets===1?'SET':'SETS'}</span></div>
      <div><b>${S.exCount}</b><span>${S.exCount===1?'EXERCISE':'EXERCISES'}</span></div>
      <div><b class="${S.recs?'rec':''}">${S.recs}</b><span>${S.recs===1?'RECORD':'RECORDS'}</span></div>
    </div>
    <div class="fkf-h"><span>AGAINST LAST TIME</span><i></i></div>
    ${S.rows.map(r=>`<div class="fkf-row ${r.cls}">
      <span class="fkf-dot"></span>
      <div class="fkf-mid"><div class="fkf-n">${wsEscape(r.name)}</div><div class="fkf-v">${r.was?wsEscape(r.was)+' → ':''}<em>${wsEscape(r.now)}</em></div></div>
      <span class="fkf-tag">${r.tag}</span>
    </div>`).join('')}
    ${S.skipped.length?`<div class="fkf-skip">Not done, so not saved: ${S.skipped.map(wsEscape).join(', ')}</div>`:''}
    <div class="fkf-h"><span>HOW HARD WAS THE SESSION?</span><i></i><span class="fkf-opt">OPTIONAL</span></div>
    <div class="fkf-chips">${chips}</div>
    <div class="fkf-note">1 easy, 10 all-out. One rating for the whole session; skip it and it stays blank.</div>
  </div>
  <div class="fkf-foot">
    ${undoLeft>0?`<button class="fkf-undo" id="fkUndo" onclick="wsFinishUndo()">Undo · ${undoLeft}s</button>`:''}
    <button class="fkf-done" onclick="wsFinishClose()">Done</button>
  </div>`;
}
function wsFinishEffort(n){
  const ov=document.getElementById('fkFinish'); if(!ov) return;
  try{ playKnock(); }catch(_){}
  const rec=(HISTORY||[]).find(r=>r&&r.id===ov.dataset.id);
  const se=rec?wsSessionEffort(rec):null;
  wsSetSessionEffort(ov.dataset.id, (se&&se.source==='rated'&&Math.round(se.value)===n)?null:n);
  wsFinishRender();
}
function wsFinishClose(silent){
  const ov=document.getElementById('fkFinish');
  if(ov){ if(ov._undoTimer) clearInterval(ov._undoTimer); ov.remove(); }
  if(!silent){ try{ renderAll(false); }catch(_){} }
}
// Undo, within 10 seconds: take the record back out of History and unlock the
// day. Every tick is still there, so logging again saves the same thing.
function wsFinishUndo(){
  const ov=document.getElementById('fkFinish'); if(!ov) return;
  const id=ov.dataset.id, dayIdx=+ov.dataset.day;
  const i=(HISTORY||[]).findIndex(r=>r&&r.id===id);
  if(i>=0) HISTORY.splice(i,1);
  const d=DAYS[dayIdx]; if(d){ d.logged=false; delete d._loggedAt; }
  try{ wsPersistFlush(); }catch(_){}
  wsFinishClose(true);
  renderAll(false);
  try{ wsToastMsg('Not logged — your sets are still ticked'); }catch(_){}
}
