

// ═══════════════════════════════════════════════════════════════════
// WORKSHOP — Batch B
// ═══════════════════════════════════════════════════════════════════

let wsActiveTab='days';
let wsDayEditCtx=null; // {dayIdx, isNew, originalTitleHtml, originalLabel, originalPublished}
let wsDeleteCtx=null;  // {dayIdx}

// Library tab state
let wsLibSearchQuery='';      // current search text
let wsLibGroupBy='title';     // 'none' | 'title' | 'muscle' | 'pattern'
// Favorites: a Set of exIds. Starred exercises float to the top ONLY in the
// empty-browse state (no search, no lens). Keyed by stable exId so it survives
// name changes and migration. Persisted via the blob trio.
let wsFavorites=new Set();
let wsLibEditCtx=null;        // when an editor is open: {exId, isNew, originalSnapshot}
let wsAdvancedTags=false;     // when true, expose muscle/pattern groupings and editor fields
// Lowercased title-keys of groups that are currently expanded by the user.
// Persisted in memory across re-renders so toggling stays sticky. Reset
// across reloads (the user starts fresh, with everything collapsed).
let wsLibExpandedGroups=new Set();

// If the persistence load earlier in the module had settings/UI prefs to
// apply, do so now that `settings` and the wsLib* state variables are all
// declared. This avoids the temporal-dead-zone crash that would happen if
// we assigned at load time. NOTE: this must be wsApplyPendingPrefs (the
// full applier: settings + UI prefs) — calling only wsApplyPendingUiPrefs
// here silently dropped the user's persisted settings on every reload.
wsApplyPendingPrefs();

// All let-declared globals that the persistence blob builder reads are now
// in scope. It's safe to flush state to localStorage from here on.
_wsPersistReady=true;

// Drag-and-drop state
let wsDragState=null;
// Shape: {dayIdx, sourceSection ('active'|'banked'), startX, startY, currentX, currentY,
//         offsetX, offsetY, ghostEl, originalEl, longPressTimer, hasMoved, dropZone, dropIndex}

const WS_LONG_PRESS_MS=350;   // v51: 250ms fired on slow taps; 350 is closer to the platform norm
const WS_DRAG_CANCEL_DY=12;   // v51: vertical travel that means "this is a scroll, not a drag"
const WS_DRAG_CANCEL_DX=40;   // v51: horizontal travel is NOT a scroll in a vertical list — be generous
const WS_DRAG_MOVE_THRESHOLD=6; // pixels — distance required during long-press to count as actual drag

function openWorkshop(){
  wsLogPush('open_workshop');closeSettings();
  document.getElementById('workshopOverlay').classList.add('open');
  wsActiveTab='days';
  wsRender();
}

function closeWorkshop(){
  wsLogPush('close_workshop');
  // Defensive: cancel any in-progress drag
  wsCancelDrag();
  document.getElementById('workshopOverlay').classList.remove('open');
  // Re-render the main app in case days were added/banked/deleted
  ensureCurDayPublished();
  renderTabs(); renderHeader(); renderAll(false);
}

function wsSwitchTab(tab){
  if(wsActiveTab===tab) return;
  wsLogPush('ws_switch_tab',{tab});
  wsActiveTab=tab;
  document.getElementById('wsTabDays').classList.toggle('active',tab==='days');
  document.getElementById('wsTabLib').classList.toggle('active',tab==='library');
  wsRender();
}

function wsRender(){
  const body=document.getElementById('wsBody');
  // Preserve horizontal scroll positions of rows across re-renders
  const prevActiveScroll=(document.getElementById('wsActiveRow')||{}).scrollLeft||0;
  const prevBankedScroll=(document.getElementById('wsBankedRow')||{}).scrollLeft||0;
  if(wsActiveTab==='days'){
    body.innerHTML=wsRenderDays();
    wsBindDayCardEvents();
    // Restore scroll positions
    const ar=document.getElementById('wsActiveRow');
    const br=document.getElementById('wsBankedRow');
    if(ar) ar.scrollLeft=prevActiveScroll;
    if(br) br.scrollLeft=prevBankedScroll;
  } else {
    body.innerHTML=wsRenderLibraryPlaceholder();
  }
}

function wsRenderDays(){
  const active=DAYS.map((d,i)=>({d,i})).filter(({d})=>d.published!==false);
  const banked=DAYS.map((d,i)=>({d,i})).filter(({d})=>d.published===false);

  const activeRowHtml=active.map(({d,i})=>wsDayCardHtml(d,i,true)).join('');
  const bankedRowHtml=banked.length===0
    ? `<div class="ws-row empty">Drag a day here to bank it for later</div>`
    : `<div class="ws-row" id="wsBankedRow" data-section="banked">${banked.map(({d,i})=>wsDayCardHtml(d,i,false)).join('')}</div>`;

  // Subtle one-time affordance hint. Auto-hidden once the user dismisses.
  const dismissed=(settings.wsHintsDismissed||{}).daysGestures===true;
  const hintHtml = dismissed ? '' : `
    <div class="ws-hint" id="wsDaysHint">
      <span class="ws-hint-icon">●</span>
      <span class="ws-hint-text"><strong>Tap</strong> a day to edit · <strong>long-press</strong> to drag</span>
      <button class="ws-hint-dismiss" onclick="wsDismissHint('daysGestures')" aria-label="Dismiss hint">×</button>
    </div>`;

  return `
    ${hintHtml}
    <div class="ws-section-title" id="wsActiveTitle">
      <div class="ws-section-title-left"><span>Active</span><span class="ws-section-count">${active.length} day${active.length===1?'':'s'}</span></div>
      <div class="ws-add-day-btn" onclick="wsCreateNewDay()" role="button"><span class="ws-add-day-btn-plus">+</span><span>Day</span></div>
    </div>
    <div class="ws-row" id="wsActiveRow" data-section="active">${activeRowHtml}</div>
    <div class="ws-scroll-bar-wrap" id="wsScrollBar"><div class="ws-scroll-bar-track"></div><div class="ws-scroll-bar-thumb" id="wsScrollBarThumb"></div></div>
    <div class="ws-section-title" id="wsBankedTitle">
      <div class="ws-section-title-left"><span>Banked</span><span class="ws-section-count">${banked.length} day${banked.length===1?'':'s'}</span></div>
    </div>
    ${bankedRowHtml}
  `;
}

// Dismiss a one-time hint and persist the flag so it stays dismissed.
function wsDismissHint(key){
  if(!settings.wsHintsDismissed) settings.wsHintsDismissed={};
  settings.wsHintsDismissed[key]=true;
  wsRender();
  wsPersistSave();
}

function wsDayCardHtml(d,i,isActive){
  const cls=isActive?'active-day':'banked-day';
  return `<div class="ws-day-card ${cls}" data-day-idx="${i}" data-section="${isActive?'active':'banked'}">
    <div>
      <div class="ws-day-title">${d.titleHtml}</div>
    </div>
    <div>
      <div class="ws-day-label">${d.label}</div>
      <div class="ws-day-meta">${wsDayCount(d)}</div>
    </div>
  </div>`;
}

function wsDayCount(d){
  // Total = items[] length when available, else fallback to legacy sum.
  const n = Array.isArray(d.items) ? d.items.length
          : ((d.exercises||[]).length + (d.cardio||[]).length);
  return n+' '+(n===1?'exercise':'exercises');
}

function wsRenderLibraryPlaceholder(){
  // Kept as a tiny wrapper for now; delegates to the real renderer.
  return wsRenderLibrary();
}
