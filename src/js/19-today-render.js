
function renderAll(triggerShimmer){
  // Shimmer only triggers if both the request flag AND user preference allow it
  triggerShimmer=triggerShimmer&&settings.shimmer;
  if(slideAbort){slideAbort.abort();slideAbort=null;}
  Object.keys(restIntervals).forEach(k=>clearInterval(restIntervals[k]));restIntervals={};
  Object.keys(hiitIntervals).forEach(k=>clearInterval(hiitIntervals[k]));hiitIntervals={};
  Object.keys(activityIntervals).forEach(k=>clearInterval(activityIntervals[k]));activityIntervals={};

  const d=DAYS[curDay];
  const area=document.getElementById('scroll');
  // Ensure items[] exists and is in sync for this day. Defensive: covers any
  // edge case where a mutation path didn't run wsDayItemsBuild.
  wsDayItemsBuild(d);
  let html='';
  // Walk items[] in canonical order, dispatching each to the right card
  // renderer based on its kind tag. ei = index into items[]; all downstream
  // handlers resolve back to the instance via DAYS[curDay].items[ei].
  (d.items||[]).forEach((ex,ei)=>{
    const k=ex._itemKind||wsTagItemKind(ex);
    if(k==='weighted') html+=renderExCard(ex,ei,triggerShimmer);
    else               html+=renderCardioCard(ex,ei,triggerShimmer);
  });
  if(d.logged) html+=renderPostSession();
  else html+=renderSlide(triggerShimmer);
  area.innerHTML=html;
  bindSlide();
  // Size HIIT perimeter SVG rectangles to match their container
  requestAnimationFrame(()=>syncHiitPerimeters());
  // Restart any in-flight timers, indexed by items[] position
  (d.items||[]).forEach((ex,ei)=>{
    const k=ex._itemKind||wsTagItemKind(ex);
    if(k==='weighted'){
      if(ex.rs==='running') startRest(ei);
    } else if(k==='cardio_time' || k==='cardio_distance'){
      if(ex.rs==='running') startActivity(ei);
    } else if(k==='cardio_intervals'){
      if(ex.phase==='work'||ex.phase==='rest'||ex.phase==='setup') startHiit(ei);
    }
  });
  // Bind hold-to-confirm buttons (Done, Cancel, save-slider) after every render
  bindAllHoldButtons();
}

// Resolve a day exercise's display as a two-line headline/subheadline, matching
// the Library's ember-title + white-subtitle treatment. Prefers the catalog
// entry (by exId) for a clean title + display_subtitle; otherwise splits a
// trailing parenthetical (e.g. "DB Shoulder Press (seated)") out of the name so
// the parenthetical reads as a quiet subtitle rather than inline clutter.
function wsExDisplayParts(ex){
  // 1) catalog match by exId
  if(ex && ex.exId){
    const cat=(typeof EXERCISES!=='undefined') ? EXERCISES.find(e=>e.exId===ex.exId) : null;
    if(cat){
      const sub = cat.dsub || cat.display_subtitle || '';
      return {title:cat.title||ex.name||'', subtitle:sub};
    }
  }
  const nm=(ex&&ex.name)||'';
  // 2) " — " / " - " separator
  const split=wsSplitNameForCatalog(nm);
  if(split.subtitle) return split;
  // 3) trailing parenthetical → subtitle
  const m=nm.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if(m) return {title:m[1].trim(), subtitle:m[2].trim()};
  return {title:nm, subtitle:''};
}
// v49: once the day is logged, the last thing on screen is the effort rating.
// Session RPE is best captured right after the work, not reconstructed later.
// v50: once logged, show how the session stacked up against the last one like
// it. Uses the same content-matching as History, so it works on mixed and
// ad-hoc days where the day label means nothing.
function wsDayComparisonHtml(){
  const d=DAYS[curDay];
  if(!d||!d.logged) return '';
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const rec=hist.length?hist[hist.length-1]:null;
  if(!rec) return '';
  return wsCompareCardHtml(rec);
}
function wsDayEffortStrip(){
  const d=DAYS[curDay];
  if(!d||!d.logged) return '';
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let rec=null;
  for(let i=hist.length-1;i>=0;i--){
    const lbl=hist[i]&&(hist[i].dayLabel||hist[i].dayExId);
    if(lbl && d.label && String(lbl).indexOf(String(d.label).slice(0,12))===0){ rec=hist[i]; break; }
  }
  if(!rec) rec=hist[hist.length-1];
  if(!rec) return '';
  const se=wsSessionEffort(rec);
  return wsEffortStripHtml(rec.id, se?se.value:null, se?se.source:null);
}
function renderExCard(ex,ei,shimmer){
  const d=DAYS[curDay];
  const isAct=ei===0&&!d.logged;
  const canRemove=ex.sets.length>1;
  const shim=shimmer?' shimmer shimmer-small':'';
  const tint=exerciseTint(ex.name);
  const tintStyle=tint?` style="background:linear-gradient(180deg,${tint.bg},transparent 60%),var(--s1);border-color:${tint.border}"`:'';
  const _dp=wsExDisplayParts(ex);
  let html=`<div class="ex-card${isAct?' act':''}" data-ei="${ei}"${tintStyle}>
    <div class="ex-head"><span class="ex-name-wrap"><span class="ex-name">${wsEscape(_dp.title)}</span>${_dp.subtitle?`<span class="ex-name-sub">${wsEscape(_dp.subtitle)}</span>`:''}</span>
      <div class="set-pm${shim}">
        <div class="set-pm-btn${canRemove?'':' disabled'}" onclick="removeSet(${ei})"><svg viewBox="0 0 11 11"><line x1="2" y1="5.5" x2="9" y2="5.5"/></svg></div>
        <div class="set-pm-lbl">SET</div>
        <div class="set-pm-btn" onclick="addSet(${ei})"><svg viewBox="0 0 11 11"><line x1="5.5" y1="2" x2="5.5" y2="9"/><line x1="2" y1="5.5" x2="9" y2="5.5"/></svg></div>
      </div>
    </div>
    <div class="ex-cue">${ex.cue}</div>
    <div class="set-list">`;
  ex.sets.forEach((s,si)=>{
    const done=s._logged;
    const rowCls=done?'set-row done':'set-row';
    const rZero=!done&&s.r===0;
    // Each row: number · [− weight +] · × · [− reps +] · ember check.
    // Steppers nudge inline (weight ±1, reps ±1). Tapping a value opens the
    // existing slider sheet (openEdit) for typing / fine-tune / apply-to-all.
    // The check toggles the logged state (cellTap).
    html+=`<div class="${rowCls}" data-si="${si}">
      <span class="set-num">${si+1}</span>
      <div class="val-group">
        <button class="step-btn" onclick="event.stopPropagation();stepSetVal(${ei},${si},'w',-1)">−</button>
        <button class="val-tap" onclick="event.stopPropagation();openEdit(${ei},${si})"><span class="val-num">${fmtSetW(s.w)}</span><span class="val-unit">KG</span></button>
        <button class="step-btn" onclick="event.stopPropagation();stepSetVal(${ei},${si},'w',1)">+</button>
      </div>
      <span class="set-x">×</span>
      <div class="val-group">
        <button class="step-btn" onclick="event.stopPropagation();stepSetVal(${ei},${si},'r',-1)">−</button>
        <button class="val-tap" onclick="event.stopPropagation();openEdit(${ei},${si})"><span class="val-num${rZero?' zero':''}">${s.r}</span><span class="val-unit">REPS</span></button>
        <button class="step-btn" onclick="event.stopPropagation();stepSetVal(${ei},${si},'r',1)">+</button>
      </div>
      <button class="set-check" onclick="cellTap(${ei},${si})" aria-label="Mark set ${si+1} done"><svg viewBox="0 0 16 16"><polyline points="3,8 6.5,11.5 13,4.5"/></svg></button>
    </div>`;
  });
  html+=`</div>`+renderRestSection(ex,ei,'strength')+wsEffortStrip(ex,ei)+`</div>`;
  return html;
}

// Format a weight for the row display: drop the trailing .0 on whole numbers
// (20 not 20.0), keep the .5 on halves (20.5).
function fmtSetW(w){
  const n=Number(w)||0;
  return Number.isInteger(n)?String(n):n.toFixed(1);
}

// Inline stepper for a set's weight/reps. Weight steps by exactly 1 (halves
// preserved if already present — 20.5 → 21.5); reps step by 1 (integers).
// Mirrors the cellTap/openEdit hooks: writes the instance via items[] index.
function stepSetVal(ei,si,field,dir){
  // v53: once logged, captureSessionRecord has frozen a snapshot into HISTORY.
  // Mutating the on-screen day afterwards changed what you SAW without changing
  // what was RECORDED — the screen and the log silently disagreed. Corrections
  // after logging belong in History -> Fix this session, which edits the record.
  if(DAYS[curDay] && DAYS[curDay].logged){
    if(typeof wsToastMsg==='function') wsToastMsg('Already logged — fix it in History');
    return;
  }
  const ex=DAYS[curDay].items[ei];
  if(!ex||!ex.sets||!ex.sets[si]) return;
  const set=ex.sets[si];
  if(field==='w'){
    let w=Number(set.w)||0;
    w=Math.max(0,w+dir); // step of exactly 1, never below 0
    set.w=w;
  } else {
    let r=Number(set.r)||0;
    r=Math.max(0,r+dir);
    set.r=r;
  }
  playKnock();
  renderAll(false);
  wsPersistSave();
}
