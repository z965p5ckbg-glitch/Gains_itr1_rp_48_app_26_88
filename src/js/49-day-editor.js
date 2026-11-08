
// ──────────── Toast ────────────

let wsToastTimer=null;
function wsToast(msg){
  wsLogPush('toast',{msg});
  const el=document.getElementById('wsToast');
  el.textContent=msg;
  el.classList.add('visible');
  clearTimeout(wsToastTimer);
  wsToastTimer=setTimeout(()=>el.classList.remove('visible'),2500);
}

// ──────────── Day editor (minimal — Batch B) ────────────

function openWsDayEdit(dayIdx,isNew){
  wsLogPush('open_day_editor',{dayIdx,isNew});
  const d=DAYS[dayIdx];
  if(!d) return;
  wsDayEditCtx={
    dayIdx,
    isNew:!!isNew,
    originalTitleHtml:d.titleHtml,
    originalLabel:d.label,
    originalPublished:d.published!==false,
    pendingPublished:d.published!==false,
  };
  // Parse titleHtml back into two lines: e.g. "Push<br><em>Day</em>" → line1="Push", line2="Day"
  const m=d.titleHtml.match(/^([^<]*)<br><em>(.*?)<\/em>$/);
  document.getElementById('wsDeTitle1').value=m?m[1]:d.titleHtml.replace(/<[^>]+>/g,'').trim();
  document.getElementById('wsDeTitle2').value=m?m[2]:'';
  document.getElementById('wsDeLabel').value=d.label;
  document.getElementById('wsDeTitle').textContent=isNew?'New workout':'Edit workout';
  wsDeRenderStatusToggle();
  wsDeRenderExList();
  document.getElementById('wsDayEditModal').classList.add('open');
}

// Render the day's exercises in the editor sheet. Read-only display
// for v1 — instances are listed with their name + a brief meta line.
// Below the list, a "+ Add Exercise" button opens the picker.
function wsDeRenderExList(){
  if(!wsDayEditCtx) return;
  const d=DAYS[wsDayEditCtx.dayIdx];
  if(!d) return;
  // Ensure items[] exists and is in sync (defensive — covers edge cases
  // where mutation paths haven't been fully migrated).
  wsDayItemsBuild(d);
  // Walk items[] in canonical order. For each item, compute its current
  // index in the legacy arrays so the existing reorder/remove handlers
  // (which still look up via list+origIdx) can resolve it correctly.
  const all=(d.items||[]).map(ex=>{
    const k=wsTagItemKind(ex);
    const inLegacyEx = (d.exercises||[]).indexOf(ex);
    const inLegacyCd = (d.cardio||[]).indexOf(ex);
    if(inLegacyEx>=0) return {ex,kind:k,list:'exercises',origIdx:inLegacyEx};
    if(inLegacyCd>=0) return {ex,kind:k,list:'cardio',origIdx:inLegacyCd};
    return null;
  }).filter(Boolean);
  let html='';
  const ssG=wsSsGroups(d.items||[]);
  if(all.length===0){
    html+=`<div class="ws-de-exempty">No exercises yet</div>`;
  } else {
    html+=`<div class="ws-de-exlist" id="wsDeExListInner">`;
    all.forEach((entry,idx)=>{
      const {ex,kind,list,origIdx}=entry;
      // Look up catalog entry by exId; fall back to the instance's own name.
      let title=ex.name||'';
      let subtitle='';
      let meta='';
      const cat=ex.exId?EXERCISES.find(c=>c.exId===ex.exId):null;
      if(cat){
        title=cat.title||ex.name||'';
        subtitle=cat.subtitle||'';
      } else {
        const parts=wsLibSplitNameForCatalog(ex.name||'');
        title=parts.title;
        subtitle=parts.subtitle;
      }
      // Build a short meta line
      if(kind==='weighted'){
        const setCount=(ex.sets||[]).length;
        const reps=ex.sets&&ex.sets[0]?ex.sets[0].r:'';
        meta=setCount>0?`${setCount} × ${reps}`:'';
      } else if(kind==='time'||kind==='cardio_time'){
        const dur=ex.duration||0;
        meta=`${Math.round(dur/60)} min`;
      } else if(kind==='distance'||kind==='cardio_distance'){
        meta=`${ex.distance||0} km`;
      } else if(kind==='intervals'||kind==='cardio_intervals'){
        meta=`${ex.totalRounds||0}×`;
      }
      // v61: supersets in the editor. A1/A2 on grouped rows; the link button
      // pairs this exercise with the one below (drag to choose which).
      const ii=(d.items||[]).indexOf(ex), g=ii>=0?ssG[ii]:null;
      const nextIt=ii>=0?(d.items||[])[ii+1]:null;
      const canLink=kind==='weighted' && (wsIsWeighted(nextIt) || !!ex.ss);
      const linked=!!(g && g.pos<g.size);
      const linkBtn=canLink?`<button class="ws-de-link${linked?' on':''}" onclick="wsDeToggleLink(${idx},event)" aria-pressed="${linked}" aria-label="${linked?'Unlink from the exercise below':'Superset with the exercise below'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>${linked?'':'<line x1="4" y1="4" x2="7" y2="7"/><line x1="17" y1="17" x2="20" y2="20"/>'}</svg></button>`:'';
      html+=`<div class="ws-de-exrow${g?' ws-de-ss-row ws-de-ss-'+(g.pos===1?'first':(g.pos===g.size?'last':'mid')):''}" data-row-idx="${idx}" data-list="${list}" data-orig-idx="${origIdx}">
        <div class="ws-de-exrow-grip" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="ws-de-exrow-text">
          <div class="ws-de-exrow-title">${wsLibEscapeHtml(title||'(unnamed)')}</div>
          <div class="ws-de-exrow-sub">${g?`<span class="ws-de-ss">${g.letter}${g.pos}</span>${subtitle?' · ':''}`:''}${wsLibEscapeHtml(subtitle)}</div>
        </div>
        <div class="ws-de-exrow-meta">${wsLibEscapeHtml(meta)}</div>
        ${linkBtn}
        <button class="ws-de-exrow-wrench" onclick="wsDeOpenInstanceEditor(${idx},event)" aria-label="Edit exercise">
          <svg viewBox="0 0 16 16"><path d="M11 1.6 a 3.4 3.4 0 0 0 -2.42 5.78 l -6.78 6.78 a 1.4 1.4 0 0 0 0 1.98 a 1.4 1.4 0 0 0 1.98 0 l 6.78 -6.78 a 3.4 3.4 0 0 0 4.84 -3.78 l -2.12 2.12 a 1.4 1.4 0 0 1 -1.98 -1.98 z"/></svg>
        </button>
        <button class="ws-de-exrow-remove" onclick="wsDeRemoveExercise(${idx},event)" aria-label="Remove exercise">×</button>
      </div>`;
    });
    html+=`</div>`;
  }
  html+=`<div class="ws-de-addex-row">
    <button class="ws-de-addex-btn" onclick="openWsPicker()"><span style="font-size:16px;line-height:1">+</span><span>From Library</span></button>
    <button class="ws-de-addex-btn" onclick="wsDeCreateNewExercise()"><span style="font-size:16px;line-height:1">+</span><span>New Exercise</span></button>
  </div>`;
  document.getElementById('wsDeExList').innerHTML=html;
  wsDeBindRowDrag();
}

// Reusable name-split helper alias (we defined wsSplitNameForCatalog earlier
// when migrating — this avoids name confusion; the picker also uses it).
function wsLibSplitNameForCatalog(s){ return wsSplitNameForCatalog(s); }

// ─── Day editor exercise list: remove + reorder ───────────────────────
//
// Each row has a small × button to remove and supports long-press drag to
// reorder. Reorder uses a FLIP-style animation pattern: measure rects, mutate
// DOM/array, measure new rects, apply inverse transforms, then release with
// transition for the visual glide. Same pattern as the workshop drag engine,
// but single-axis (Y only).

const WS_DE_LONGPRESS_MS=250;
const WS_DE_DRAG_THRESHOLD_PX=6;

let _wsDeDragState=null;

// Remove an exercise from the day. rowIdx is the unified-list index.
// Open the instance editor for a specific row in the day editor. Resolves
// which list (exercises[] or cardio[]) and original index via the row's DOM
// data attrs, then hands off to wsLibOpenInstanceEditor.
function wsDeOpenInstanceEditor(rowIdx,evt){
  if(evt){ evt.stopPropagation(); }
  if(!wsDayEditCtx) return;
  const rowEl=document.querySelector(`.ws-de-exrow[data-row-idx="${rowIdx}"]`);
  if(!rowEl) return;
  const list=rowEl.dataset.list;
  const origIdx=parseInt(rowEl.dataset.origIdx,10);
  wsLibOpenInstanceEditor(wsDayEditCtx.dayIdx,list,origIdx);
}

// Create a brand-new exercise from inside the day editor. Opens the library
// editor in 'fromDay' mode; on Save, the entry is added to the library AND
// an instance is added to this day.
function wsDeCreateNewExercise(){
  if(!wsDayEditCtx) return;
  wsLibCreateNew({fromDayIdx:wsDayEditCtx.dayIdx});
}

// Remove an exercise from the day. rowIdx is the unified-list index.
function wsDeRemoveExercise(rowIdx,evt){
  if(evt){ evt.stopPropagation(); }
  if(!wsDayEditCtx) return;
  const d=DAYS[wsDayEditCtx.dayIdx];
  if(!d) return;
  const rowEl=document.querySelector(`.ws-de-exrow[data-row-idx="${rowIdx}"]`);
  if(!rowEl) return;
  const list=rowEl.dataset.list;
  const origIdx=parseInt(rowEl.dataset.origIdx,10);
  const arr = list==='exercises' ? d.exercises : d.cardio;
  if(!arr || !arr[origIdx]) return;
  const ex=arr[origIdx];
  const name=ex.name||'(unnamed)';
  // Native confirm — removing from a day is recoverable (re-add via picker).
  if(!confirm(`Remove "${name}" from this workout?`)) return;
  // Remove from items[] AND the legacy arrays in one shot, by reference.
  wsDayRemoveInstance(d, ex);
  wsLogPush('day_remove_exercise',{dayIdx:wsDayEditCtx.dayIdx,list,name});
  wsDeRenderExList();
  // Live view may also need refreshing if the current day was modified
  try{ renderAll(false); }catch(_){}
  wsPersistSave();
  wsToast(`${name} removed`);
}

function wsDeToggleLink(rowIdx,evt){
  if(evt) evt.stopPropagation();
  if(!wsDayEditCtx) return;
  const d=DAYS[wsDayEditCtx.dayIdx]; if(!d) return;
  const rowEl=document.querySelector(`.ws-de-exrow[data-row-idx="${rowIdx}"]`); if(!rowEl) return;
  const arr=rowEl.dataset.list==='exercises'?d.exercises:d.cardio;
  const ex=arr&&arr[parseInt(rowEl.dataset.origIdx,10)]; if(!ex) return;
  const i=(d.items||[]).indexOf(ex); if(i<0) return;
  if(ex.ss) delete ex.ss; else if(wsIsWeighted(d.items[i+1])) ex.ss=true;
  wsLogPush('day_toggle_superset',{dayIdx:wsDayEditCtx.dayIdx});
  wsDeRenderExList();
  try{ renderAll(false); }catch(_){}
  wsPersistSave();
}
function wsDeBindRowDrag(){
  const rows=document.querySelectorAll('#wsDeExListInner .ws-de-exrow');
  rows.forEach(row=>{
    row.addEventListener('pointerdown',wsDePointerDown,{passive:false});
  });
}

function wsDePointerDown(e){
  if(e.target.closest('.ws-de-exrow-remove,.ws-de-link')) return;
  if(_wsDeDragState) return;

  const row=e.currentTarget;
  const rowIdx=parseInt(row.dataset.rowIdx,10);
  const pt=e.touches?e.touches[0]:e;
  const startY=pt.clientY;
  const startX=pt.clientX;

  const list=document.getElementById('wsDeExListInner');
  if(!list) return;

  _wsDeDragState={
    startY, startX, currentY:startY,
    rowEl:row, rowIdx,
    lifted:false, hasMoved:false,
    listEl:list,
    longPressTimer:null,
    cleanup:null,
  };

  _wsDeDragState.longPressTimer=setTimeout(()=>{
    if(!_wsDeDragState) return;
    if(_wsDeDragState.hasMoved) return;
    wsDeLiftRow();
  },WS_DE_LONGPRESS_MS);

  const onMove=ev=>wsDePointerMove(ev);
  const onUp=ev=>wsDePointerUp(ev);
  const onCancel=ev=>wsDePointerCancel(ev);
  window.addEventListener('pointermove',onMove,{passive:false});
  window.addEventListener('pointerup',onUp,{passive:false});
  window.addEventListener('pointercancel',onCancel,{passive:false});

  _wsDeDragState.cleanup=()=>{
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    window.removeEventListener('pointercancel',onCancel);
  };
}

function wsDeLiftRow(){
  const ds=_wsDeDragState;
  if(!ds) return;
  ds.lifted=true;
  ds.rowEl.classList.add('lifted');
  try{ if(navigator.vibrate) navigator.vibrate(8); }catch(_){}
  ds.liftStartY=ds.currentY;
  ds.translateY=0;
}

function wsDePointerMove(e){
  const ds=_wsDeDragState;
  if(!ds) return;
  const pt=e.touches?e.touches[0]:e;
  ds.currentY=pt.clientY;

  if(!ds.lifted){
    const dy=Math.abs(ds.currentY-ds.startY);
    const dx=Math.abs(pt.clientX-ds.startX);
    if(dy>WS_DE_DRAG_THRESHOLD_PX||dx>WS_DE_DRAG_THRESHOLD_PX){
      ds.hasMoved=true;
      if(ds.longPressTimer){ clearTimeout(ds.longPressTimer); ds.longPressTimer=null; }
      wsDeEndDrag(false);
    }
    return;
  }

  if(e.cancelable) e.preventDefault();
  const dy=ds.currentY-ds.liftStartY;
  ds.translateY=dy;
  ds.rowEl.style.transform=`translateY(${dy}px) scale(1.03)`;
  wsDeMaybeSwap();
}

function wsDePointerUp(e){
  const ds=_wsDeDragState;
  if(!ds) return;
  if(ds.lifted) wsDeEndDrag(true);
  else wsDeEndDrag(false);
}

function wsDePointerCancel(e){
  wsDeEndDrag(false);
}

function wsDeMaybeSwap(){
  const ds=_wsDeDragState;
  if(!ds || !ds.lifted) return;
  const now=Date.now();
  if(ds._swapCooldown && now-ds._swapCooldown<150) return;

  const rowRect=ds.rowEl.getBoundingClientRect();
  const liftedMidY=rowRect.top+rowRect.height/2;
  const siblings=Array.from(ds.listEl.querySelectorAll('.ws-de-exrow')).filter(r=>r!==ds.rowEl);
  for(const sib of siblings){
    const sibRect=sib.getBoundingClientRect();
    const sibMid=sibRect.top+sibRect.height/2;
    const margin=sibRect.height*0.18;
    const sibIsBelow = (ds.rowEl.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING)!==0;
    if(sibIsBelow){
      if(liftedMidY>sibMid+margin){
        wsDePerformSwap(sib,'after');
        ds._swapCooldown=now;
        return;
      }
    } else {
      if(liftedMidY<sibMid-margin){
        wsDePerformSwap(sib,'before');
        ds._swapCooldown=now;
        return;
      }
    }
  }
}

function wsDePerformSwap(sibling,position){
  const ds=_wsDeDragState;
  if(!ds) return;

  const liftedBefore=ds.rowEl.getBoundingClientRect();
  const sibBefore=sibling.getBoundingClientRect();

  if(position==='before') sibling.parentNode.insertBefore(ds.rowEl,sibling);
  else                    sibling.parentNode.insertBefore(ds.rowEl,sibling.nextSibling);

  // Reset translate momentarily to measure natural new position, then re-apply
  ds.rowEl.style.transform='';
  const liftedAfter=ds.rowEl.getBoundingClientRect();
  const liftedDeltaY=liftedBefore.top-liftedAfter.top;
  ds.liftStartY+=liftedDeltaY;
  ds.translateY=ds.currentY-ds.liftStartY;
  ds.rowEl.style.transform=`translateY(${ds.translateY}px) scale(1.03)`;

  // Animate the displaced sibling from its old position to its new one
  const sibAfter=sibling.getBoundingClientRect();
  const sibDeltaY=sibBefore.top-sibAfter.top;
  if(sibDeltaY!==0){
    sibling.classList.add('flipping');
    sibling.style.transform=`translateY(${sibDeltaY}px)`;
    void sibling.offsetWidth;
    sibling.classList.remove('flipping');
    sibling.style.transform='';
  }
}

function wsDeEndDrag(commit){
  const ds=_wsDeDragState;
  if(!ds) return;
  if(ds.longPressTimer){ clearTimeout(ds.longPressTimer); ds.longPressTimer=null; }
  if(ds.cleanup) ds.cleanup();

  if(ds.lifted){
    const rowEl=ds.rowEl;
    rowEl.style.transition='transform .22s cubic-bezier(.32,.72,0,1)';
    rowEl.style.transform='translateY(0) scale(1)';
    setTimeout(()=>{
      rowEl.classList.remove('lifted');
      rowEl.style.transform='';
      rowEl.style.transition='';
    },230);

    if(commit) wsDeCommitOrderFromDom();
  }
  _wsDeDragState=null;
}

// Read the current DOM order of rows and reorder DAY's exercises[]/cardio[]
// to match. Each row carries data-list + data-orig-idx so we know its origin.
function wsDeCommitOrderFromDom(){
  if(!wsDayEditCtx) return;
  const d=DAYS[wsDayEditCtx.dayIdx];
  if(!d) return;
  const list=document.getElementById('wsDeExListInner');
  if(!list) return;
  const rows=Array.from(list.querySelectorAll('.ws-de-exrow'));
  // Build the unified items list from the current DOM order. The DOM is the
  // canonical source of truth for what the user just did — strength and cardio
  // are freely interleaved, which is the whole point of the items model.
  const newItems=[];
  for(const row of rows){
    const which=row.dataset.list;
    const origIdx=parseInt(row.dataset.origIdx,10);
    const src = which==='exercises' ? d.exercises : d.cardio;
    if(src && src[origIdx]) newItems.push(src[origIdx]);
  }
  // Detect change (compare by reference against current items[])
  const oldItems=Array.isArray(d.items)?d.items:[];
  let changed=newItems.length!==oldItems.length;
  if(!changed){
    for(let i=0;i<newItems.length;i++){
      if(newItems[i]!==oldItems[i]){ changed=true; break; }
    }
  }

  if(changed){
    // Items list is now authoritative; derive the legacy arrays from it so
    // existing readers (still using d.exercises / d.cardio) see consistent state.
    const groups=wsSsGroupMap(oldItems);   // v61: dragging never pairs strangers
    d.items=newItems;
    wsSsKeepGroups(d.items,groups);
    wsDayItemsSync(d);
    wsLogPush('day_reorder_exercises',{dayIdx:wsDayEditCtx.dayIdx});
    wsPersistSave();
    // Re-render so data-orig-idx values realign with the new array order
    wsDeRenderExList();
  }
}

function wsDeSetStatus(makeActive){
  if(!wsDayEditCtx) return;
  // Failsafe: can't bank if this is the last active day
  if(!makeActive&&wsDayEditCtx.originalPublished&&wsCountActive()<=1&&!wsDayEditCtx.isNew){
    wsToast('You need at least one active workout');
    return;
  }
  wsDayEditCtx.pendingPublished=makeActive;
  wsDeRenderStatusToggle();
}

function wsDeRenderStatusToggle(){
  const isAct=wsDayEditCtx.pendingPublished;
  document.getElementById('wsDeStatusActive').classList.toggle('active',isAct);
  document.getElementById('wsDeStatusBanked').classList.toggle('active',!isAct);
  const hint=document.getElementById('wsDeStatusHint');
  if(isAct){
    hint.textContent='Active workouts appear as tabs on Today, as part of your rotation.';
  } else {
    hint.textContent='Banked workouts are kept for later. Drag one into Active to use it.';
  }
}

function closeWsDayEdit(){
  wsLogPush('close_day_editor');
  if(wsDayEditCtx&&wsDayEditCtx.isNew){
    // Cancelling a brand-new day: remove it
    DAYS=DAYS.filter((_,i)=>i!==wsDayEditCtx.dayIdx);
    ensureCurDayPublished();
  }
  wsDayEditCtx=null;
  document.getElementById('wsDayEditModal').classList.remove('open');
  wsRender();
}

function saveWsDayEdit(){
  wsLogPush('save_day_edit');
  if(!wsDayEditCtx) return;
  const d=DAYS[wsDayEditCtx.dayIdx];
  if(!d){ wsDayEditCtx=null; document.getElementById('wsDayEditModal').classList.remove('open'); return; }
  const t1=document.getElementById('wsDeTitle1').value.trim();
  const t2=document.getElementById('wsDeTitle2').value.trim();
  const lbl=document.getElementById('wsDeLabel').value.trim();
  if(!t1&&!t2){ wsToast('Title cannot be empty'); return; }
  if(!lbl){ wsToast('Label cannot be empty'); return; }
  d.titleHtml=t2?`${wsEscape(t1)}<br><em>${wsEscape(t2)}</em>`:wsEscape(t1);
  d.label=lbl;
  d.published=wsDayEditCtx.pendingPublished;
  wsDayEditCtx=null;
  document.getElementById('wsDayEditModal').classList.remove('open');
  ensureCurDayPublished();
  wsRender();
  wsPersistSave();
  wsToast('Workout saved');
}

// v59: safe for text AND attribute values, and for anything that isn't a
// string (numbers, missing values). Data from a backup or import file is
// untrusted: it must always be shown as text, never run.
function wsEscape(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// v61: a value placed inside a quoted JavaScript string in an HTML attribute,
// e.g. onclick="open('${wsJs(id)}')". HTML escaping alone is not enough there:
// the browser decodes &#39; back to ' before the script runs, so an id from a
// backup file could close the string and run code. This escapes for the
// script first, then for the attribute.
function wsJs(s){
  return wsEscape(String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\u2028|\u2029/g,' '));
}
// v60: a workout's two-line title is stored as a little HTML ("Push +<br><em>
// Pull</em>"). It can arrive from a backup file, so it is never trusted: only
// <br> and <em> survive, every other tag is dropped, and the text is escaped.
function wsSafeTitleHtml(s){
  const ENT={amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",'#x27':"'",nbsp:'\u00a0'};
  const dec=t=>String(t).replace(/<[^>]*>?/g,'').replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g,(m,e)=>ENT[e]);
  return String(s==null?'':s).split(/(<br\s*\/?>|<em>|<\/em>)/i).map(p=>
    /^<br\s*\/?>$/i.test(p)?'<br>':(/^<em>$/i.test(p)?'<em>':(/^<\/em>$/i.test(p)?'</em>':wsEscape(dec(p))))
  ).join('');
}

// ──────────── Create new day ────────────

function wsCreateNewDay(){
  wsLogPush('create_new_day');
  // Build a fresh day, append to DAYS, open editor
  const newDay={label:`Workout ${DAYS.length+1}`,titleHtml:'New<br><em>Workout</em>',published:true,exercises:[],logged:false};
  DAYS.push(newDay);
  wsRender();
  openWsDayEdit(DAYS.length-1,true);
}
