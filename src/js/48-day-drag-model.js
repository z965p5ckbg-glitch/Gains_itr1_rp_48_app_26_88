
// Called from pointermove. Manages state transitions between wedge/edge_dwell/scroll.
// Edge dwell → auto-scroll. Independent of swap logic — both run every move.
// State: scrollEngaged ∈ {false, true}; dwellStart/dwellEdge track ramp-up.
// ─────────────────────────────────────────────────────────────────────
// MULTI-ROW WRAP MODEL (replaces horizontal-scroll + edge-scroll model)
//
// The active/banked rows now use flex-wrap. Cards lay out left-to-right,
// top-to-bottom. There is no horizontal scroll, so no edge-scroll dwell, no
// transformOffset, no scrollLeft fighting with iOS.
//
// Reorder model: dragOrder is the 1D sequence of original day indices in their
// current visual order. On every pointermove we compute the insertion index
// (where the dragged card would land if released now) using 2D-aware geometry,
// splice dragOrder, reorder the DOM placeholder to match, and animate all
// affected cards from their old position to their new one using the FLIP
// pattern (First-Last-Invert-Play).
//
// FLIP gives us the iOS-Springboard feel: cards never teleport — they always
// glide from where they were to where they go. The CSS transition
//   .ws-row.ws-dragging .ws-day-card { transition: transform .25s cubic-bezier(.32,.72,0,1) }
// carries the animation while we set the transform back to identity.
// ─────────────────────────────────────────────────────────────────────

// Cooldown between swaps. The FLIP animation runs 250ms; setting cooldown
// slightly below that prevents back-to-back swaps from interrupting the
// settling motion, which would feel jittery. Combined with the hysteresis
// margin in the slot computation, this gives swaps a "considered" feel:
// they happen when intended, not in a flutter.
const WS_SWAP_COOLDOWN_MS=180;

// Group cards into visual rows by their .top coordinate. Returns array of
// arrays of {card, rect, centerX, centerY, indexInList}.
function wsGroupCardsByRow(cards){
  if(!cards.length) return [];
  const items=cards.map((card,idx)=>{
    const r=card.getBoundingClientRect();
    return {card,rect:r,centerX:(r.left+r.right)/2,centerY:(r.top+r.bottom)/2,top:r.top,indexInList:idx};
  });
  // Sort by top, then by left within same row band
  items.sort((a,b)=>a.top-b.top||a.rect.left-b.rect.left);
  const rows=[];
  const ROW_TOL=12; // px tolerance — cards within this Y-distance are same row
  for(const item of items){
    const last=rows[rows.length-1];
    if(last && Math.abs(item.top-last[0].top)<=ROW_TOL){
      last.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows;
}

// Hysteresis margin: how deep inside a target slot the finger must be before
// a swap fires. This prevents ping-pong when the finger hovers near a slot
// boundary — small movements within HYSTERESIS_PX of the edge stay committed
// to the current slot. Larger movements cross the threshold and swap.
const WS_SWAP_HYSTERESIS_PX=24;

// Compute the index in dragOrder where the finger is currently pointing.
//
// Strategy: iterate ALL cards in the row (INCLUDING the dragged card's
// placeholder), find which slot's rect the finger is inside, return that
// card's index in dragOrder.
//
// Why include the placeholder: when computing "which slot is the finger
// over", the placeholder IS a slot — the gap occupies a flex position with
// real geometry. Excluding it makes the same finger position produce
// different answers depending on where the placeholder happens to be,
// which is what caused ping-pong jitter on the previous attempt.
//
// If the finger is between rows or outside the row entirely, we use a
// nearest-slot 2D fallback so the user always has a stable answer.
//
// hysteresisMargin: if positive, require the finger to be at least
// `hysteresisMargin` pixels INSIDE the candidate slot's rect (not just over
// it). Used to prevent rapid back-and-forth across slot boundaries.
function wsComputeTargetSlot(pointerX,pointerY,rowEl,dragOrder,draggedOrigIdx,hysteresisMargin){
  const allCards=Array.from(rowEl.querySelectorAll('.ws-day-card[data-day-idx]'));
  if(!allCards.length) return -1;

  // Build slot list: each card + rect + position in dragOrder.
  const slots=[];
  for(const card of allCards){
    const origIdx=parseInt(card.dataset.dayIdx,10);
    const posInOrder=dragOrder.indexOf(origIdx);
    if(posInOrder<0) continue;
    const r=card.getBoundingClientRect();
    slots.push({
      card,
      origIdx,
      posInOrder,
      rect:r,
      centerX:(r.left+r.right)/2,
      centerY:(r.top+r.bottom)/2,
      isDragged:(origIdx===draggedOrigIdx),
    });
  }
  if(!slots.length) return -1;

  // Pass 1: is the finger directly inside a slot's (shrunken) rect?
  const margin=hysteresisMargin||0;
  for(const s of slots){
    const r=s.rect;
    if(pointerX>=r.left+margin && pointerX<=r.right-margin &&
       pointerY>=r.top+margin && pointerY<=r.bottom-margin){
      return s.posInOrder;
    }
  }

  // Pass 2: finger is outside all slot rects (in gaps, above row, below row).
  // Find the nearest slot by Euclidean distance to its center.
  //
  // Stickiness: the dragged card's own slot (the placeholder) gets a distance
  // discount, so it wins when the finger is "between" positions. This is
  // analogous to iOS Springboard's behavior — the gap doesn't move until the
  // finger has clearly committed to a different slot. Without this, dragging
  // along a row-gap zone would oscillate the gap from one row to another with
  // each tiny finger movement, because the nearest center alternates between
  // rows. STICKINESS_FACTOR < 1 means "treat the placeholder as closer than
  // it really is"; non-dragged slots must be substantially closer to win.
  const STICKINESS_FACTOR=0.65;
  let best=null;
  let bestDist=Infinity;
  for(const s of slots){
    let d=Math.hypot(pointerX-s.centerX,pointerY-s.centerY);
    if(s.isDragged) d*=STICKINESS_FACTOR;
    if(d<bestDist){ bestDist=d; best=s; }
  }
  if(!best) return -1;
  // If the nearest slot IS the placeholder, no movement needed.
  if(best.isDragged) return best.posInOrder;

  // Decide before/after based on which side of the nearest slot the finger
  // is on, in both axes. Below or right-of-center → insert after.
  let after=false;
  if(pointerY>best.centerY+10) after=true;
  else if(pointerY<best.centerY-10) after=false;
  else after=(pointerX>best.centerX);
  let target=after?(best.posInOrder+1):best.posInOrder;
  // The dragged card will splice into `target`. If the result would be a
  // single-step shift past currentPos in either direction, this is the
  // natural case. Larger jumps imply the finger is far from the placeholder
  // and the user explicitly wants a multi-position move.
  if(target<0) target=0;
  if(target>dragOrder.length-1) target=dragOrder.length-1;
  return target;
}

// FLIP animation: capture each card's rect, run the mutation (which can change
// DOM order), capture rects again, apply inverse transforms so cards visually
// haven't moved yet, force reflow, then clear transforms so the CSS transition
// carries them to their new positions over 250ms.
// Module-level handle so a new swap can cancel an in-flight play step.
let wsFlipPlayHandle=null;

function wsFlipAnimate(rowEl,mutateFn){
  // Cancel any pending PLAY from a previous swap so it doesn't fire after
  // we've already set inverse transforms for the new swap.
  if(wsFlipPlayHandle!=null){
    cancelAnimationFrame(wsFlipPlayHandle);
    wsFlipPlayHandle=null;
  }
  const cards=Array.from(rowEl.querySelectorAll('.ws-day-card[data-day-idx]'));
  // FIRST: record starting positions (reflects any in-progress animation)
  const firstRects=new Map();
  for(const c of cards){
    firstRects.set(c,c.getBoundingClientRect());
  }
  // Mutate DOM (typically: re-append cards in dragOrder)
  mutateFn();
  // LAST: record final positions
  const cardsAfter=Array.from(rowEl.querySelectorAll('.ws-day-card[data-day-idx]'));
  const lastRects=new Map();
  for(const c of cardsAfter){
    lastRects.set(c,c.getBoundingClientRect());
  }
  // INVERT: apply transforms that put cards back at their FIRST positions
  for(const c of cardsAfter){
    const first=firstRects.get(c);
    const last=lastRects.get(c);
    if(!first||!last){
      c.style.transition='';
      c.style.transform='';
      continue;
    }
    const dx=first.left-last.left;
    const dy=first.top-last.top;
    if(Math.abs(dx)<0.5 && Math.abs(dy)<0.5){
      c.style.transition='';
      c.style.transform='';
      continue;
    }
    // Disable transition so the card snaps to FIRST instantly
    c.style.transition='none';
    c.style.transform='translate('+dx+'px,'+dy+'px)';
  }
  // Force reflow so the browser registers the inverse transform.
  void rowEl.offsetWidth;
  // PLAY: clear transition override and clear transforms; the row's CSS
  // transition rule animates back to identity.
  wsFlipPlayHandle=requestAnimationFrame(()=>{
    wsFlipPlayHandle=null;
    for(const c of cardsAfter){
      c.style.transition='';
      c.style.transform='';
    }
  });
}

// Main swap check. Called from pointermove. Reads the current finger position,
// computes target slot via wsComputeTargetSlot, mutates dragOrder + DOM if
// changed, runs FLIP animation.
function wsCheckSwap(pointerX,pointerY,rowEl){
  const ds=wsDragState;
  if(!ds||!ds.dragOrder) return;
  // Cooldown gate so the 250ms FLIP animation can settle before next swap.
  const now=Date.now();
  if(ds.lastSwapTime && (now-ds.lastSwapTime)<WS_SWAP_COOLDOWN_MS) return;
  const draggedOrigIdx=ds.draggedOriginalIdx;
  const orderArr=ds.dragOrder;
  const currentPos=orderArr.indexOf(draggedOrigIdx);
  if(currentPos<0) return;

  // Use hysteresis so micro-movements near a boundary don't ping-pong.
  // If the finger has been in the current slot, it needs to penetrate the
  // next slot by HYSTERESIS_PX before we commit. wsComputeTargetSlot with
  // a positive margin will treat the in-between zone as "still in current
  // slot", since the dragged card's own slot is included as a candidate
  // and the finger is currently over that slot's neighborhood.
  const targetPos=wsComputeTargetSlot(pointerX,pointerY,rowEl,orderArr,draggedOrigIdx,WS_SWAP_HYSTERESIS_PX);
  if(targetPos<0) return;
  if(targetPos===currentPos) return;

  // Mutate dragOrder: remove dragged from currentPos, insert at targetPos.
  orderArr.splice(currentPos,1);
  orderArr.splice(targetPos,0,draggedOrigIdx);
  ds.dropIndex=targetPos;
  ds.lastSwapTime=now;

  // Reorder DOM via FLIP. Walking dragOrder and appendChild'ing each card
  // in turn yields a DOM that matches dragOrder, since appendChild moves
  // to end and we visit in order.
  wsFlipAnimate(rowEl,()=>{
    for(const origIdx of orderArr){
      const el=rowEl.querySelector('.ws-day-card[data-day-idx="'+origIdx+'"]');
      if(el) rowEl.appendChild(el);
    }
  });

  wsLogPush('swap',{from:currentPos,to:targetPos,px:Math.round(pointerX),py:Math.round(pointerY),order:orderArr.slice()});
  if(navigator.vibrate) navigator.vibrate(6);
}

// Vertical auto-scroll: when finger is near top/bottom of viewport, scroll the
// page so the user can drag a card to a row outside the current viewport.
// This is independent of any horizontal logic — pure body.scrollTop write.
function wsMaybeVerticalScroll(){
  if(!wsDragState) return;
  const y=wsDragState.currentY;
  const body=document.getElementById('wsBody');
  if(!body) return;
  const r=body.getBoundingClientRect();
  const VERT_EDGE=100, VERT_SPEED=10;
  if(y<r.top+VERT_EDGE&&body.scrollTop>0){
    body.scrollTop-=VERT_SPEED;
  } else if(y>r.bottom-VERT_EDGE&&body.scrollTop<body.scrollHeight-body.clientHeight){
    body.scrollTop+=VERT_SPEED;
  }
}

// Backward-compat stubs for any legacy callers.
function wsMaybeAutoScroll(){}
function wsDoEdgeScroll(){}
function wsTickEdgeState(){}
function wsApplyScrollTransform(){}
function wsClearScrollTransforms(){
  // Cancel any pending FLIP play step and clear inline transforms from cards.
  if(wsFlipPlayHandle!=null){
    cancelAnimationFrame(wsFlipPlayHandle);
    wsFlipPlayHandle=null;
  }
  const cards=document.querySelectorAll('.ws-day-card[data-day-idx]');
  cards.forEach(c=>{ c.style.transform=''; c.style.transition=''; });
}
function wsUpdateScrollBar(){
  // Scroll bar UI is no longer relevant — hide it if present.
  const wrap=document.getElementById('wsScrollBar');
  if(wrap) wrap.classList.remove('visible');
}
function wsUpdateEdgeIndicator(){
  // Edge indicator UI no longer used.
  const lEdge=document.getElementById('wsEdgeLeft');
  const rEdge=document.getElementById('wsEdgeRight');
  if(lEdge) lEdge.classList.remove('visible','active');
  if(rEdge) rEdge.classList.remove('visible','active');
}
function wsApplyOrderShifts(){
  // No longer needed — DOM order is authoritative; FLIP handles motion.
}

// rAF loop runs continuously while dragging. With edge-scroll removed, this
// loop's only job is HUD/debug updates and vertical-scroll polling.
function wsScrollLoop(){
  if(!wsDragState||!wsDragState.isDragging) return;
  wsLogMaybeTransition();
  wsUpdateDebugHud();
  requestAnimationFrame(wsScrollLoop);
}

function wsBeginDrag(){
  if(!wsDragState) return;
  wsDragState.isDragging=true;
  wsDragState.dragStartTime=Date.now();

  // Swap cooldown — discrete swaps with 250ms FLIP animation must not stack.
  wsDragState.lastSwapTime=0;

  // Velocity tracking — log instrumentation only.
  wsDragState.velocityPxPerSec=0;
  wsDragState.lastSampleX=wsDragState.currentX;
  wsDragState.lastSampleY=wsDragState.currentY;
  wsDragState.lastSampleT=Date.now();

  // ─── SOURCE OF TRUTH: dragOrder ───
  // 1D sequence of original day indices in current visual order.
  // The wrapping flex layout maps this to a 2D grid automatically.
  const srcSection=wsDragState.sourceSection;
  wsDragState.dragOrder=DAYS
    .map((d,i)=>({d,i}))
    .filter(({d})=>(srcSection==='active'?d.published!==false:d.published===false))
    .map(({i})=>i);
  wsDragState.draggedOriginalIdx=wsDragState.dayIdx;
  wsDragState.dropZone=srcSection;
  wsDragState.dropIndex=wsDragState.dragOrder.indexOf(wsDragState.dayIdx);
  wsDragState.cardSlotWidth=wsDragState.cardWidth+10;

  wsLogPush('drag_start',{
    dayIdx:wsDragState.dayIdx,
    sourceSection:wsDragState.sourceSection,
    startX:wsDragState.startX,
    startY:wsDragState.startY,
  });

  const orig=wsDragState.originalEl;
  wsDragState.parentRow=orig.parentNode;
  wsDragState.originalNextSibling=orig.nextSibling;

  // Lift the original card visually — make it a floating ghost following the finger.
  // The original stays in the DOM (with ws-source-hidden) so it occupies its slot
  // as the visible "gap" — dashed accent outline.
  const ghost=orig.cloneNode(true);
  ghost.classList.add('lifted');
  ghost.style.position='fixed';
  ghost.style.left=(wsDragState.currentX-wsDragState.offsetX)+'px';
  ghost.style.top=(wsDragState.currentY-wsDragState.offsetY)+'px';
  ghost.style.width=wsDragState.cardWidth+'px';
  ghost.style.height=wsDragState.cardHeight+'px';
  ghost.style.pointerEvents='none';
  ghost.style.zIndex='1000';
  ghost.style.transform='scale(1.06)';
  ghost.style.boxShadow='0 8px 22px rgba(0,0,0,.55),0 0 0 1px var(--acc)';
  document.body.appendChild(ghost);
  wsDragState.ghostEl=ghost;

  orig.classList.add('ws-source-hidden');
  if(wsDragState.parentRow){
    wsDragState.parentRow.classList.add('ws-dragging');
    wsDragState.parentRow.classList.add('ws-drag-locked');
  }

  document.getElementById('wsTrash').classList.add('visible');
  if(navigator.vibrate) navigator.vibrate(10);
  wsScrollLoop();
}

function wsUpdateGhostPosition(){
  if(!wsDragState||!wsDragState.ghostEl) return;
  wsDragState.ghostEl.style.left=(wsDragState.currentX-wsDragState.offsetX)+'px';
  wsDragState.ghostEl.style.top=(wsDragState.currentY-wsDragState.offsetY)+'px';
}

// (Slot constants removed — Apple Springboard model has no slot element)

// Velocity tracked for log visibility only — not used to gate any logic.
const WS_VELOCITY_SMOOTH=0.4;

// ─── APPLE SPRINGBOARD MODEL ───
// On every move: figure out which row the finger is over, then ask "should
// the dragged item swap with a neighbor?" by comparing finger X to the neighbor's
// POST-SWAP center. The post-swap center is where that neighbor would sit if we
// already swapped. This gives natural hysteresis: once swapped, neighbor's center
// is on the other side of where you came from, so you can't bounce.
//
// Source-of-truth: wsDragState.dragOrder (array of original day indices).
// Visual: each non-dragged card gets a translateX shift if its DOM position
// differs from its position in dragOrder. CSS transition animates the slide.
function wsUpdateDropTarget(){
  if(!wsDragState||!wsDragState.isDragging) return;
  const x=wsDragState.currentX, y=wsDragState.currentY;

  // Clear small indicators
  ['wsActiveTitle','wsBankedTitle'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove('drop-target-active');
  });
  const trashEl=document.getElementById('wsTrash');
  trashEl.classList.remove('hover-target');

  // Trash hit test
  const trashRect=trashEl.getBoundingClientRect();
  if(x>=trashRect.left&&x<=trashRect.right&&y>=trashRect.top&&y<=trashRect.bottom){
    trashEl.classList.add('hover-target');
    wsDragState.dropZone='trash';
    wsDragState.dropIndex=null;
    return;
  }

  // Find row under pointer
  let targetRow=null, targetSection=null;
  const activeRow=document.getElementById('wsActiveRow');
  if(activeRow){
    const r=activeRow.getBoundingClientRect();
    if(y>=r.top-12&&y<=r.bottom+12){ targetRow=activeRow; targetSection='active'; }
  }
  if(!targetRow){
    const bankedRow=document.getElementById('wsBankedRow');
    if(bankedRow){
      const r=bankedRow.getBoundingClientRect();
      if(y>=r.top-12&&y<=r.bottom+12){ targetRow=bankedRow; targetSection='banked'; }
    } else {
      // Empty banked placeholder — drop here goes to position 0 of banked
      const emptyRows=document.querySelectorAll('.ws-row.empty');
      for(const er of emptyRows){
        const r=er.getBoundingClientRect();
        if(y>=r.top-12&&y<=r.bottom+12){
          wsDragState.dropZone='banked';
          wsDragState.dropIndex=0;
          return;
        }
      }
    }
  }

  if(!targetRow){
    wsDragState.dropZone=null;
    wsDragState.dropIndex=null;
    return;
  }

  // Currently we only support swap-reorder within the source section. Cross-section
  // moves are handled at drop time (the dropZone is captured but visual swaps stay
  // in source). This matches Apple's behavior — Springboard doesn't shuffle a target
  // page until you commit to dropping there.
  if(targetSection!==wsDragState.sourceSection){
    wsDragState.dropZone=targetSection;
    return;
  }
  wsDragState.dropZone=targetSection;

  // Run the swap check against the 2D-aware insertion logic.
  wsCheckSwap(x,y,targetRow);
}

// Discrete swap: when the finger crosses the visible center of the immediate
// left or right neighbor, exchange that neighbor with the dragged card in
// dragOrder. The displaced neighbor then animates from its old slot to the
// gap's slot via the CSS transition on .ws-day-card during drag (~250ms,
// iOS-style ease curve). One swap per call — never cascade.
//
// Cooldown: after a swap, ignore further checks for WS_SWAP_COOLDOWN_MS so the
// 250ms displacement transition can settle before another swap fires. Without
// this, iOS's auto-scroll-into-view (which jolts row.scrollLeft when transforms
// push content past the natural bounding box) caused 3-swap cascades in 33ms,
// since each scroll jolt repositioned the next neighbor's center under the
// stationary finger.
// Slot-based commit/uncommit/peek functions — no-ops retained for any
// legacy callers.
function wsCommitSlot(){}
function wsCommitSlotPeek(){}
function wsUncommitSlot(){}
function wsPlaceSlotInRow(){}
function wsTickSlotInterpolation(){}
function wsRemoveSlotFromDOM(){}
function wsComputeInsertionIndex(){return 0;}

// ─── Wedge effect: line during movement, gap during stillness ───────

const WS_WEDGE_GAP_MS=80;    // ms of stillness before line→gap (after a sweep)
const WS_WEDGE_GAP_PX=72;    // px cards shift sideways to open the gap (~half card width)
const WS_WEDGE_DEMOTE_PX=18; // px of movement within same slot to demote gap→line (hysteresis)

// Retained as a stub for backward compatibility with any leftover calls.
// The new model opens slot via DOM directly in wsUpdateDropTarget — no rAF loop needed.
function wsStillnessTick(){ /* no-op in DOM-slot model */ }

// Retained as a stub — no longer used in the DOM-slot model.
function wsApplyWedge(mode){ /* deprecated: slot handles visual gap via DOM */ }

function wsResolveDrop(){
  const ds=wsDragState;
  if(!ds) return;
  // Restore source card visibility, clear transforms (scroll + order shifts).
  if(ds.originalEl) ds.originalEl.classList.remove('ws-source-hidden');
  wsClearScrollTransforms();
  wsLogPush('drop',{...wsLogSnapshot(),dayIdx:ds.dayIdx});
  const day=DAYS[ds.dayIdx];
  const wasPublished=day.published!==false;

  const cleanup=()=>{
    if(ds.ghostEl) ds.ghostEl.remove();
    if(ds.parentRow){
      ds.parentRow.classList.remove('ws-dragging');
      ds.parentRow.classList.remove('ws-drag-locked');
    }
    if(ds.lockedRow && ds.scrollLockHandler){
      ds.lockedRow.removeEventListener('scroll',ds.scrollLockHandler);
    }
    const scrollBarWrap=document.getElementById('wsScrollBar');
    if(scrollBarWrap) scrollBarWrap.classList.remove('visible');
    document.getElementById('wsTrash').classList.remove('visible','hover-target');
    wsUpdateEdgeIndicator(null);
    ['wsActiveTitle','wsBankedTitle'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.classList.remove('drop-target-active');
    });
    wsDragState=null;
    wsUpdateDebugHud();
  };

  if(ds.dropZone==='trash'){
    if(wasPublished&&wsCountActive()<=1){
      wsToast('You need at least one active day');
      cleanup();
      wsRender();
      return;
    }
    cleanup();
    wsRender();
    openWsDeleteModal(ds.dayIdx);
    return;
  }

  // Resolve final position from dragOrder (the source-of-truth array).
  // For same-section drops, dragOrder gives us the exact final order.
  // For cross-section drops, we drop at dropIndex in the target section.
  const targetSection=ds.dropZone;
  let resolvedIdx, resolvedSource;
  if(targetSection===ds.sourceSection&&ds.dragOrder){
    resolvedIdx=ds.dragOrder.indexOf(ds.dayIdx);
    resolvedSource='dragOrder';
  } else {
    resolvedIdx=ds.dropIndex==null?0:ds.dropIndex;
    resolvedSource='dropIndex';
  }
  wsLogPush('drop_resolve',{zone:targetSection,idx:resolvedIdx,source:resolvedSource});

  if(targetSection==='active'){
    DAYS[ds.dayIdx].published=true;
    if(targetSection===ds.sourceSection&&ds.dragOrder){
      // Reorder in place using dragOrder
      wsApplyDragOrder(ds.dragOrder,'active');
    } else {
      wsReorderInSection(ds.dayIdx,'active',resolvedIdx);
    }
  } else if(targetSection==='banked'){
    if(wasPublished&&wsCountActive()<=1){
      wsToast('You need at least one active day');
      cleanup();
      wsRender();
      return;
    }
    DAYS[ds.dayIdx].published=false;
    if(targetSection===ds.sourceSection&&ds.dragOrder){
      wsApplyDragOrder(ds.dragOrder,'banked');
    } else {
      wsReorderInSection(ds.dayIdx,'banked',resolvedIdx);
    }
  }
  // else: dropped outside any zone — no state change.

  ensureCurDayPublished();
  cleanup();
  wsRender();
  wsPersistSave();
}

// Rebuild DAYS so that the section's days appear in the order given by
// dragOrder (an array of original day indices). Other sections preserved.
function wsApplyDragOrder(dragOrder,section){
  const inSection=i=>(section==='active'?DAYS[i].published!==false:DAYS[i].published===false);
  // Walk DAYS in original index order; collect non-section days; replace section
  // slots in order of dragOrder.
  const orderedSection=dragOrder.map(i=>DAYS[i]);
  const rest=DAYS.map((d,i)=>({d,i})).filter(({d,i})=>!inSection(i));
  // Reconstruct DAYS by interleaving — actually simplest: section days appear
  // contiguously in dragOrder order; non-section days keep their relative order.
  // We need to choose where the section sits relative to non-section days.
  // Easiest: keep non-section days in their original relative positions, and put
  // section days where they originally were (just reordered among themselves).
  const result=new Array(DAYS.length);
  // Find original positions of section days in DAYS
  const sectionPositions=DAYS.map((d,i)=>i).filter(inSection);
  // Place reordered section days at those positions
  for(let k=0;k<sectionPositions.length;k++){
    result[sectionPositions[k]]=orderedSection[k];
  }
  // Fill non-section days
  for(const {d,i} of rest){ result[i]=d; }
  DAYS=result;
}

function wsReorderInSection(dayIdx,targetSection,targetInsertIdx){
  // The insertion index is relative to the cards within the target section,
  // not to the DAYS array. We need to translate.
  // Strategy: remove the day from DAYS, rebuild array with day inserted at correct global index.
  const day=DAYS[dayIdx];
  const others=DAYS.filter((_,i)=>i!==dayIdx);
  // Filter to find the indices in `others` that belong to targetSection
  const sectionIndices=others
    .map((d,i)=>({d,i}))
    .filter(({d})=>(targetSection==='active'?d.published!==false:d.published===false))
    .map(({i})=>i);
  // Determine the global insertion index in `others`
  let globalInsert;
  if(targetInsertIdx>=sectionIndices.length){
    // Insert at end of section — find position right after last in-section element
    if(sectionIndices.length===0){
      // Section was empty — insert at end of others
      globalInsert=others.length;
    } else {
      globalInsert=sectionIndices[sectionIndices.length-1]+1;
    }
  } else {
    globalInsert=sectionIndices[targetInsertIdx];
  }
  others.splice(globalInsert,0,day);
  DAYS=others;
}

function wsCountActive(){
  return DAYS.filter(d=>d.published!==false).length;
}

function wsCancelDrag(){
  if(!wsDragState) return;
  wsLogPush('cancel',wsLogSnapshot()||{});
  if(wsDragState.originalEl) wsDragState.originalEl.classList.remove('ws-source-hidden');
  if(wsDragState.parentRow){
    wsDragState.parentRow.classList.remove('ws-dragging');
    wsDragState.parentRow.classList.remove('ws-drag-locked');
  }
  if(wsDragState.lockedRow && wsDragState.scrollLockHandler){
    wsDragState.lockedRow.removeEventListener('scroll',wsDragState.scrollLockHandler);
  }
  const scrollBarWrap=document.getElementById('wsScrollBar');
  if(scrollBarWrap) scrollBarWrap.classList.remove('visible');
  wsClearScrollTransforms();
  if(wsDragState.ghostEl) wsDragState.ghostEl.remove();
  clearTimeout(wsDragState.longPressTimer);
  document.removeEventListener('pointermove',wsDayPointerMove);
  document.removeEventListener('pointerup',wsDayPointerUp);
  document.removeEventListener('pointercancel',wsDayPointerUp);
  document.getElementById('wsTrash').classList.remove('visible','hover-target');
  wsUpdateEdgeIndicator(null);
  wsDragState=null;
  wsUpdateDebugHud();
  wsRender();
}

function wsDayClick(e){
  // If we just finished a drag, ignore the click
  if(wsDragState&&wsDragState.isDragging) return;
  const card=e.currentTarget;
  const dayIdx=parseInt(card.dataset.dayIdx,10);
  if(isNaN(dayIdx)) return;
  openWsDayEdit(dayIdx);
}
