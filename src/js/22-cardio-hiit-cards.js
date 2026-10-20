
function renderCardioCard(ex,ei,shimmer){
  const d=DAYS[curDay];
  const isAct=ei===0&&!d.logged;
  const iconData=ICONS[ex.icon]||ICONS.run;

  let fieldsHtml='';
  let footerText='';
  let extraHtml='';
  let tagText=ex.kind==='time'?'Time-based':ex.kind==='distance'?'Distance-based':'Intervals';
  let tagClass=ex.kind;
  let tagMeta='';

  if(ex.kind==='time'){
    const isRunning=ex.rs==='running';
    const isPaused=ex.rs==='paused';
    const isReady=ex.rs==='ready';
    const isOpen=ex.timerMode==='open';
    // What the Duration cell shows depends on state:
    //   idle    → ex.duration (the planned goal)
    //   running → live elapsed (counts up regardless of mode)
    //   paused  → live elapsed at pause point
    //   ready   → ex.actualDuration (the logged result)
    let liveElapsed=0;
    if(isRunning||isPaused){
      liveElapsed=isOpen?ex.rl:Math.max(0,(ex.duration||0)-ex.rl);
    } else if(isReady){
      liveElapsed=ex.actualDuration||0;
    } else {
      liveElapsed=ex.duration||0;
    }
    const durationDisplay=liveElapsed?fmtMS(liveElapsed):'—';
    let durationHint;
    if(isRunning) durationHint='running · tap to edit goal';
    else if(isPaused) durationHint='paused · tap to edit goal';
    else if(isReady) durationHint='done · tap to edit';
    else durationHint=`goal · ${fmtMS(ex.duration||0)}`;
    fieldsHtml=`<div class="cardio-fields t3">
      <div class="cf${liveElapsed?' logged':' empty'}${(isRunning||isPaused)?' active':''}" onclick="openCardioEdit(${ei},'duration')">
        <div class="cf-l">Duration</div>
        <div class="cf-v" id="liveDur${ei}">${durationDisplay}</div>
        <div class="cf-u">${durationHint}</div>
      </div>
      <div class="cf${ex.logged?' logged':''}" onclick="openCardioEdit(${ei},'intensity')">
        <div class="cf-l">Intensity</div>
        <div class="cf-v">${ex.intensity}</div>
        <div class="cf-u">${ex.intensity==='Low'?'easy':ex.intensity==='Mod'?'moderate':'hard'}</div>
      </div>
      <div class="cf${ex.distance?' logged':' empty'}" onclick="openCardioEdit(${ei},'distance')">
        <div class="cf-l">Distance</div>
        <div class="cf-v">${ex.distance!==null?ex.distance:'—'}</div>
        <div class="cf-u">${ex.distance!==null?'metres':'optional'}</div>
      </div>
    </div>`;
    footerText='Tap any field to log · or use the timer to track activity time';
    extraHtml=renderActivityTimer(ex,ei);
  } else if(ex.kind==='distance'){
    // Display unit switches: meters under 1km, km otherwise — matching the editor
    const distVal=ex.distance||0;
    const distDisplay=distVal<1?Math.round(distVal*1000):(distVal>=10?distVal.toFixed(1):distVal.toFixed(2));
    const distUnit=distVal<1?'m':'km';
    const isRunning=ex.rs==='running';
    const isPaused=ex.rs==='paused';
    const isReady=ex.rs==='ready';
    const isOpen=ex.timerMode==='open';
    let liveElapsed=0;
    if(isRunning||isPaused){
      liveElapsed=isOpen?ex.rl:Math.max(0,(ex.duration||0)-ex.rl);
    } else if(isReady){
      liveElapsed=ex.actualDuration||0;
    } else {
      liveElapsed=ex.duration||0;
    }
    const durationDisplay=liveElapsed?fmtMS(liveElapsed):'—';
    let durationHint;
    if(isRunning) durationHint='running · tap to edit goal';
    else if(isPaused) durationHint='paused · tap to edit goal';
    else if(isReady) durationHint='done · tap to edit';
    else durationHint=`goal · ${fmtMS(ex.duration||0)}`;
    // Pace uses live elapsed when timer is running so it updates in real time
    const paceVal=liveElapsed&&ex.distance?calcPace(liveElapsed,ex.distance):'auto';
    fieldsHtml=`<div class="cardio-fields t3">
      <div class="cf${ex.distance?' logged':' empty'}" onclick="openCardioEdit(${ei},'distance')">
        <div class="cf-l">Distance</div>
        <div class="cf-v">${distDisplay}</div>
        <div class="cf-u">${distUnit}</div>
      </div>
      <div class="cf${liveElapsed?' logged':' empty'}${(isRunning||isPaused)?' active':''}" onclick="openCardioEdit(${ei},'duration')">
        <div class="cf-l">Duration</div>
        <div class="cf-v" id="liveDur${ei}">${durationDisplay}</div>
        <div class="cf-u">${durationHint}</div>
      </div>
      <div class="cf auto">
        <div class="cf-l">Pace</div>
        <div class="cf-v" id="livePace${ei}">${paceVal}</div>
        <div class="cf-u">min/km · calc</div>
      </div>
    </div>`;
    footerText='Start the timer when you begin · pace auto-calculates';
    extraHtml=renderActivityTimer(ex,ei);
  } else if(ex.kind==='intervals'){
    // Display reads directly from live ex.* — edits are reflected immediately.
    // The running engine has its own segment list (ex._engineSegs) so the timer
    // continues uninterrupted regardless of edits during a run.
    const totalR=getHiitTotalRounds(ex);
    const isSimple=ex.simpleMode!==false;
    const isRunning=ex.phase==='work'||ex.phase==='rest'||ex.phase==='paused';
    // Detect pending edits — when running engine differs from current live config
    const hasPending=isRunning&&ex._engineSegs&&(
      ex._engineTotalRounds!==totalR||
      JSON.stringify(ex._engineSegs)!==JSON.stringify(getHiitSegments(ex))
    );
    fieldsHtml=`<div class="ws-circ-spec${hasPending?' pending':''}">
      <div class="ws-circ-spec-l">
        ${ex.name?'':`<div class="ws-circ-spec-name">Auto · ${wsCircuitName(ex)}</div>`}
        <div class="ws-circ-spec-sub">${isSimple?`${totalR} rounds · ${ex.workSec}s on / ${ex.restSec}s off`:(ex.amrap&&ex.capMin>0?`${(ex.roundsCustom||[]).length} stations · AMRAP ${ex.capMin} min`:`${(ex.roundsCustom||[]).length} stations · ${totalR} ${totalR===1?'round':'rounds'} · break ${ex.roundRest||0}s`)}</div>
      </div>
      <div class="ws-wrench" onclick="wsOpenCircuitEditor(${ei})"><svg viewBox="0 0 16 16"><path d="M11.5 1.7a3.6 3.6 0 0 0-4.3 4.7L2 11.6a1.6 1.6 0 1 0 2.3 2.3l5.2-5.2a3.6 3.6 0 0 0 4.7-4.3L12 6.6 9.4 4 11.5 1.7z"/></svg></div>
    </div>${hasPending?'<div class="pending-indicator">Edits will apply on next start</div>':''}`;
    footerText='';
    extraHtml=renderHiitTimer(ex,ei);
    tagMeta=`${totalR} ${totalR===1?'round':'rounds'}`;
  }

  const tint=exerciseTint(ex.name);
  const tintStyle=tint?` style="background:linear-gradient(180deg,${tint.bg},transparent 60%),var(--s1);border-color:${tint.border}"`:'';

  return `<div class="cardio-card${isAct?' act':''}" data-ei="${ei}"${tintStyle}>
    <div class="cardio-head">
      <div class="cardio-left">
        <div class="cardio-icon" onclick="openIconPicker(${ei})"><svg viewBox="0 0 24 24">${iconData.svg}</svg></div>
        <div class="cardio-name-block">
          <span class="cardio-name">${wsEscape(ex.name)}</span>
          <span class="cardio-tag ${tagClass}">${tagText}${tagMeta?`<span class="cardio-tag-meta">· ${tagMeta}</span>`:''}</span>
        </div>
      </div>
    </div>
    <div class="cardio-cue">${(ex.kind==='intervals'?(()=>{
      if(ex.simpleMode!==false){
        return `${ex.workSec}s on, ${ex.restSec}s off · ${ex.totalRounds||1} ${(ex.totalRounds||1)===1?'round':'rounds'}`;
      } else {
        const ct=(ex.roundsCustom||[]).length;
        return `${ct} custom ${ct===1?'round':'rounds'}`;
      }
    })():ex.cue)}</div>
    ${fieldsHtml}
    ${extraHtml}
    ${footerText?`<div class="cardio-foot">${footerText}</div>`:''}
    ${wsEffortStrip(ex,ei)}
  </div>`;
}

function renderActivityTimer(ex,ei){
  if(!ex.rv){
    const goalLabel=fmtMS(ex.duration||0);
    const modeLabel=ex.timerMode==='limit'?`limit · ${goalLabel}`:`open · goal ${goalLabel}`;
    return `<div class="rest-section"><div class="rest-collapsed-row">
      <span class="rest-collapsed-lbl">Activity timer · ${modeLabel}</span>
      <button class="rest-show-btn" onclick="toggleRestVis(${ei})">Show</button>
    </div></div>`;
  }
  const isOpen=ex.timerMode==='open';
  const isRunning=ex.rs==='running';
  const isPaused=ex.rs==='paused';
  const isIdle=ex.rs==='idle';
  const isReady=ex.rs==='ready';
  const goal=ex.duration||0;
  // What the badge digit displays:
  // - open mode: elapsed (counting up from 0)
  // - limit mode: remaining (counting down toward 0)
  const elapsed=isOpen?ex.rl:Math.max(0,goal-ex.rl);
  const badgeDisplay=isOpen?elapsed:ex.rl;
  // Progress (% remaining): drives the arc and the bar fill
  let pctRemaining;
  if(isIdle) pctRemaining=isOpen?1:1;
  else if(isReady) pctRemaining=0;
  else pctRemaining=isOpen?(goal>0?Math.max(0,1-(elapsed/goal)):1):(goal>0?(ex.rl/goal):1);

  let badgeCls='rest-badge';
  if(isReady) badgeCls+=' ready';
  else if(isPaused) badgeCls+=' paused';
  else if(isIdle) badgeCls+=' idle';
  else if(isRunning) badgeCls+=isOpen?' counting':' running';
  let countText=isIdle?'Start':isReady?'Done':fmtMS(badgeDisplay);
  let countSize=isIdle||isReady?'15px':'21px';
  let wordHtml=isOpen?'Time':'Timer';
  if(isIdle) wordHtml='Tap';
  else if(isRunning) wordHtml=`<svg viewBox="0 0 9 11"><line x1="3" y1="2" x2="3" y2="9"/><line x1="6" y1="2" x2="6" y2="9"/></svg>`;
  else if(isPaused) wordHtml='Paused';
  else if(isReady) wordHtml='Done';
  // Arc offset: 182 is the circumference for r=29
  const off=isIdle?182:(isReady?0:182*pctRemaining);
  const fillPct=isIdle?0:((1-pctRemaining)*100);
  const goalLabel=fmtMS(goal);
  // Hint text: clarify state & control
  let hintLeft=isOpen?`Open · counts up · goal ${goalLabel}`:`Limit · counts down from ${goalLabel}`;
  if(isReady) hintLeft=`Done · ${fmtMS(ex.actualDuration||0)}`;
  let hintRight='';
  if(isPaused) hintRight='Tap to resume';
  else if(isRunning) hintRight='Tap to pause';
  // No hint when idle — the badge itself reads "Tap · Start"

  // B1 fix: show Done always when running or paused — gate belongs on the LOG, not the button.
  // zero-elapsed class dims it slightly so the user reads it as 'abort' rather than 'log'.
  const showDone=(isRunning||isPaused);
  const showCancel=isPaused;

  return `<div class="rest-section">
    <div class="rest-body cardio-time">
      <div class="workout-timer-mode-row">
        <div class="wtm-btn${isOpen?' active':''}" onclick="setActivityMode(${ei},'open')">
          <svg viewBox="0 0 12 12"><polyline points="2 6 5 9 10 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Open · count up
        </div>
        <div class="wtm-btn${!isOpen?' active':''}" onclick="setActivityMode(${ei},'limit')">
          <svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="none"/><line x1="6" y1="3" x2="6" y2="6.5" stroke-linecap="round"/></svg>
          Limit · count down
        </div>
      </div>
      <div class="rest-top-row">
        <div class="${badgeCls}" id="rb${ei}" onclick="activityBadgeTap(${ei})">
          <svg class="r-arc" viewBox="0 0 68 68"><circle class="rbg" cx="34" cy="34" r="29"/><circle class="rarc" id="rarc${ei}" cx="34" cy="34" r="29" style="stroke-dashoffset:${off}"/></svg>
          <div class="rbadge-inner"><span class="rword">${wordHtml}</span><span class="rcount" style="font-size:${countSize}">${countText}</span></div>
        </div>
        <div class="rest-bar-wrap">
          <div class="rbar"><div class="rfill ${isOpen&&isRunning?'counting':''}${isReady?' ready':''}${isIdle?' idle':''}" id="rfill${ei}" style="width:${fillPct}%"></div></div>
          <div class="rest-bar-meta">
            <span class="rest-bar-hint">${hintLeft}</span>
            ${hintRight?`<span class="rest-bar-hint action">${hintRight}</span>`:''}
          </div>
        </div>
      </div>
      <div class="rest-controls-row">
        <div class="rctrl flex${exSnd(ex,'timer')?' active':''}" onclick="toggleExSound(${ei})"><svg viewBox="0 0 13 13"><path d="M1 4.5h2l3-3v10L3 8.5H1V4.5z"/>${exSnd(ex,'timer')?'<path d="M8.5 4a3 3 0 0 1 0 5" stroke-linecap="round"/>':'<line x1="9" y1="4" x2="11" y2="6"/><line x1="11" y1="4" x2="9" y2="6"/>'}</svg><span>${exSnd(ex,'timer')?'Sound':'Muted'}</span></div>
        ${showDone?`<div class="hold-btn done${elapsed===0?' zero-elapsed':''}" data-hold-action="activityFinish" data-hold-ei="${ei}"><div class="hold-fill"></div><div class="hold-label"><div class="hold-icon"></div><span>${elapsed===0?'Stop':'Done · '+fmtMS(elapsed)}</span></div></div>`:''}
        ${showCancel?`<div class="hold-btn cancel" data-hold-action="activityCancel" data-hold-ei="${ei}"><div class="hold-fill"></div><div class="hold-label"><div class="hold-icon"></div><span>Cancel</span></div></div>`:''}
        ${!showDone&&!showCancel?`<div class="rctrl flex" onclick="toggleRestVis(${ei})"><span>Hide</span></div>`:''}
      </div>
    </div>
  </div>`;
}

function setActivityMode(ei,mode){
  const ex=DAYS[curDay].items[ei];
  if(ex.timerMode===mode) return;
  const goal=ex.duration||0;
  // Translate rl between display semantics so elapsed time is preserved.
  // open: rl = elapsed (counts up). limit: rl = remaining (counts down).
  // Either direction, newRl = goal - oldRl (clamped non-negative).
  if(ex.rs==='running'||ex.rs==='paused'){
    if(goal>0){
      ex.rl=Math.max(0,goal-ex.rl);
    } else {
      // No goal yet, falling back to safe defaults
      ex.rl=mode==='open'?0:0;
    }
  } else {
    // Idle/ready: just reset rl to mode's starting position
    ex.rl=mode==='open'?0:goal;
  }
  ex.timerMode=mode;
  renderAll(false);
}
// Removed: adjustActivityLimit and openActivityLimit are no longer used
// (the +/- pill was redundant; users edit the goal via the Duration cell)

function activityBadgeTap(ei){
  const ex=DAYS[curDay].items[ei];
  const isOpen=ex.timerMode==='open';
  if(ex.rs==='idle'){
    ex.rs='running';
    // Open mode: rl is elapsed (counts up from 0). Limit mode: rl is remaining (counts down from goal).
    if(isOpen) ex.rl=0;
    else ex.rl=ex.duration||0;
    ex.actualDuration=null; // fresh run, clear any previous result
    acquireWakeLockIfActive();
    startActivity(ei);
  } else if(ex.rs==='running'){
    // Both modes pause on tap — no accidental finish
    ex.rs='paused';
    if(activityIntervals[ei]) clearInterval(activityIntervals[ei]);
    maybeReleaseWakeLock();
  } else if(ex.rs==='paused'){
    ex.rs='running';acquireWakeLockIfActive();startActivity(ei);
  } else if(ex.rs==='ready'){
    // Restart from clean state
    ex.rl=isOpen?0:(ex.duration||0);
    ex.actualDuration=null;
    ex.rs='running';
    acquireWakeLockIfActive();startActivity(ei);
  }
  renderAll(false);
}

// Explicit finish — log the actual elapsed time, not the goal
// In open mode: actualDuration = rl (elapsed)
// In limit mode: actualDuration = duration - rl (elapsed, since rl is remaining)
function bindSlideToSave(wrapId, onComplete){
  wrapId = wrapId || 'slideToSave';
  const wrap=document.getElementById(wrapId);
  if(!wrap) return;
  const cb = onComplete || (()=>saveCardioEdit());
  const track=wrap.querySelector('.sts-track');
  const thumb=wrap.querySelector('.sts-thumb');
  const fill=wrap.querySelector('.sts-fill');
  if(!track||!thumb||!fill) return;
  if(thumb._stsBound) return; // idempotent: don't stack window listeners on re-render
  thumb._stsBound=true;
  let dragging=false;
  let startX=0;
  let trackWidth=0;
  const thumbWidth=42;
  const start=(e)=>{
    e.preventDefault();
    dragging=true;
    track.classList.add('dragging');
    const rect=track.getBoundingClientRect();
    trackWidth=rect.width;
    startX=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
  };
  const move=(e)=>{
    if(!dragging) return;
    const rect=track.getBoundingClientRect();
    const x=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
    const maxLeft=trackWidth-thumbWidth-6;
    const newLeft=Math.max(0,Math.min(maxLeft,x-thumbWidth/2));
    thumb.style.transform=`translateX(${newLeft}px)`;
    fill.style.width=(newLeft+thumbWidth/2)+'px';
    if(newLeft>=maxLeft-1){
      track.classList.add('completed');
      track.classList.remove('dragging');
      dragging=false;
      setTimeout(()=>{cb();},200);
    }
  };
  const end=()=>{
    if(!dragging) return;
    dragging=false;
    track.classList.remove('dragging');
    if(!track.classList.contains('completed')){
      thumb.style.transform='translateX(0)';
      fill.style.width='0';
    }
  };
  thumb.addEventListener('pointerdown',start);
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',end);
  window.addEventListener('pointercancel',end);
}

// Hold-to-confirm: bind a hold-button element to fire its action only after a sustained press.
// Tap-and-release fires nothing. Hold for the duration completes the action.
const HOLD_DURATION_MS=3000;
function bindHoldButton(el,action){
  if(!el||el._holdBound) return;
  el._holdBound=true;
  let timer=null;
  let active=false;
  const start=(e)=>{
    e.preventDefault();
    if(active) return;
    active=true;
    el.classList.add('holding');
    timer=setTimeout(()=>{
      el.classList.add('confirming');
      try{action();}catch(err){console.error('Hold action failed:',err);}
    },HOLD_DURATION_MS);
  };
  const cancel=()=>{
    if(!active) return;
    active=false;
    if(timer){clearTimeout(timer);timer=null;}
    el.classList.remove('holding','confirming');
  };
  el.addEventListener('pointerdown',start);
  el.addEventListener('pointerup',cancel);
  el.addEventListener('pointerleave',cancel);
  el.addEventListener('pointercancel',cancel);
}
// Wire all hold buttons present in the DOM after each render
function bindAllHoldButtons(){
  document.querySelectorAll('.hold-btn[data-hold-action]').forEach(el=>{
    const action=el.dataset.holdAction;
    const ei=parseInt(el.dataset.holdEi,10);
    if(action==='activityFinish') bindHoldButton(el,()=>activityFinish(ei));
    else if(action==='activityCancel') bindHoldButton(el,()=>activityCancel(ei));
    else if(action==='hiitEndEarly') bindHoldButton(el,()=>hiitEndEarly(ei));
  });
}

function activityFinish(ei){
  const ex=DAYS[curDay].items[ei];
  if(!ex) return;
  if(activityIntervals[ei]) clearInterval(activityIntervals[ei]);
  const isOpen=ex.timerMode==='open';
  const elapsed=isOpen?ex.rl:Math.max(0,(ex.duration||0)-ex.rl);
  // B1 fix: if zero elapsed, treat as abort (same as cancel) — don't log a zero session
  if(elapsed===0){
    ex.rs='idle';
    ex.rl=isOpen?0:(ex.duration||0);
    ex.actualDuration=null;
    maybeReleaseWakeLock();
    renderAll(false);
    return;
  }
  ex.actualDuration=elapsed;
  ex.logged=true;
  ex.rs='ready';
  (fireRimCue('rest'),playRestDone(ex));
  maybeReleaseWakeLock();
  renderAll(false);
}

// Cancel — discard the current run, return to idle. Only available from paused state (one-tap protection).
function activityCancel(ei){
  const ex=DAYS[curDay].items[ei];
  if(!ex) return;
  if(activityIntervals[ei]) clearInterval(activityIntervals[ei]);
  ex.rs='idle';
  ex.rl=ex.timerMode==='open'?0:(ex.duration||0);
  ex.actualDuration=null;
  maybeReleaseWakeLock();
  renderAll(false);
}

// I2: End Early — hold-to-confirm that logs partial HIIT completion and stops the engine
function hiitEndEarly(ei){
  const ex=DAYS[curDay].items[ei];
  if(!ex) return;
  if(hiitIntervals[ei]) clearInterval(hiitIntervals[ei]);
  if(hiitRafs&&hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
  // Log how many complete rounds were finished at time of End Early
  const segs=ex._engineSegs||getHiitSegments(ex);
  const totalSegs=segs.length;
  const completedSegs=Math.max(0,ex.phaseIdx||0);
  // Count complete work segments (one per round)
  let completedRounds=0;
  for(let i=0;i<completedSegs&&i<segs.length;i++){
    if(segs[i].type==='work') completedRounds++;
  }
  ex.rounds=completedRounds;
  ex.logged=true;
  ex.phase='done';
  ex._pausedForEdit=false;
  maybeReleaseWakeLock();
  // Play a softer sound than circuit complete — partial completion
  (fireRimCue('rest'),playRestDone(ex));
  renderAll(false);
}

function startActivity(ei){
  if(activityIntervals[ei]) clearInterval(activityIntervals[ei]);
  activityIntervals[ei]=setInterval(()=>{
    const ex=DAYS[curDay].items[ei];
    if(!ex||ex.rs!=='running') return;
    const isOpen=ex.timerMode==='open';
    if(isOpen){
      ex.rl++;
      // Hard cap at 12 hours so the integer doesn't run off
      if(ex.rl>=43200){
        ex.actualDuration=ex.rl;
        ex.logged=true;ex.rs='ready';
        clearInterval(activityIntervals[ei]);
        (fireRimCue('rest'),playRestDone(ex));maybeReleaseWakeLock();renderAll(false);return;
      }
    } else {
      // Limit mode: rl counts down toward 0; goal is ex.duration
      if(ex.rl>0){
        ex.rl--;
        if(ex.rl===0){
          // Natural completion — actualDuration equals the goal
          ex.actualDuration=ex.duration||0;
          ex.logged=true;ex.rs='ready';
          (fireRimCue('rest'),playRestDone(ex));maybeReleaseWakeLock();renderAll(false);return;
        }
      }
    }
    // Update visible timer surfaces every tick — DOM updates only, no state churn
    updateActivityTickUI(ex,ei);
  },1000);
}

// Single source for live DOM updates from the activity timer tick. Centralized so
// the badge, progress bar/arc, duration cell, and pace cell all update together.
function updateActivityTickUI(ex,ei){
  const isOpen=ex.timerMode==='open';
  const goal=ex.duration||0;
  // Compute elapsed (displayed in the badge for open, or as "X / goal" framing)
  const elapsed=isOpen?ex.rl:(goal-ex.rl);
  // Progress fraction (0→1) — used by progress bar and arc
  const pctRemaining=isOpen?(goal>0?Math.max(0,1-(elapsed/goal)):1):(goal>0?(ex.rl/goal):1);
  // Badge digit
  const rb=document.getElementById('rb'+ei);
  if(rb){
    const rcount=rb.querySelector('.rcount');
    // In open mode show elapsed; in limit mode show remaining
    if(rcount) rcount.textContent=fmtMS(isOpen?elapsed:ex.rl);
  }
  // Arc + bar
  const arc=document.getElementById('rarc'+ei);
  if(arc) arc.style.strokeDashoffset=182*pctRemaining;
  const fill=document.getElementById('rfill'+ei);
  if(fill) fill.style.width=((1-pctRemaining)*100)+'%';
  // Duration cell (live elapsed)
  const liveDurEl=document.getElementById('liveDur'+ei);
  if(liveDurEl) liveDurEl.textContent=fmtMS(elapsed);
  // Pace cell for distance-based
  if(ex.kind==='distance'){
    const livePaceEl=document.getElementById('livePace'+ei);
    if(livePaceEl) livePaceEl.textContent=elapsed&&ex.distance?calcPace(elapsed,ex.distance):'auto';
  }
  // Enable the session log slide once we cross the 30s threshold
  if(elapsed===30){
    const slideTrack=document.getElementById('slideTrack');
    if(slideTrack&&slideTrack.classList.contains('disabled')){
      slideTrack.classList.remove('disabled');
      const lbl=document.getElementById('slideLbl');
      if(lbl) lbl.textContent='LOG SESSION';
    }
  }
}

function wsHiitState(ex,ei){
  // Single source of truth for BOTH the inline card and the takeover view —
  // the two surfaces consume this object, so they cannot drift apart.
  const isActivePhase=ex.phase==='work'||ex.phase==='rest'||ex.phase==='paused'||ex.phase==='setup';
  const segs=isActivePhase&&ex._engineSegs?ex._engineSegs:getHiitSegments(ex);
  const totalRounds=isActivePhase&&ex._engineTotalRounds?ex._engineTotalRounds:getHiitTotalRounds(ex);
  const isSimple=ex.simpleMode!==false;
  const isAm=!!ex.amrap&&(ex.capMin||0)>0;
  const isIdle=ex.phase==='idle'||!ex.phase, isDone=ex.phase==='done',
        isPaused=ex.phase==='paused', isSetup=ex.phase==='setup',
        isWork=ex.phase==='work', isRest=ex.phase==='rest';
  const curIdx=isDone?segs.length-1:((isIdle||isSetup)?-1:Math.max(0,Math.min(ex.phaseIdx||0,segs.length-1)));
  const cur=curIdx>=0?segs[curIdx]:null;
  const curRound=cur?(isSimple?0:cur.roundIdx):0;

  const COLS=8, PILL=14, GAP=6, PITCH=PILL+GAP;
  const rows=[];
  if(isSimple){ for(let i=0;i<segs.length;i+=COLS) rows.push({r:0,g:i,c:segs.slice(i,i+COLS)}); }
  else { let i=0; while(i<segs.length){ const r=segs[i].roundIdx; let j=i;
      while(j<segs.length&&segs[j].roundIdx===r) j++;
      for(let o=i;o<j;o+=COLS) rows.push({r,g:o,c:segs.slice(o,Math.min(o+COLS,j))});
      i=j; } }
  const rowOf=gi=>rows.findIndex(rw=>gi>=rw.g&&gi<rw.g+rw.c.length);
  let win=0;
  if(rows.length>2){
    let cr=curIdx>=0?rowOf(curIdx):0; if(cr<0)cr=0;
    const roundFirst=isSimple?cr:rows.findIndex(rw=>rw.r===rows[cr].r);
    win=Math.max(roundFirst,cr-1);
    win=Math.max(0,Math.min(win,rows.length-2));
  }
  const prevWin=(typeof ex._wsWin==='number')?ex._wsWin:win;
  const slide=isActivePhase&&prevWin!==win;
  ex._wsWin=win;
  const hiddenBelow=rows.length>2?rows.length-(win+2):0;
  const lastVisRow=Math.min(win+1,rows.length-1);
  const colHtml=rows.map((rw,ri)=>{
    const dim=(!isSimple&&isActivePhase&&rw.r!==curRound)?' dim':'';
    const cells=rw.c.map((sg,ci)=>{
      const gi=rw.g+ci;
      if(ri===lastVisRow&&ci===rw.c.length-1&&hiddenBelow>0&&gi!==curIdx)
        return `<div class="phase-seg more">⋯</div>`;
      let cls=sg.roundRest?'rbreak':sg.type;
      if(curIdx>=0){ if(gi<curIdx)cls+=' done'; else if(gi===curIdx&&(isWork||isRest))cls+=' active'; }
      return `<div class="phase-seg ${cls}${dim}"></div>`;
    }).join('');
    return `<div class="strip-row" style="grid-template-columns:repeat(${COLS},1fr)">${cells}</div>`;
  }).join('');
  const vpH=(Math.min(rows.length,2)*PITCH)-GAP;
  const colStyle=`transform:translateY(${-win*PITCH}px);--wsF:${-prevWin*PITCH}px;--wsT:${-win*PITCH}px`;

  let stripDesc;
  if(isActivePhase&&cur){
    stripDesc=isPaused?`Paused · round ${curRound+1}${isAm?'':` of ${totalRounds}`}`
             :(isAm?`Round ${curRound+1} · AMRAP`:`Round ${curRound+1} of ${totalRounds}`);
  } else if(isAm){ stripDesc=`${(ex.roundsCustom||[]).length} stations · ${ex.capMin} min cap`; }
  else if(isSimple){ stripDesc=`${totalRounds} ${totalRounds===1?'round':'rounds'} · ${ex.workSec}s on / ${ex.restSec}s off`; }
  else { stripDesc=`${(ex.roundsCustom||[]).length} stations · ${totalRounds} ${totalRounds===1?'round':'rounds'}`; }

  const rb=!!(cur&&cur.roundRest)&&(isWork||isRest);
  let bigCls,counter,name,time,sub;
  const totalSec=segs.reduce((a,x)=>a+(x.duration||0),0)+(ex.setupSec||0);
  if(isIdle){
    bigCls='idle';
    counter=stripDesc+(ex.setupSec>0?` · ${ex.setupSec}s setup`:'');
    name=`<svg class="ws-play" viewBox="0 0 12 14"><path d="M1.6 1.4C1.6.5 2.6-.1 3.4.4l8 5.3c.8.5.8 1.7 0 2.2l-8 5.3c-.8.5-1.8-.1-1.8-1V1.4z"/></svg>START`;
    time=fmtMS(totalSec);
    sub='Tap to begin';
  } else if(isSetup){
    bigCls='setup'; counter='Get ready'; name=segs[0]?.label||'Get set';
    time=fmt(ex.phaseLeft); sub='Tap to pause';
  } else if(rb){
    bigCls='rbreak'; counter=`Round ${curRound+1} complete`; name='Round break';
    time=fmt(ex.phaseLeft); sub='Tap to pause';
  } else if(isWork||isRest){
    bigCls=ex.phase; counter=isAm?`Round ${curRound+1} · AMRAP`:`Round ${curRound+1} of ${totalRounds}`;
    name=isWork?((cur&&cur.label)||'Work'):'Rest';
    time=fmt(ex.phaseLeft); sub='Tap to pause';
  } else if(isPaused){
    bigCls='paused'; counter='Paused';
    const ps=ex._pausedPhase==='setup'?(segs[0]||{}):cur;
    name=(ps&&(ps.roundRest?'Round break':ps.label))||'Paused';
    time=fmt(ex.phaseLeft); sub='Tap to resume';
  } else {
    bigCls='done'; counter='Complete';
    name=isAm?`${ex._roundsDone||totalRounds} rounds`:'Circuit done';
    time=fmtMS((ex._workSecDone||0)+(ex._restSecDone||0)||totalSec);
    sub='Tap to restart';
  }

  let initPct;
  if(isIdle) initPct=1; else if(isDone) initPct=0;
  else if(isSetup) initPct=ex.phaseLeft/(ex.setupSec||1);
  else initPct=ex.phaseLeft/((cur&&cur.duration)||1);

  const nx=curIdx+1<segs.length?segs[curIdx+1]:null;
  let nl,nv,nc,nd;
  if(isIdle){ nl='First up'; nv=segs[0]?.label||'—'; nc='w'; nd=segs[0]?fmtMS(segs[0].duration):''; }
  else if(isDone||!nx){ nl='Next up'; nv='Finish'; nc=''; nd=''; }
  else {
    nl=rb?`Next · round ${nx.roundIdx+1}`:'Next up';
    if(nx.roundRest){ nv='Round break'; nc='rb'; }
    else if(nx.type==='work'){ nv=nx.label; nc='w'; }
    else { nv='Rest'; nc='r'; }
    nd=fmtMS(nx.duration);
  }
  return {segs,totalRounds,isSimple,isAm,isIdle,isDone,isPaused,isSetup,isWork,isRest,isActivePhase,
          curIdx,cur,curRound,stripDesc,bigCls,counter,name,time,sub,initPct,nl,nv,nc,nd,
          vpH,colStyle,slide,colHtml,totalSec,rb};
}

function renderHiitTimer(ex,ei){
  const st=wsHiitState(ex,ei);
  const skips=st.isActivePhase?`<div class="ws-skip l" onclick="event.stopPropagation();wsHiitSkip(${ei},-1)">‹</div><div class="ws-skip r" onclick="event.stopPropagation();wsHiitSkip(${ei},1)">›</div>`:'';
  return `<div class="phase-strip">
    <div class="phase-strip-label">
      <span>Circuit</span>
      <span class="phase-strip-rounds">${st.stripDesc}</span>
    </div>
    <div class="ws-strip-vp" style="height:${st.vpH}px">
      <div class="ws-strip-col${st.slide?' wsAnim':''}" style="${st.colStyle}">${st.colHtml}</div>
    </div>
    <div class="phase-big-display ${st.bigCls}" id="hp${ei}" onclick="hiitBadgeTap(${ei})">
      <svg class="phase-perimeter" id="hpsvg${ei}" preserveAspectRatio="none">
        <rect id="hpring${ei}" x="0.75" y="0.75" rx="13" ry="13" data-initpct="${st.initPct}"></rect>
      </svg>
      ${skips}
      <div class="phase-big-content">
        <div class="phase-round-counter" id="hpcounter${ei}">${st.counter}</div>
        <div class="phase-big-name" id="hpname${ei}">${st.name}</div>
        <div class="phase-big-time" id="hptime${ei}">${st.time}</div>
        <div class="phase-big-sub" id="hpsub${ei}">${st.sub}</div>
      </div>
    </div>
    <div class="ws-run-next"><span class="l">${st.nl}</span><span class="v ${st.nc}">${st.nv}</span><span class="d">${st.nd}</span></div>
    <div class="rest-section">
      <div class="rest-body" style="padding:10px 14px">
        <div class="rest-controls-row">
          <div class="rctrl flex${exSnd(ex,'interval')?' active':''}" onclick="toggleExSound(${ei})"><svg viewBox="0 0 13 13"><path d="M1 4.5h2l3-3v10L3 8.5H1V4.5z"/>${exSnd(ex,'interval')?'<path d="M8.5 4a3 3 0 0 1 0 5" stroke-linecap="round"/>':'<line x1="9" y1="4" x2="11" y2="6"/><line x1="11" y1="4" x2="9" y2="6"/>'}</svg><span>${exSnd(ex,'interval')?'Sound':'Muted'}</span></div>
          <div class="rctrl flex" onclick="wsOpenTakeover(${ei})"><svg viewBox="0 0 13 13"><path d="M2 5V2h3M11 8v3H8M8 2h3v3M5 11H2V8"/></svg><span>Full screen</span></div>
          ${(st.isWork||st.isRest||st.isPaused)?`<div class="hold-btn cancel" data-hold-action="hiitEndEarly" data-hold-ei="${ei}"><div class="hold-fill"></div><div class="hold-label"><div class="hold-icon"></div><span>End early</span></div></div>`:''}
        </div>
      </div>
    </div>
  </div>`;
}
