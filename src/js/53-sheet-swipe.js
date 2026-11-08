
// ─── Swipe a sheet down to close it (v56) ───────────────────────────────
// The sheets drew an iOS grabber but nothing listened to it, so Settings could
// only be closed with Done. Dragging the grabber or the title down now follows
// the finger and closes past 90px; a shorter drag springs back. Closing goes
// through the overlay's own backdrop handler, so each sheet keeps its normal
// close behaviour (Cancel semantics — nothing is saved by swiping).
// Only the top strip listens, so scrolling the sheet's content is unaffected.
(function(){
  let drag=null;
  const zone=t=>{
    const z=t&&t.closest&&t.closest('.sheet > .sh-handle, .sheet > .sh-title');
    if(!z) return null;
    const sheet=z.parentElement, ov=sheet.parentElement;
    return (ov && ov.classList.contains('overlay') && ov.classList.contains('open')) ? {sheet,ov} : null;
  };
  document.addEventListener('pointerdown',e=>{
    const z=zone(e.target); if(!z) return;
    drag={sheet:z.sheet, ov:z.ov, id:e.pointerId, y0:e.clientY, dy:0};
    z.sheet.style.transition='none';
  });
  document.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id) return;
    drag.dy=Math.max(0,e.clientY-drag.y0);
    drag.sheet.style.transform=drag.dy?'translateY('+drag.dy+'px)':'';
  });
  const end=e=>{
    if(!drag||e.pointerId!==drag.id) return;
    const d=drag; drag=null;
    d.sheet.style.transition=''; d.sheet.style.transform='';
    if(d.dy>90) d.ov.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  };
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',end);
})();
