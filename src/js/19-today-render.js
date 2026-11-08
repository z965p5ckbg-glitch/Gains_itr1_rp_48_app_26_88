
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
  let html=wsWorkoutProgressHtml(d);
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
  // v57: the rest timer docks above the tab bar when its exercise scrolls away
  wsRestDockBind(); wsRestDockUpdate();
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
// v57: the workout screen. Every set of every exercise stays on screen and the
// whole session scrolls as one page (no per-exercise focus mode), because that
// is what supersets need: you move between exercises without losing your place.
// Each exercise marks ITS next set (the first one not yet ticked): that row gets
// the steppers and the ember check; the others are quiet one-line rows. Ticking
// moves the mark on; when every set is done the exercise goes quiet. The rest
// timer appears inline, directly under the set you just ticked (wsRestInline).
function renderExCard(ex,ei,shimmer){
  const d=DAYS[curDay];
  const logged=!!d.logged;
  const next=logged?-1:wsNextSetIdx(ex);
  const complete=(ex.sets||[]).length>0 && (ex.sets||[]).every(s=>s._logged);
  const _dp=wsExDisplayParts(ex);
  const ss=wsSsInfo(ei);
  const idx=ss?ss.letter+ss.pos:String(ei+1).padStart(2,'0');
  const last=wsLastPerf(ex);
  let html='';
  if(ss && ss.pos===1) html+=`<div class="fk-ss-head"><span>${ss.size>2?'GIANT SET':'SUPERSET'} ${ss.letter}</span><i></i><span>REST AFTER ${ss.letter}${ss.size}</span></div>`;
  html+=`<div class="ex-card fk${complete?' fk-done':''}${ss?' fk-ss fk-ss-'+(ss.pos===1?'first':(ss.pos===ss.size?'last':'mid')):''}" data-ei="${ei}">
    <div class="fk-head">
      <span class="fk-name-wrap"><span class="fk-name">${wsEscape(_dp.title)}</span>${_dp.subtitle?`<span class="fk-sub">${wsEscape(_dp.subtitle)}</span>`:''}</span>
      <span class="fk-idx">${complete?'DONE · ':''}${idx}</span>
    </div>
    <div class="fk-last">${last?wsEscape(last.text):'No earlier sessions'}</div>
    ${ex.cue?`<div class="ex-cue fk-cue">${wsEscape(ex.cue)}</div>`:''}
    <div class="fk-segs" aria-hidden="true">${(ex.sets||[]).map((s,si)=>`<span class="fk-seg${s._logged?' done':(si===next?' next':'')}"></span>`).join('')}</div>
    <div class="set-list fk-list">`;
  ex.sets.forEach((s,si)=>{
    const done=!!s._logged;
    const wTxt=wsSetWText(ex,s);
    if(si===next){
      html+=`<div class="set-row fk-active" data-si="${si}">
        <span class="set-num">${si+1}</span>
        <div class="val-group">
          <button class="step-btn" aria-label="Less weight" onclick="event.stopPropagation();stepSetVal(${ei},${si},'w',-1)">−</button>
          <button class="val-tap" onclick="event.stopPropagation();openEdit(${ei},${si})"><span class="val-num${wTxt.length>4?' long':''}">${wTxt}</span><span class="val-unit">KG</span></button>
          <button class="step-btn" aria-label="More weight" onclick="event.stopPropagation();stepSetVal(${ei},${si},'w',1)">+</button>
        </div>
        <div class="val-group">
          <button class="step-btn" aria-label="One rep fewer" onclick="event.stopPropagation();stepSetVal(${ei},${si},'r',-1)">−</button>
          <button class="val-tap" onclick="event.stopPropagation();openEdit(${ei},${si})"><span class="val-num${!s.r?' zero':''}">${s.r}</span><span class="val-unit">REPS</span></button>
          <button class="step-btn" aria-label="One rep more" onclick="event.stopPropagation();stepSetVal(${ei},${si},'r',1)">+</button>
        </div>
        <button class="set-check" onclick="cellTap(${ei},${si})" aria-label="Mark set ${si+1} done"><svg viewBox="0 0 16 16"><polyline points="3,8 6.5,11.5 13,4.5"/></svg></button>
      </div>`;
    } else {
      // Quiet row. Weight and reps stay separately tappable (they open the set
      // sheet), and the check still works out of order.
      html+=`<div class="set-row fk-quiet${done?' done':''}${s.warmup?' warm':''}" data-si="${si}">
        <span class="set-num">${si+1}</span>
        <button class="val-tap fk-v" onclick="event.stopPropagation();openEdit(${ei},${si})">${wTxt}<span class="fk-u">kg</span></button>
        <span class="fk-x">×</span>
        <button class="val-tap fk-v fk-r" onclick="event.stopPropagation();openEdit(${ei},${si})">${s.r}</button>
        <span class="fk-fill"></span>
        <button class="set-check" onclick="cellTap(${ei},${si})" aria-label="${done?'Undo set '+(si+1):'Mark set '+(si+1)+' done'}"><svg viewBox="0 0 16 16"><polyline points="3,8 6.5,11.5 13,4.5"/></svg></button>
      </div>`;
    }
    if(!logged && ex._restRow===si && (ex.rs==='running'||ex.rs==='paused'||ex.rs==='ready'||ex.rs==='idle')) html+=wsRestInline(ex,ei);
  });
  html+=`</div>`;
  if(!logged){
    const n=(ex.sets||[]).length;
    const nextIsWeighted=(()=>{ const it=DAYS[curDay].items[ei+1]; return !!it && (it._itemKind||wsTagItemKind(it))==='weighted'; })();
    html+=`<div class="fk-foot">
      <div class="fk-setstep" role="group" aria-label="Number of sets">
        <button class="fk-ss-btn" onclick="removeSet(${ei})" aria-label="Remove the last set"${n<=1?' disabled':''}>−</button>
        <span class="fk-setn"><b>${n}</b> ${n===1?'SET':'SETS'}</span>
        <button class="fk-ss-btn" onclick="addSet(${ei})" aria-label="Add a set">+</button>
      </div>
      ${nextIsWeighted||ex.ss?`<button class="fk-pair${ex.ss?' on':''}" onclick="wsTogglePair(${ei})" aria-pressed="${ex.ss?'true':'false'}">${ex.ss?'Paired with next':'Pair with next'}</button>`:''}
    </div>`;
  }
  html+=wsEffortStrip(ex,ei)+`</div>`;
  return html;
}

// Format a weight for the row display: drop the trailing .0 on whole numbers
// (20 not 20.0), keep the .5 on halves (20.5).
function fmtSetW(w){
  // v59: up to two decimals, so quarter-kilo steps show exactly (70.75, not 70.8)
  const n=Math.round((Number(w)||0)*100)/100;
  return String(n);
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
  wsMarkTouched(set);
  if(field==='w'){
    // v58: one tap moves by this exercise's weight step (wsWStep), never below 0
    const step=wsWStep(ex);
    let w=Number(set.w)||0;
    w=Math.max(0,Math.round((w+dir*step)*100)/100);
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
