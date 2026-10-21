
// ─── Takeover view (S4): full-screen twin of the inline card ───
window.__wsTvEi=null;
try{ wsApplyCal(); }catch(_){}
function wsRenderTakeover(ei){
  const v=document.getElementById('wsRunView'); if(!v) return;
  const ex=DAYS[curDay]&&DAYS[curDay].items[ei]; if(!ex){ wsCloseTakeover(); return; }
  const st=wsHiitState(ex,ei);
  const skips=st.isActivePhase?`<div class="ws-skip l wsTv-skip" onclick="event.stopPropagation();wsHiitSkip(${ei},-1)">‹</div><div class="ws-skip r wsTv-skip" onclick="event.stopPropagation();wsHiitSkip(${ei},1)">›</div>`:'';
  v.innerHTML=`<div class="wsTv-in">
    <div class="wsTv-top"><div class="wsTv-name" onclick="wsCalTap()">${ex.name||wsCircuitName(ex)}</div></div>
    <div class="phase-strip-label wsTv-label"><span>Circuit</span><span class="phase-strip-rounds">${st.stripDesc}</span></div>
    <div class="ws-strip-vp" style="height:${st.vpH}px"><div class="ws-strip-col${st.slide?' wsAnim':''}" style="${st.colStyle}">${st.colHtml}</div></div>
    <div class="wsTv-flex"></div>
    <div class="wsTv-hero ${st.bigCls}" onclick="hiitBadgeTap(${ei});wsTvSync()">
      <svg class="phase-perimeter" preserveAspectRatio="none"><rect id="wsTvRing" x="0.75" y="0.75" rx="16" ry="16" data-initpct="${st.initPct}"></rect></svg>
      ${skips}
      <div class="wsTv-counter">${st.counter}</div>
      <div class="wsTv-name2">${st.name}</div>
      <div class="wsTv-time" id="wsTvTime">${st.time}</div>
      <div class="wsTv-sub">${st.sub}</div>
    </div>
    <div class="wsTv-flex"></div>
    <div class="ws-run-next wsTv-next"><span class="l">${st.nl}</span><span class="v ${st.nc}">${st.nv}</span><span class="d">${st.nd}</span></div>
    <div class="wsTv-ctrl">
      <div class="wsTv-btn${exSnd(ex,'interval')?' on':''}" onclick="toggleExSound(${ei});wsTvSync()">${exSnd(ex,'interval')?'Sound':'Muted'}</div>
      <div class="wsTv-btn" onclick="wsCloseTakeover()">Minimize</div>
      <div class="wsTv-btn end" onclick="wsTvEndOpen()">End</div>
    </div>
  </div>
  <div class="wsTv-sheet" id="wsTvSheet"><div class="wsTv-sheet-in"><div class="wsTv-sheet-t">End this circuit?</div><div class="wsTv-sheet-btns"><div class="wsTv-btn end big" onclick="wsTvEndConfirm()">End now</div><div class="wsTv-btn big" onclick="wsTvEndCancel()">Keep going</div></div></div></div>`;
}
function wsOpenTakeover(ei){
  const v=document.getElementById('wsRunView'); if(!v) return;
  window.__wsTvEi=ei;
  wsRenderTakeover(ei);
  const hp=document.getElementById('hp'+ei);
  if(hp&&hp.getBoundingClientRect){ const r=hp.getBoundingClientRect();
    v.style.transformOrigin=(r.left+r.width/2)+'px '+(r.top+r.height/2)+'px'; }
  v.classList.add('pre');
  v.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>v.classList.remove('pre')));
  if(typeof syncHiitPerimeters==='function') syncHiitPerimeters();
}
function wsCloseTakeover(){
  const v=document.getElementById('wsRunView'); if(!v) return;
  v.classList.remove('show','pre');
  v.style.transformOrigin='';
  window.__wsTvEi=null;
  renderAll(false);
}
function wsTvSync(){
  const v=document.getElementById('wsRunView');
  if(!v||!v.classList.contains('show')||window.__wsTvEi==null) return;
  wsRenderTakeover(window.__wsTvEi);
  if(typeof syncHiitPerimeters==='function') syncHiitPerimeters();
}
function wsTvEndOpen(){
  const sh=document.getElementById('wsTvSheet'); if(!sh) return;
  sh.classList.add('show','inert');
  clearTimeout(sh._t); sh._t=setTimeout(()=>sh.classList.remove('inert'),350);
}
function wsTvEndCancel(){
  const sh=document.getElementById('wsTvSheet'); if(sh) sh.classList.remove('show','inert');
}
function wsTvEndConfirm(){
  const ei=window.__wsTvEi;
  wsCloseTakeover();
  if(ei!=null&&typeof hiitEndEarly==='function') hiitEndEarly(ei);
}
