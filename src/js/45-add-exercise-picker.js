
// ─── Add-Exercise picker ───────────────────────────────────────────────
//
// Opens from inside the day editor. Multi-select rows from the (non-archived)
// library; on commit, the selected catalog entries are cloned into the day
// as new instances. Each new instance gets:
//   - exId reference to the catalog entry (for cross-day tracking)
//   - title/subtitle snapshot as the instance's display name (instances are
//     independent of the library going forward — see the no-propagation policy)
//   - defaults copied (cue, rest, sets for weighted; duration/intensity/etc.
//     for cardio kinds)

let wsPkState=null; // {dayIdx, selected:Set<exId>, search:''}

// Open the picker. If called without args, falls back to wsDayEditCtx.dayIdx
// (from the Workshop day editor) or curDay (from the live Today view).
function openWsPicker(targetDayIdx){
  let dayIdx;
  if(typeof targetDayIdx==='number') dayIdx=targetDayIdx;
  else if(wsDayEditCtx) dayIdx=wsDayEditCtx.dayIdx;
  else if(typeof curDay==='number') dayIdx=curDay;
  else return;
  if(!DAYS[dayIdx]) return;
  wsPkState={
    dayIdx,
    selected:new Set(),
    search:'',
  };
  document.getElementById('wsPkSearchInput').value='';
  document.getElementById('wsPkSearchClear').classList.remove('visible');
  wsPkRender();
  wsPkUpdateAddBtn();
  document.getElementById('wsPickerModal').classList.add('open');
  wsLogPush('picker_open',{dayIdx:wsPkState.dayIdx});
}

// Open the library editor in 'fromDay' creation mode from inside the picker.
// Dismisses the picker first (the user has shifted intent from picking to
// creating), then routes to wsLibCreateNew with the same target day.
function wsPkOpenCreateNew(){
  if(!wsPkState) return;
  const dayIdx=wsPkState.dayIdx;
  wsLogPush('picker_to_create_new',{dayIdx});
  wsPkState=null;
  document.getElementById('wsPickerModal').classList.remove('open');
  // Small delay so the picker dismiss animation completes before the editor opens
  setTimeout(()=>{ wsLibCreateNew({fromDayIdx:dayIdx}); },220);
}

function closeWsPicker(){
  if(!wsPkState) return;
  wsLogPush('picker_cancel',{selected:wsPkState.selected.size});
  wsPkState=null;
  document.getElementById('wsPickerModal').classList.remove('open');
}

function wsPkOnSearchInput(v){
  if(!wsPkState) return;
  wsPkState.search=v;
  const clear=document.getElementById('wsPkSearchClear');
  if(clear) clear.classList.toggle('visible',!!v);
  // Re-render without losing focus
  const input=document.getElementById('wsPkSearchInput');
  const caret=input?input.selectionStart:null;
  wsPkRender();
  const newInput=document.getElementById('wsPkSearchInput');
  if(newInput && document.activeElement!==newInput){
    newInput.focus();
    if(caret!=null){try{newInput.setSelectionRange(caret,caret);}catch(_){}}
  }
}

function wsPkClearSearch(){
  if(!wsPkState) return;
  wsPkState.search='';
  document.getElementById('wsPkSearchInput').value='';
  document.getElementById('wsPkSearchClear').classList.remove('visible');
  wsPkRender();
}

// Filter active (non-archived) catalog by the picker's search query.
function wsPkFilter(){
  const q=(wsPkState.search||'').trim().toLowerCase();
  const active=EXERCISES.filter(e=>!e.archived);
  if(!q) return active.slice();
  return active.filter(e=>{
    const t=(e.title||'').toLowerCase();
    const s=(e.subtitle||'').toLowerCase();
    return t.indexOf(q)>=0 || s.indexOf(q)>=0;
  });
}

// Render the list of catalog entries. Groups by title (matching the library's
// default grouping); selected rows show a check indicator.
function wsPkRender(){
  if(!wsPkState) return;
  const list=wsPkFilter();
  const body=document.getElementById('wsPkBody');
  if(!list.length){
    const msg=wsPkState.search
      ? `No exercises match "${wsLibEscapeHtml(wsPkState.search)}"`
      : `Your library is empty. Create exercises in the Library tab first.`;
    body.innerHTML=`<div class="ws-pk-empty">${msg}</div>`;
    return;
  }
  // Group by title (siblings shown together, alphabetical otherwise)
  const sorted=list.slice().sort(wsLibSort);
  // Build a flat list of rows. Since the picker is a one-shot interaction
  // (the user picks and commits), we don't need collapsible groups — just
  // a clean alphabetical scroll with visual title clustering implicit.
  let html='';
  let lastTitle=null;
  for(const e of sorted){
    const titleKey=(e.title||'').toLowerCase();
    // Insert a small section divider when title changes (except for the first)
    if(titleKey!==lastTitle && lastTitle!==null){
      // nothing extra — entries naturally adjacent by sort
    }
    lastTitle=titleKey;
    const isSelected=wsPkState.selected.has(e.exId);
    html+=`<div class="ws-pk-row ${isSelected?'selected':''}" data-ex-id="${wsLibEscapeHtml(e.exId)}" onclick="wsPkToggle('${wsLibEscapeHtml(e.exId)}')">
      <div class="ws-pk-row-text">
        <div class="ws-pk-row-title">${wsLibEscapeHtml(e.title||'(untitled)')}</div>
        <div class="ws-pk-row-sub">${wsLibEscapeHtml(e.subtitle||'')}</div>
      </div>
      <div class="ws-pk-check"><svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3"/></svg></div>
    </div>`;
  }
  body.innerHTML=html;
}

// Toggle a selection. Re-renders just that row to avoid full re-render
// (better tap feedback when toggling many in succession).
function wsPkToggle(exId){
  if(!wsPkState) return;
  if(wsPkState.selected.has(exId)) wsPkState.selected.delete(exId);
  else wsPkState.selected.add(exId);
  // Re-render just the affected row + the Add button
  const row=document.querySelector(`.ws-pk-row[data-ex-id="${exId}"]`);
  if(row) row.classList.toggle('selected',wsPkState.selected.has(exId));
  wsPkUpdateAddBtn();
}

// Update the sticky Add button label + enabled state based on selection count
// and the target day's display name.
function wsPkUpdateAddBtn(){
  if(!wsPkState) return;
  const btn=document.getElementById('wsPkAddBtn');
  const n=wsPkState.selected.size;
  const day=DAYS[wsPkState.dayIdx];
  const dayName=day ? (wsLibDayDisplayName(day) || day.label || `Day ${wsPkState.dayIdx+1}`) : 'day';
  if(n===0){
    btn.textContent=`Add to ${dayName}`;
    btn.disabled=true;
    btn.classList.add('empty');
  } else {
    btn.innerHTML=`<span>Add ${n}</span><span class="day">to ${wsLibEscapeHtml(dayName)}</span>`;
    btn.disabled=false;
    btn.classList.remove('empty');
  }
}

// Commit: append a new instance to the day for each selected catalog entry.
function wsPkCommit(){
  if(!wsPkState) return;
  if(!wsPkState.selected.size) return;
  const day=DAYS[wsPkState.dayIdx];
  if(!day){ closeWsPicker(); return; }
  let addedWeighted=0, addedCardio=0;
  if(!Array.isArray(day.items)) day.items=[];
  for(const exId of wsPkState.selected){
    const cat=EXERCISES.find(e=>e.exId===exId);
    if(!cat) continue;
    const inst=wsPkBuildInstance(cat); // already iid-stamped + kind-tagged
    // items[] is the single source of truth: append here only.
    day.items.push(inst);
    if(cat.kind==='weighted') addedWeighted++; else addedCardio++;
  }
  // Rebuild the derived exercises[]/cardio[] views from items[] once.
  wsDayItemsSync(day);
  const total=addedWeighted+addedCardio;
  wsLogPush('picker_commit',{dayIdx:wsPkState.dayIdx,added:total});
  wsPkState=null;
  document.getElementById('wsPickerModal').classList.remove('open');
  // Re-render the day editor's exercises list if open
  if(wsDayEditCtx) { try{ wsDeRenderExList(); }catch(_){} }
  // Re-render the live view too (the change might have happened in either context)
  try{ renderAll(false); }catch(_){}
  // Toast feedback
  const dayName=wsLibDayDisplayName(day)||day.label||'';
  wsToast(`Added ${total} to ${dayName}`);
  wsPersistSave();
}

// Build a new day-instance from a catalog entry, snapshotting all the
// values the instance needs to operate independently afterwards.
function wsPkBuildInstance(cat){
  // Build the raw instance, then stamp a unique iid before returning so every
  // newly-created instance carries its own identity from birth.
  const inst=wsPkBuildInstanceRaw(cat);
  wsEnsureIid(inst);
  wsTagItemKind(inst, cat.kind==='weighted' ? 'weighted' : null);
  return inst;
}

function wsPkBuildInstanceRaw(cat){
  const def=cat.defaults||{};
  // Display name: title + subtitle joined; falls back to title alone.
  const displayName=cat.subtitle?`${cat.title} — ${cat.subtitle}`:cat.title;
  if(cat.kind==='weighted'){
    return {
      exId:cat.exId,
      name:displayName,
      cue:def.cue||'',
      sets:(def.sets||[]).map(s=>({w:s.w,r:s.r})),
      rest:def.rest||90,
      rl:def.rest||90,
      rs:'idle',
      rv:0,
      sound:false,
    };
  }
  if(cat.kind==='cardio_time'){
    return {
      exId:cat.exId,
      kind:'time',
      name:displayName,
      cue:def.cue||'',
      duration:def.duration||300,
      intensity:def.intensity||'Mod',
      icon:def.icon||'',
      rl:def.duration||300,
      rs:'idle',
      // Cardio added to a Day is immediately usable: the live timer IS the
      // primary interaction here, so it shows expanded (rv:true) rather than
      // collapsing to a "Show" stub. (Weighted stays collapsed — its sets are
      // always visible; only the rest timer is gated. Intervals: own iteration.)
      rv:true,
      logged:false,
    };
  }
  if(cat.kind==='cardio_distance'){
    return {
      exId:cat.exId,
      kind:'distance',
      name:displayName,
      cue:def.cue||'',
      distance:def.distance||5,
      duration:def.duration||1800,
      icon:def.icon||'',
      rl:def.duration||1800,
      rs:'idle',
      // See cardio_time above: immediately usable in a Day (timer is the
      // primary interaction). Matches the seeded rowing item's rv:true.
      rv:true,
      logged:false,
    };
  }
  if(cat.kind==='cardio_intervals'){
    return {
      exId:cat.exId,
      kind:'intervals',
      name:displayName,
      cue:def.cue||'',
      workSec:def.workSec||30,
      restSec:def.restSec||15,
      totalRounds:def.totalRounds||4,
      roundRest:def.roundRest||0,
      amrap:def.amrap||false,
      capMin:def.capMin||0,
      setupSec:def.setupSec||0,
      simpleMode:def.simpleMode!==false,
      roundsCustom:(def.roundsCustom||[]).map(r=>({name:r.name,work:r.work,rest:r.rest})),
      icon:def.icon||'kettlebell',
      rounds:0,
      phase:'idle',
      phaseIdx:0,
      logged:false,
    };
  }
  // Fallback (shouldn't happen — every catalog entry has a known kind)
  return {exId:cat.exId,name:displayName};
}
