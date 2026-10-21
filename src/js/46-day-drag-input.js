
// ──────────── Day card touch / long-press / drag ─────────────────

function wsBindDayCardEvents(){
  const cards=document.querySelectorAll('.ws-day-card[data-day-idx]');
  cards.forEach(card=>{
    card.addEventListener('pointerdown',wsDayPointerDown,{passive:false});
    card.addEventListener('click',wsDayClick);
  });
}

function wsDayPointerDown(e){
  if(wsDragState) return; // already dragging
  const card=e.currentTarget;
  const dayIdx=parseInt(card.dataset.dayIdx,10);
  const section=card.dataset.section;
  const rect=card.getBoundingClientRect();

  wsDragState={
    dayIdx, sourceSection:section,
    startX:e.clientX, startY:e.clientY,
    currentX:e.clientX, currentY:e.clientY,
    offsetX:e.clientX-rect.left, offsetY:e.clientY-rect.top,
    cardWidth:rect.width, cardHeight:rect.height,
    ghostEl:null, originalEl:card,
    longPressTimer:null, hasMoved:false, isDragging:false,
    dropZone:null, dropIndex:null,
    pointerId:e.pointerId,
  };

  // Long-press timer initiates drag mode
  if(wsDragState.parentRow) wsDragState.parentRow.classList.add('ws-arming');
  wsDragState.longPressTimer=setTimeout(()=>{
    if(!wsDragState||wsDragState.hasMoved) return;
    if(wsDragState.parentRow) wsDragState.parentRow.classList.remove('ws-arming'); wsBeginDrag();
  },WS_LONG_PRESS_MS);

  document.addEventListener('pointermove',wsDayPointerMove,{passive:false});
  document.addEventListener('pointerup',wsDayPointerUp,{passive:false});
  document.addEventListener('pointercancel',wsDayPointerUp,{passive:false});
}

function wsDayPointerMove(e){
  if(!wsDragState) return;
  if(!wsDragState.isDragging){
    const dx=e.clientX-wsDragState.startX;
    const dy=e.clientY-wsDragState.startY;
    // v51: the old rule cancelled on 6px of movement in ANY direction, so a
    // resting finger's drift killed the drag before it armed — the single
    // biggest cause of "I pressed and nothing happened". Cancellation now has
    // to look like a SCROLL: predominantly vertical travel past a real
    // threshold. Sideways movement cannot be a scroll in a vertical list, so it
    // is tolerated far more generously.
    const vertical = Math.abs(dy) > Math.abs(dx);
    const isScroll = vertical ? Math.abs(dy)>WS_DRAG_CANCEL_DY
                              : Math.abs(dx)>WS_DRAG_CANCEL_DX;
    if(isScroll){
      wsDragState.hasMoved=true;
      clearTimeout(wsDragState.longPressTimer);
      if(wsDragState.parentRow) wsDragState.parentRow.classList.remove('ws-arming');
    }
    return;
  }
  e.preventDefault();
  // Sample finger speed (EMA) — log-only now; not used to gate any logic.
  const now=Date.now();
  const dt=Math.max(1,now-wsDragState.lastSampleT);
  const dx=e.clientX-wsDragState.lastSampleX;
  const dy=e.clientY-wsDragState.lastSampleY;
  const instSpeed=Math.hypot(dx,dy)*1000/dt; // px/sec
  wsDragState.velocityPxPerSec=
    WS_VELOCITY_SMOOTH*wsDragState.velocityPxPerSec+
    (1-WS_VELOCITY_SMOOTH)*instSpeed;
  wsDragState.lastSampleX=e.clientX;
  wsDragState.lastSampleY=e.clientY;
  wsDragState.lastSampleT=now;
  wsDragState.currentX=e.clientX;
  wsDragState.currentY=e.clientY;
  wsUpdateGhostPosition();
  wsTickEdgeState();
  // Apple Springboard model: every move, run swap check against neighbors.
  // Works equally during scroll because the row's transform shifts everything
  // (including the dragged card's slot) in lock-step.
  wsUpdateDropTarget();
  wsMaybeVerticalScroll();
  // Log a sampled snapshot of the move
  wsLogMoveCounter++;
  if(wsLogMoveCounter%WS_LOG_MOVE_SAMPLE===0){
    wsLogPush('move',wsLogSnapshot());
  }
  wsLogMaybeTransition();
  wsLogMaybeScroll();
  wsUpdateDebugHud();
}

function wsDayPointerUp(e){
  if(!wsDragState) return;
  clearTimeout(wsDragState.longPressTimer);
  document.removeEventListener('pointermove',wsDayPointerMove);
  document.removeEventListener('pointerup',wsDayPointerUp);
  document.removeEventListener('pointercancel',wsDayPointerUp);

  if(!wsDragState.isDragging){
    // Wasn't a real drag — leave wsDragState null so the click event can fire
    wsDragState=null;
    return;
  }

  // Resolve drop
  wsResolveDrop();
}

// ─────────────── Edge dwell state machine ───────────────────────────────
// Drag operates in one of three exclusive modes:
//   'wedge'      — finger in central area; slot opens/moves with finger
//   'edge_dwell' — finger near viewport edge; dwell timer running
//   'scroll'     — dwell completed; row scrolling, wedge frozen

const WS_EDGE_ZONE_PX=72;
const WS_DWELL_MS=500; // increased from 400 — gives user more time before auto-scroll engages
// SLOWER scroll: user needs to see cards arrive and commit, not chase them.
// Reduced from 5 → 3 because cards passing under the finger were too fast,
// contributing to the "running away" feel during edge-scroll.
const WS_SCROLL_SPEED=3;
// Swap fires when finger is this many px past the dragged card's slot center.
// Using center±THRESHOLD (not just center) means:
//   - After a right swap the new center is 138px right; next right-swap needs
//     138px more travel; next left-swap needs 98px retreat. No cascade, no flutter.
//   - Larger = slower/stickier drag. Smaller = faster/racier.
//   - 40px ≈ 29% of card slot width (138px). Apple Music uses ~25-30%.
const WS_SWAP_THRESHOLD=40; // px offset from slot center required to trigger swap
const WS_SCROLL_ACCEL_PER_FRAME=1.003;
const WS_SCROLL_ACCEL_MAX=1.15;

// ─── Session recorder ───────────────────────────────────────────────
// In-memory log of drag interactions. User taps "Copy Log" to dump JSON
// to clipboard, then pastes it into chat for analysis.
// DEBUG: app-wide event log capacity
const WS_LOG_CAPACITY=5000;
let wsLogErrorCount=0; // count of error events specifically
