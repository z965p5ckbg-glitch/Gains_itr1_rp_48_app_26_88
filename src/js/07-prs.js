// ── PRs view. Every PR here is a STRICT all-time break of the exercise's
//    canonical metric, computed in wsProgBuild — the same events the gold
//    dots mark on the charts. No window-best, no ties, no invention.
let wsPRSort='recent';   // recent | exercise
function wsPRCollect(){
  const data=wsProgBuild('ALL');
  const events=[];
  const bests=[];
  data.list.forEach(x=>{
    (x.all||[]).forEach(p=>{
      if(p.pr) events.push({ t:p.t, name:x.name, key:x.key, kind:x.kind,
        label:wsProgFmtVal(x,p._cv), raw:p._cv, muscles:x.muscles||[] });
    });
    if(x.allBest!=null) bests.push({ name:x.name, key:x.key, kind:x.kind,
      label:wsProgFmtVal(x,x.allBest), t:x.lastT, prs:(x.all||[]).filter(p=>p.pr).length });
  });
  events.sort((a,b)=>b.t-a.t);
  bests.sort((a,b)=>b.t-a.t);
  return { events, bests };
}
function wsPRSetSort(v){ wsPRSort=v; wsPRRender(); }
function wsPRRender(){
  const root=document.getElementById('histView'); if(!root) return;
  const {events,bests}=wsPRCollect();
  const hdr=`<div class="hi-hdr"><div class="hi-hdr-main">
      <div class="hi-hdr-title">P<em>Rs</em></div>
      <div class="hi-hdr-gear" onclick="openSettings()" aria-label="Settings"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="3.2"/><path d="M11 2.8v2.4M11 16.8v2.4M2.8 11h2.4M16.8 11h2.4M5.2 5.2l1.7 1.7M15.1 15.1l1.7 1.7M16.8 5.2l-1.7 1.7M6.9 15.1l-1.7 1.7"/></svg></div>
    </div></div>`;
  if(!events.length){
    root.innerHTML=hdr+`<div class="hi-scroll"><div class="hi-empty">
      <div class="hi-empty-icon"><svg viewBox="0 0 24 24"><polyline points="2 16 7 10 12 13 20 4"/><polyline points="15 4 20 4 20 9"/></svg></div>
      <div class="hi-empty-title">No records yet</div>
      <div class="hi-empty-sub">Your first session of an exercise sets the baseline. Beat it, and the record shows up here — and as a gold dot on that exercise's chart.</div>
    </div></div>`;
    return;
  }
  const seg=`<div class="wsprog-ctl"><div class="wsprog-chipsrow">
      <div class="wsprog-fchip${wsPRSort==='recent'?' on':''}" onclick="wsPRSetSort('recent')">Recent</div>
      <div class="wsprog-fchip${wsPRSort==='exercise'?' on':''}" onclick="wsPRSetSort('exercise')">By exercise</div>
    </div></div>`;
  let body='';
  if(wsPRSort==='recent'){
    body=`<div class="wsprog-sect">Records · ${events.length}</div><div class="wspr-list">`+
      events.slice(0,60).map(e=>`<div class="wspr-row" onclick="wsPRGo('${encodeURIComponent(e.key)}')">
        <div class="wspr-v">${e.label}</div>
        <div class="wspr-m"><div class="wspr-n">${hiEscape(e.name)}</div>
        <div class="wspr-d">${wsProgFmtDate(e.t)}</div></div>
      </div>`).join('')+`</div>`;
    if(events.length>60) body+=`<div class="wsprog-more">Showing the 60 most recent of ${events.length}</div>`;
  } else {
    body=`<div class="wsprog-sect">Current bests · ${bests.length}</div><div class="wspr-list">`+
      bests.map(b=>`<div class="wspr-row" onclick="wsPRGo('${encodeURIComponent(b.key)}')">
        <div class="wspr-v">${b.label}</div>
        <div class="wspr-m"><div class="wspr-n">${hiEscape(b.name)}</div>
        <div class="wspr-d">${b.prs} record${b.prs===1?'':'s'} set</div></div>
      </div>`).join('')+`</div>`;
  }
  root.innerHTML=hdr+`<div class="hi-scroll wsprog-scroll">${seg}${body}
    ${wsAcuteChronicPanel()}<div class="wsprog-foot">A record is a session that beat everything before it on that exercise's main measure — estimated 1RM for loaded lifts, reps for bodyweight, pace for distance work, rounds for circuits. Ties don't count.</div>
  </div>`;
}
function wsPRGo(keyEnc){
  wsProgExId=decodeURIComponent(keyEnc);
  window.__wsProgCmp=false;
  window.__wsProgKeepDetail=true;
  routeTo('progress');
}
