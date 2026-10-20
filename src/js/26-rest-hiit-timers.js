
// Configure the SVG rect to size match its container after render.
function syncHiitPerimeters(){
  document.querySelectorAll('.phase-perimeter').forEach(svg=>{
    const rect=svg.querySelector('rect');
    if(!rect) return;
    const w=svg.clientWidth, h=svg.clientHeight;
    if(!w||!h) return;
    const W=w-1.5, H=h-1.5, r=Math.min(13,W/2,H/2);
    rect.setAttribute('width',W);
    rect.setAttribute('height',H);
    rect.setAttribute('rx',r);rect.setAttribute('ry',r);
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    // Geometric perimeter length — computed, never measured, never pathLength.
    const L=2*(W+H)-8*r+2*Math.PI*r;
    rect.dataset.len=L;
    rect.setAttribute('stroke-dasharray',L);
    const p=parseFloat(rect.dataset.initpct);
    if(!isNaN(p)) rect.setAttribute('stroke-dashoffset',p*L);
  });
}

function calcPace(seconds,km){
  if(!km) return 'auto';
  const pace=seconds/km;
  const m=Math.floor(pace/60);const s=Math.floor(pace%60);
  return `${m}:${s<10?'0':''}${s}`;
}
function fmtMS(s){const m=Math.floor(s/60),sec=s%60;return m+':'+(sec<10?'0':'')+sec;}

function renderRestSection(ex,ei,phase){
  if(!ex.rv){
    const dur=ex.duration||ex.rest;
    const lbl=phase==='cardio-time'?'Workout timer':'Rest timer';
    return `<div class="rest-section"><div class="rest-collapsed-row">
      <span class="rest-collapsed-lbl">${lbl} · ${fmtMS(dur)}</span>
      <button class="rest-show-btn" onclick="toggleRestVis(${ei})">Show</button>
    </div></div>`;
  }
  const dur=ex.duration||ex.rest;
  const left=ex.rl;
  const pct=left/dur;
  const off=182*pct;
  const isReady=ex.rs==='ready';
  const isPaused=ex.rs==='paused';
  const isIdle=ex.rs==='idle';
  const isRunning=ex.rs==='running';
  let badgeCls='rest-badge';
  if(isReady) badgeCls+=' ready';
  else if(isPaused) badgeCls+=' paused';
  else if(isIdle) badgeCls+=' idle';
  else if(isRunning) badgeCls+=' running';
  // I1: strength rest gets its own sage-tinted classes — rest is rest, not work
  const isStrength=phase==='strength';
  if(isStrength&&isRunning) badgeCls+=' strength-running';
  let wordHtml=phase==='cardio-time'?'Timer':'Rest', countText=fmtMS(left), countSize='21px';
  if(isIdle){wordHtml='Tap';countText='Start';countSize='15px';}
  else if(isRunning){wordHtml=`<svg viewBox="0 0 9 11"><line x1="3" y1="2" x2="3" y2="9"/><line x1="6" y1="2" x2="6" y2="9"/></svg>`;}
  else if(isPaused){wordHtml='Paused';}
  else if(isReady){wordHtml='Done';countText='Restart';countSize='15px';}
  let rightHint='';
  if(isPaused) rightHint='Tap to resume';
  const labelText=phase==='cardio-time'?'Workout timer':'Rest timer';

  return `<div class="rest-section">
    <div class="rest-body${phase==='cardio-time'?' cardio-time':''}${isStrength?' strength-rest':''}">
      <div class="rest-top-row">
        <div class="${badgeCls}" id="rb${ei}" onclick="badgeTap(${ei})">
          <svg class="r-arc" viewBox="0 0 68 68"><circle class="rbg" cx="34" cy="34" r="29"/><circle class="rarc" id="rarc${ei}" cx="34" cy="34" r="29" style="stroke-dashoffset:${isIdle||isReady?0:off}"/></svg>
          <div class="rbadge-inner"><span class="rword">${wordHtml}</span><span class="rcount" style="font-size:${countSize}">${countText}</span></div>
        </div>
        <div class="rest-bar-wrap">
          <div class="rbar"><div class="rfill${isReady?' ready':''}${isIdle?' idle':''}${isStrength&&isRunning?' strength-running':''}" id="rfill${ei}" style="width:${(1-pct)*100}%"></div></div>
          <div class="rest-bar-meta">
            <span class="rest-bar-hint">${labelText} · ${fmtMS(dur)}</span>
            ${rightHint?`<span class="rest-bar-hint action">${rightHint}</span>`:''}
          </div>
        </div>
      </div>
      <div class="rest-controls-row">
        <div class="rctrl flex${exSnd(ex,'timer')?' active':''}" onclick="toggleExSound(${ei})"><svg viewBox="0 0 13 13"><path d="M1 4.5h2l3-3v10L3 8.5H1V4.5z"/>${exSnd(ex,'timer')?'<path d="M8.5 4a3 3 0 0 1 0 5" stroke-linecap="round"/>':'<line x1="9" y1="4" x2="11" y2="6"/><line x1="11" y1="4" x2="9" y2="6"/>'}</svg><span>${exSnd(ex,'timer')?'Sound':'Muted'}</span></div>
        <div class="rtimer-pill">
          <div class="rtimer-btn" onclick="quickAdjustTimer(${ei},-5)">−</div>
          <div class="rtimer-label" onclick="openTimer(${ei})">${fmtMS(dur)}</div>
          <div class="rtimer-btn" onclick="quickAdjustTimer(${ei},5)">+</div>
        </div>
        <div class="rctrl flex" onclick="toggleRestVis(${ei})"><svg viewBox="0 0 13 13"><polyline points="2 8 6.5 4 11 8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Hide</span></div>
      </div>
    </div>
  </div>`;
}

function renderSlide(shimmer){
  // v55: enabled exactly when logging would save something — the same test
  // the capture uses (wsEntryHasWork). Until v54 the two had separate rules:
  // the slider counted a timer left running, the capture counted the item's
  // "logged" flag, and the gap between them saved ghosts or dropped real work.
  // A ticked set, a finished interval round, a finished cardio item or a cardio
  // timer that has run 30s all count, so leaving early still logs what was done.
  const anyLogged=wsDayHasWork(curDay);
  const shim=shimmer?' shimmer':'';
  // "+ Add Exercise" button sits in its own row above the LOG SESSION slider.
  // Opens the picker for the current day; the picker also has its own "+ New"
  // pill for creating a brand-new library entry without leaving the flow.
  return `<div class="today-add-row">
    <button class="today-add-btn" onclick="openWsPicker(curDay)"><span class="today-add-plus">+</span><span>Add Exercise</span></button>
  </div>
  <div class="slide-zone">
    <div class="slide-track${anyLogged?'':' disabled'}${shim}" id="slideTrack">
      <div class="slide-thumb" id="slideThumb"><svg viewBox="0 0 20 20"><polyline points="8 5 13 10 8 15" stroke="currentColor" stroke-width="2.5" fill="none"/></svg></div>
      <span class="slide-lbl" id="slideLbl">${anyLogged?'LOG SESSION':'START A SET TO ENABLE'}</span>
    </div>
  </div>
  ${wsDayEffortStrip()}
  ${wsDayComparisonHtml()}`;
}

function renderPostSession(){
  // Inline summary tab: surfaces the derived rollups you can't see mid-workout
  // (total volume, sets, work time, and Intensity Score if enabled). Computed
  // from the same capture path History uses, so the numbers match exactly.
  // Stays on the page — no relocation. Clears when the user navigates away
  // (handled in routeTo / day switch). Reset day remains available.
  let strip='';
  try{
    const rec=captureSessionRecord(curDay);
    if(rec){
      const vol=hiSessionVolume(rec), sets=hiSessionSets(rec), ws=hiSessionWorkSec(rec);
      // Session-level effort displays retired (panel resolution): a cross-
      // exercise average is neither an adaptation signal nor an honest load
      // metric. Per-exercise Effort N/10 is the displayed construct; Training
      // Load returns later as a Progress trend with proper baseline framing.
      // Panel resolution: SETS is the session headline, not volume. Volume-load
      // folds full bodyweight into calisthenics (73kg×reps), producing absurd,
      // illegible, cross-modality-incomparable totals. Sets are honest, legible,
      // comparable across exercise types, and the actual programming currency.
      // Volume returns later as a per-exercise trend for LOADED lifts only.
      let third = `<div class="ps-stat"><div class="ps-stat-v">${hiFmtMS(ws)||'—'}</div><div class="ps-stat-l">work time</div></div>`;
      const setsLabel = sets===1?'set':'sets';
      strip=`<div class="ps-stats">
        <div class="ps-stat"><div class="ps-stat-v acc">${sets>0?sets:'—'}</div><div class="ps-stat-l">${setsLabel}</div></div>
        ${third}
      </div>`;
    }
  }catch(_){ strip=''; }
  return `<div class="post-session">
    <div class="post-title">✓ Session logged</div>
    ${strip}
    <button class="post-btn" onclick="resetDay()">Reset day — train again</button>
  </div>`;
}

// PER-EXERCISE SOUND TOGGLE — persists for that exercise
function toggleExSound(ei){
  const d=DAYS[curDay];
  const ex=(d.items||[])[ei];
  if(!ex) return;
  ex.sound=ex.sound===false?true:false;
  renderAll(false);
}

function startRest(ei){
  if(restIntervals[ei]) clearInterval(restIntervals[ei]);
  restIntervals[ei]=setInterval(()=>{
    const d=DAYS[curDay];
    const ex=(d.items||[])[ei];if(!ex||ex.rs!=='running') return;
    if(ex.rl>0){
      ex.rl=Math.max(0,ex.rl-1);
      updateRestUI(ei);
      if(ex.rl===0){ex.rs='ready';(fireRimCue('rest'),playRestDone(ex));updateRestUI(ei);maybeReleaseWakeLock();}
    }
  },1000);
}

function updateRestUI(ei){
  const d=DAYS[curDay];
  const ex=(d.items||[])[ei];if(!ex||!ex.rv) return;
  const dur=ex.duration||ex.rest;const pct=ex.rl/dur;
  const isReady=ex.rs==='ready',isPaused=ex.rs==='paused',isIdle=ex.rs==='idle',isRunning=ex.rs==='running';
  const arc=document.getElementById('rarc'+ei);const rb=document.getElementById('rb'+ei);const fill=document.getElementById('rfill'+ei);
  if(!arc) return;
  arc.style.strokeDashoffset=(isIdle||isReady)?0:182*pct;
  let badgeCls='rest-badge';
  if(isReady) badgeCls+=' ready';else if(isPaused) badgeCls+=' paused';else if(isIdle) badgeCls+=' idle';else if(isRunning) badgeCls+=' running';
  // I1: strength rest running gets sage badge class
  const itemKind=ex._itemKind||wsTagItemKind(ex);
  const isStrengthEx=itemKind==='weighted';
  const isCardioTime=itemKind==='cardio_time';
  if(isStrengthEx&&isRunning) badgeCls+=' strength-running';
  rb.className=badgeCls;
  const rword=rb.querySelector('.rword');const rcount=rb.querySelector('.rcount');
  let wordHtml=isCardioTime?'Timer':'Rest',countText=fmtMS(ex.rl),countSize='21px';
  if(isIdle){wordHtml='Tap';countText='Start';countSize='15px';}
  else if(isRunning){wordHtml=`<svg viewBox="0 0 9 11"><line x1="3" y1="2" x2="3" y2="9"/><line x1="6" y1="2" x2="6" y2="9"/></svg>`;}
  else if(isPaused){wordHtml='Paused';}
  else if(isReady){wordHtml='Done';countText='Restart';countSize='15px';}
  rword.innerHTML=wordHtml;rcount.textContent=countText;rcount.style.fontSize=countSize;
  fill.className='rfill'+(isReady?' ready':'')+(isIdle?' idle':'')+(isStrengthEx&&isRunning?' strength-running':'');
  fill.style.width=((1-pct)*100)+'%';
}

function badgeTap(ei){
  const d=DAYS[curDay];
  const ex=(d.items||[])[ei];if(!ex) return;
  if(ex.rs==='idle'){ex.rs='running';acquireWakeLockIfActive();startRest(ei);}
  else if(ex.rs==='running'){ex.rs='paused';if(restIntervals[ei]) clearInterval(restIntervals[ei]);maybeReleaseWakeLock();}
  else if(ex.rs==='paused'){ex.rs='running';acquireWakeLockIfActive();startRest(ei);}
  else if(ex.rs==='ready'){ex.rl=ex.duration||ex.rest;ex.rs='running';acquireWakeLockIfActive();startRest(ei);}
  updateRestUI(ei);
}

// HIIT phase animations are driven by two parallel mechanisms:
// 1) 1Hz interval (hiitIntervals[ei]) — updates the countdown digit and handles segment transitions
// 2) rAF loop (hiitRafs[ei]) — smoothly animates the perimeter ring based on actual elapsed time
// Storing segmentStartTime + segmentDuration on the exercise lets the rAF compute exact progress.
let hiitRafs={};

function startHiit(ei){
  if(hiitIntervals[ei]) clearInterval(hiitIntervals[ei]);
  if(hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
  const ex=DAYS[curDay].items[ei];
  if(!ex) return;
  // Anchor for the current segment — used by both interval and rAF
  ex._segStartMs=Date.now();
  ex._segDurSec=ex.phaseLeft;

  // Continuous ring updater — smooth animation, always exactly accurate
  const tickRing=()=>{
    const exNow=DAYS[curDay].items[ei];
    if(!exNow||(exNow.phase!=='work'&&exNow.phase!=='rest'&&exNow.phase!=='setup')) return;
    const elapsedMs=Date.now()-exNow._segStartMs;
    const totalMs=exNow._segDurSec*1000;
    const pct=Math.max(0,Math.min(1,1-(elapsedMs/totalMs)));
    const ring=document.getElementById('hpring'+ei);
    if(ring){const L=parseFloat(ring.dataset.len)||1000;ring.setAttribute('stroke-dashoffset',pct*L);}
    if(window.__wsTvEi===ei){const tvr=document.getElementById('wsTvRing'); if(tvr){const L2=parseFloat(tvr.dataset.len)||1000;tvr.setAttribute('stroke-dashoffset',pct*L2);}}
    hiitRafs[ei]=requestAnimationFrame(tickRing);
  };
  hiitRafs[ei]=requestAnimationFrame(tickRing);

  // 1Hz tick for digit + segment transitions
  hiitIntervals[ei]=setInterval(()=>{
    const exNow=DAYS[curDay].items[ei];
    if(!exNow||(exNow.phase!=='work'&&exNow.phase!=='rest'&&exNow.phase!=='setup')) return;
    if(exNow.phaseLeft>0){
      exNow.phaseLeft--;
      const tEl=document.getElementById('hptime'+ei);
      if(tEl) tEl.textContent=fmt(exNow.phaseLeft);
      if(exNow.phaseLeft>0&&exNow.phaseLeft<=3&&typeof exSnd==='function'&&exSnd(exNow,'interval')) playKnock();
      const _tvT=document.getElementById('wsTvTime'); if(_tvT&&window.__wsTvEi===ei) _tvT.textContent=fmt(exNow.phaseLeft);
      if(exNow.phaseLeft===0){
        // Segment ended — handle transition
        if(exNow.phase==='setup'){
          // Setup done — start the actual circuit
          const segs=exNow._engineSegs||getHiitSegments(exNow);
          if(!segs||segs.length===0){
            exNow.phase='idle';clearInterval(hiitIntervals[ei]);
            if(hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
            wsTvSync();renderAll(false);return;
          }
          exNow.phaseIdx=0;
          exNow.phase=segs[0].type;
          exNow.phaseLeft=segs[0].duration;
          exNow._segStartMs=Date.now();
          exNow._segDurSec=segs[0].duration;
          if(exNow.voice&&segs[0].type==='work'&&segs[0].label)wsSpeak(segs[0].label);
          if(segs[0].type==='work') (fireRimCue('work'),playWorkStart(exNow)); else (fireRimCue('rest'),playRestDone(exNow));
          wsTvSync();renderAll(false);
          return;
        }
        // Work or rest segment ended
        const segs=exNow._engineSegs||getHiitSegments(exNow);
        const endedSeg=segs[exNow.phaseIdx];
        if(endedSeg){
          if(endedSeg.type==='work'){ exNow._workDone=(exNow._workDone||0)+1; exNow._workSecDone=(exNow._workSecDone||0)+(endedSeg.duration||0); }
          else { exNow._restSecDone=(exNow._restSecDone||0)+(endedSeg.duration||0); }
        }
        exNow.phaseIdx++;
        if(exNow.phaseIdx>=segs.length){
          exNow.phase='done';
          exNow.rounds=exNow._engineTotalRounds||getHiitTotalRounds(exNow);
          exNow._roundsDone=exNow.rounds;
          if(exNow.voice)wsSpeak('Circuit complete');
          exNow.logged=true;
          clearInterval(hiitIntervals[ei]);
          if(hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
          (wsGoldSweep(),playCircuitComplete(exNow));
          clearHiitSnapshot(exNow);
          // Release wake lock if held only during active timers
          maybeReleaseWakeLock();
          wsTvSync();renderAll(false);
          return;
        }
        const nextSeg=segs[exNow.phaseIdx];
        exNow.phase=nextSeg.type;
        exNow.phaseLeft=nextSeg.duration;
        exNow._segStartMs=Date.now();
        exNow._segDurSec=nextSeg.duration;
        if(nextSeg.roundRest){
          exNow.rounds=nextSeg.roundIdx;
          exNow._roundsDone=nextSeg.roundIdx+1;
          if(exNow.voice)wsSpeak('Round '+(nextSeg.roundIdx+1)+' complete');
          (wsGoldSweep(),playRoundComplete(exNow));
        } else if(nextSeg.type==='work'){
          exNow.rounds=nextSeg.roundIdx;
          if(exNow.voice&&nextSeg.label)wsSpeak(nextSeg.label);
          (fireRimCue('work'),playWorkStart(exNow));
        } else {
          exNow.rounds=nextSeg.roundIdx;
          (fireRimCue('rest'),playRestDone(exNow));
        }
        wsTvSync();renderAll(false);
      }
    }
  },1000);
}

function wsHiitSkip(ei,dir){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  const active=ex.phase==='work'||ex.phase==='rest'||ex.phase==='setup'||ex.phase==='paused';
  if(!active) return;
  const segs=ex._engineSegs||getHiitSegments(ex); if(!segs.length) return;
  const fromSetup=ex.phase==='setup'||(ex.phase==='paused'&&ex._pausedPhase==='setup');
  let i=fromSetup?(dir>0?0:0):(ex.phaseIdx+dir);
  i=Math.max(0,Math.min(i,segs.length-1));
  const seg=segs[i];
  ex.phaseIdx=i; ex.phaseLeft=seg.duration;
  ex._segDurSec=seg.duration; ex._segStartMs=Date.now();
  ex.rounds=seg.roundIdx;
  if(ex.phase==='paused'){ ex._pausedPhase=seg.type; }
  else {
    ex.phase=seg.type;
    if(ex.voice&&seg.type==='work'&&!seg.roundRest&&seg.label)wsSpeak(seg.label);
    if(ex.voice&&seg.roundRest)wsSpeak('Round '+(seg.roundIdx+1)+' complete');
    if(seg.roundRest) (wsGoldSweep(),playRoundComplete(ex));
    else if(seg.type==='work') (fireRimCue('work'),playWorkStart(ex));
    else (fireRimCue('rest'),playRestDone(ex));
  }
  renderAll(false);wsTvSync();
}
function hiitBadgeTap(ei){
  const ex=DAYS[curDay].items[ei];if(!ex) return;
  wsPrimeAudio();
  if(ex.phase==='idle'){
    snapshotHiitConfig(ex);
    ex._workDone=0;ex._workSecDone=0;ex._restSecDone=0;ex._roundsDone=0;
    const segs=ex._engineSegs;
    if(!segs||segs.length===0){clearHiitSnapshot(ex); return;}
    // If setup time configured, enter setup phase first
    const setupSec=ex.setupSec||0;
    if(setupSec>0){
      ex.phase='setup';
      ex.phaseIdx=-1; // sentinel: not yet on the segment list
      ex.phaseLeft=setupSec;
      ex.rounds=0;
      (fireRimCue('setup'),playSetupStart(ex));
    } else {
      ex.phase=segs[0].type;
      ex.phaseIdx=0;
      ex.phaseLeft=segs[0].duration;
      ex.rounds=0;
      if(ex.voice&&segs[0].type==='work'&&segs[0].label)wsSpeak(segs[0].label);
      if(segs[0].type==='work') (fireRimCue('work'),playWorkStart(ex)); else (fireRimCue('rest'),playRestDone(ex));
    }
    acquireWakeLockIfActive();
    startHiit(ei);renderAll(false);
    if(ex.startMode==='takeover') wsOpenTakeover(ei);
  } else if(ex.phase==='work'||ex.phase==='rest'||ex.phase==='setup'){
    ex._pausedPhase=ex.phase;ex.phase='paused';
    if(hiitIntervals[ei]) clearInterval(hiitIntervals[ei]);
    if(hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
    renderAll(false);
  } else if(ex.phase==='paused'){
    ex.phase=ex._pausedPhase;delete ex._pausedPhase;
    // Re-anchor segment time so countdown resumes correctly
    ex._segStartMs=Date.now()-((ex._segDurSec-ex.phaseLeft)*1000);
    startHiit(ei);renderAll(false);
  } else if(ex.phase==='done'){
    clearHiitSnapshot(ex);
    snapshotHiitConfig(ex);
    ex._workDone=0;ex._workSecDone=0;ex._restSecDone=0;ex._roundsDone=0;
    const segs=ex._engineSegs;
    if(!segs||segs.length===0){clearHiitSnapshot(ex); return;}
    const setupSec=ex.setupSec||0;
    if(setupSec>0){
      ex.phase='setup';ex.phaseIdx=-1;ex.phaseLeft=setupSec;ex.rounds=0;ex.logged=false;
      (fireRimCue('setup'),playSetupStart(ex));
    } else {
      ex.phase=segs[0].type;ex.phaseIdx=0;ex.phaseLeft=segs[0].duration;ex.rounds=0;ex.logged=false;
      if(ex.voice&&segs[0].type==='work'&&segs[0].label)wsSpeak(segs[0].label);
      if(segs[0].type==='work') (fireRimCue('work'),playWorkStart(ex)); else (fireRimCue('rest'),playRestDone(ex));
    }
    acquireWakeLockIfActive();
    startHiit(ei);renderAll(false);
    if(ex.startMode==='takeover') wsOpenTakeover(ei);
  }
}

// B4: cardio branch removed — +/− pill is strength-rest only
function quickAdjustTimer(ei,delta){
  const d=DAYS[curDay];
  const ex=(d.items||[])[ei];if(!ex) return;
  ex.rest=Math.max(5,Math.min(600,ex.rest+delta));
  if(ex.rs==='idle'||ex.rs==='ready') ex.rl=ex.rest;
  renderAll(false);
}

function toggleRestVis(ei){
  const d=DAYS[curDay];
  const ex=(d.items||[])[ei];if(!ex) return;
  ex.rv=!ex.rv;renderAll(false);
}

function openTimer(ei){
  const d=DAYS[curDay];
  const ex=(d.items||[])[ei];if(!ex) return;
  const k=ex._itemKind||wsTagItemKind(ex);
  // Dispatch by item's own kind, not the day's. With mixed days, both
  // strength and cardio items can share a day.
  if(k==='cardio_time'){
    openCardioEdit(ei,'activityLimit');
    return;
  }
  if(k==='weighted'){
    openCardioEdit(ei,'strengthRest','exercises');
    return;
  }
}

function fmt(s){const m=Math.floor(s/60),sec=s%60;return m+':'+(sec<10?'0':'')+sec;}

// Curated exercise tints — desaturated, dark, complement ember/sage palette
// Each tint is a {r,g,b} triplet applied at low opacity over the card base
const EXERCISE_TINTS=[
  [191,142,90],   // warm tan (ember family)
  [122,168,150],  // muted teal (sage family)
  [184,140,140],  // dusty rose
  [200,170,100],  // pale gold
  [156,148,180],  // soft lavender
  [142,162,180],  // stone blue
  [180,158,124],  // muted khaki
  [148,170,138],  // pale moss
];
