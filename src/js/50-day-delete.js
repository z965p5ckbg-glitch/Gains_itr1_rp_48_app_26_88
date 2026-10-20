
// ──────────── Slide-to-delete modal ────────────

function openWsDeleteModal(dayIdx){
  wsLogPush('open_delete_modal',{dayIdx});
  const d=DAYS[dayIdx];
  if(!d) return;
  wsDeleteCtx={dayIdx};
  document.getElementById('wsDelName').innerHTML=d.titleHtml;
  document.getElementById('wsDelSub').textContent=`This permanently removes ${d.label} and any exercises in it.`;
  // Reset slide
  const fill=document.getElementById('wsDelFill');
  const thumb=document.getElementById('wsDelThumb');
  const wrap=document.getElementById('wsDelSlide');
  fill.style.width='0';
  thumb.style.transform='translateX(0)';
  wrap.classList.remove('committed','dragging');
  wsBindDeleteSlide();
  document.getElementById('wsDeleteModal').classList.add('open');
}

function closeWsDeleteModal(){
  wsLogPush('close_delete_modal');
  document.getElementById('wsDeleteModal').classList.remove('open');
  wsDeleteCtx=null;
  // Clean up slide listeners
  if(wsSlideHandlers){
    document.removeEventListener('pointermove',wsSlideHandlers.move);
    document.removeEventListener('pointerup',wsSlideHandlers.up);
    document.removeEventListener('pointercancel',wsSlideHandlers.up);
    wsSlideHandlers=null;
  }
}

// Module-level handle so we can clean up listeners between modal opens
let wsSlideHandlers=null;

function wsBindDeleteSlide(){
  // Tear down any prior bindings
  if(wsSlideHandlers){
    document.removeEventListener('pointermove',wsSlideHandlers.move);
    document.removeEventListener('pointerup',wsSlideHandlers.up);
    document.removeEventListener('pointercancel',wsSlideHandlers.up);
    wsSlideHandlers=null;
  }
  const wrap=document.getElementById('wsDelSlide');
  const thumb=document.getElementById('wsDelThumb');
  const fill=document.getElementById('wsDelFill');
  let dragging=false, startX=0, startTx=0, currentTx=0;
  // Cached dimensions — read once at drag start to avoid layout thrash on every move
  let maxTx=0, thumbW=46, fillBase=0;
  const COMMIT_PCT=0.85;
  const PAD=9;

  function onDown(e){
    const wrapRect=wrap.getBoundingClientRect();
    const thumbRect=thumb.getBoundingClientRect();
    const localX=e.clientX-wrapRect.left;
    const thumbRight=thumbRect.right-wrapRect.left;
    if(localX>thumbRight+24) return; // far past thumb — ignore
    dragging=true;
    startX=e.clientX;
    startTx=currentTx;
    // Cache the dimensions used for clamping & fill calc
    thumbW=thumb.offsetWidth;
    maxTx=wrap.offsetWidth - thumbW - PAD*2;
    fillBase=thumbW + PAD;
    wrap.classList.add('dragging');
    // Disable transition during drag for instant tracking
    thumb.style.transition='none';
    fill.style.transition='none';
    e.preventDefault();
  }
  function onMove(e){
    if(!dragging) return;
    e.preventDefault();
    const dx=e.clientX-startX;
    currentTx=startTx+dx;
    if(currentTx<0) currentTx=0;
    else if(currentTx>maxTx) currentTx=maxTx;
    thumb.style.transform='translateX('+currentTx+'px)';
    fill.style.width=(currentTx+fillBase)+'px';
    if(maxTx>0 && currentTx/maxTx>=COMMIT_PCT){
      // Commit
      dragging=false;
      wrap.classList.remove('dragging');
      wrap.classList.add('committed');
      thumb.style.transform='translateX('+maxTx+'px)';
      fill.style.width='100%';
      setTimeout(wsExecuteDelete,260);
    }
  }
  function onUp(){
    if(!dragging) return;
    dragging=false;
    wrap.classList.remove('dragging');
    // Restore transitions for snap-back animation
    thumb.style.transition='transform .25s cubic-bezier(.34,1.16,.64,1)';
    fill.style.transition='width .25s cubic-bezier(.34,1.16,.64,1)';
    currentTx=0;
    thumb.style.transform='translateX(0)';
    fill.style.width='0';
  }

  // pointerdown on the wrap (thumb has pointer-events:none)
  wrap.addEventListener('pointerdown',onDown);
  document.addEventListener('pointermove',onMove);
  document.addEventListener('pointerup',onUp);
  document.addEventListener('pointercancel',onUp);
  wsSlideHandlers={down:onDown, move:onMove, up:onUp};
}

function wsExecuteDelete(){
  wsLogPush('execute_delete',{dayIdx:wsDeleteCtx&&wsDeleteCtx.dayIdx});
  if(!wsDeleteCtx) return;
  const idx=wsDeleteCtx.dayIdx;
  // Defensive failsafe again — shouldn't reach here for last active, but double-check
  const d=DAYS[idx];
  if(d&&d.published!==false&&wsCountActive()<=1){
    wsToast('Cannot delete the last active day');
    closeWsDeleteModal();
    return;
  }
  DAYS=DAYS.filter((_,i)=>i!==idx);
  ensureCurDayPublished();
  closeWsDeleteModal();
  wsRender();
}
