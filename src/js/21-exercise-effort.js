/* ═══ LIVE EFFORT (RPE) CAPTURE ═══
   Crimson pill in each card's utility strip, gated on settings.showIntensityScore.
   Appears once work exists (strength: ≥1 logged set; cardio/HIIT: logged).
   Tap → inline 1–10 chip panel; tapping a number IS the confirmation.
   Flame-pulse fires ONCE per exercise, on the first render after the exercise
   completes (deterministic: the renderer is the trigger; ex._rpePulsed persists). */
const WS_EFFORT_EXPLAIN={
  strength:`Rate how hard it felt, <b>1 (easy)</b> to <b>10 (max effort)</b>. Rated exercises earn an <span class="es">Effort Score</span> — and over time the app can notice the same sets feeling easier, which is strength gained before the numbers move. Always optional. Anchor: <b>9 means about one more rep in you; 10 means nothing left.</b>`,
  cardio:`Rate how hard it felt, <b>1 (easy)</b> to <b>10 (max effort)</b>. Rated sessions earn an <span class="es">Effort Score</span> — and over time the app can notice the same pace feeling easier: fitness gained even when the clock reads the same. Always optional. Anchor: <b>9 means you could barely hold the pace; 10 means you couldn't have gone longer.</b>`,
  hiit:`Rate the <b>peak</b> — your hardest stretch — <b>1 (easy)</b> to <b>10 (max effort)</b>. Rated sessions earn an <span class="es">Effort Score</span>, and over time the app can notice the same rounds getting easier. Always optional. Anchor: <b>9 means the peak was nearly your max; 10 means it was everything you had.</b>`,
};
function wsEffortKind(ex){
  const k=ex._itemKind||wsTagItemKind(ex);
  if(k==='cardio_intervals') return 'hiit';
  if(k==='weighted') return 'strength';
  return 'cardio';
}
function wsEffortEligible(ex){
  const k=wsEffortKind(ex);
  if(k==='strength') return (ex.sets||[]).some(s=>s._logged);
  return !!ex.logged;
}
function wsEffortDone(ex){
  const k=wsEffortKind(ex);
  if(k==='strength') return (ex.sets||[]).length>0 && (ex.sets||[]).every(s=>s._logged);
  return !!ex.logged;
}
function wsEffortVal(ex){
  return wsEffortKind(ex)==='hiit'
    ? (typeof ex.peakRpe==='number'?ex.peakRpe:null)
    : (typeof ex.rpe==='number'?ex.rpe:null);
}
function wsEffortStrip(ex,ei){
  // Utility strip at the card's foot: effort pill (gated on the setting and
  // on work existing) + 1RM chip (weighted exercises, independent of the
  // effort toggle). Renders nothing when both are empty.
  try{
    const k=wsEffortKind(ex);
    const showPill = hiScoreEnabled() && wsEffortEligible(ex);
    let pillHtml='', panel='';
    if(showPill){
      const val=wsEffortVal(ex);
      // Single-fire flame: first render after the exercise completes, if unrated.
      let flame='';
      if(val===null && wsEffortDone(ex) && !ex._rpePulsed){ ex._rpePulsed=true; flame=' flame'; }
      const pill = val===null
        ? `<span class="ws-rpe-pill" onclick="event.stopPropagation();wsToggleRpePanel(${ei})"><svg viewBox="0 0 13 13"><path d="M2 8.5 L6.5 3 L11 8.5"/></svg> ${k==='hiit'?'Rate peak effort':'Rate effort'}</span>`
        : `<span class="ws-rpe-pill rated" onclick="event.stopPropagation();wsToggleRpePanel(${ei})"><svg viewBox="0 0 13 13"><polyline points="2.5 7 5.5 10 10.5 3.5"/></svg> Effort <span class="num">${val}</span></span>`;
      pillHtml=`<span class="ws-rpe-wrap${flame}">${pill}</span>`;
      if(ex._rpeOpen){
        let chips='';
        for(let n=1;n<=10;n++) chips+=`<div class="ws-rpe-n${val===n?' sel':''}" onclick="event.stopPropagation();wsCommitRpe(${ei},${n})">${n}</div>`;
        panel=`<div class="ws-rpe-panel">
          <div class="ws-rpe-q">${k==='hiit'?'How hard was the peak?':'How hard was this exercise?'}</div>
          <div class="ws-rpe-sub"><span class="ic" onclick="event.stopPropagation();wsToggleRpeInfo(${ei})">i</span> ${k==='hiit'?'your hardest stretch':'your overall effort'}, 1–10 · one tap sets it</div>
          ${ex._rpeInfo?`<div class="ws-rpe-info">${WS_EFFORT_EXPLAIN[k]}</div>`:''}
          <div class="ws-rpe-grid">${chips}</div>
          <div class="ws-rpe-anchors"><span>easy</span><span>max effort</span></div>
        </div>`;
      }
    }
    const rmChip=ws1rmChip(ex,ei);
    const rmPanel=ex._rmOpen ? ws1rmPanel(ex,ei) : '';
    if(!pillHtml && !rmChip) return '';
    return `<div class="ws-effort-strip">${pillHtml}${rmChip}</div>${panel}${rmPanel}`;
  }catch(_){ return ''; }
}
function wsToggleRpePanel(ei){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  ex._rpeOpen=!ex._rpeOpen; if(!ex._rpeOpen) ex._rpeInfo=false;
  renderAll(false);
}
function wsToggleRpeInfo(ei){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  ex._rpeInfo=!ex._rpeInfo;
  renderAll(false);
}
function wsCommitRpe(ei,n){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  if(wsEffortKind(ex)==='hiit') ex.peakRpe=n; else ex.rpe=n;
  ex._rpeOpen=false; ex._rpeInfo=false;
  wsLogPush('effort_rated',{kind:wsEffortKind(ex),val:n});
  try{ if(navigator.vibrate) navigator.vibrate(8); }catch(_){}
  renderAll(false);
  wsPersistSave();
}
