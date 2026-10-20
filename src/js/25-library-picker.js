
// ─── Library picker: rides the app's forgiving search (typo + synonym aware) ───
function wsPickerOpen(ei,si){
  const v=document.getElementById('wsPicker'); if(!v) return;
  window.__wsPick={ei,si};
  const ex=DAYS[curDay].items[ei];
  const cur=(si>=0&&ex&&ex.roundsCustom&&ex.roundsCustom[si])?(ex.roundsCustom[si].name||''):'';
  v.innerHTML=`<div class="ws-sheet">
    <div class="ws-sheet-head"><div class="ws-sheet-t">${si>=0?'Change station':'Add station'}</div><div class="ws-sheet-done" onclick="wsPickerClose()">Cancel</div></div>
    <input class="ws-pick-q" id="wsPickQ" value="${wsEsc(cur)}" placeholder="Search ${EXERCISES.length} exercises… or type your own" oninput="wsPickerSearch(this.value)">
    <div class="ws-pick-res" id="wsPickRes"></div>
  </div>`;
  v.classList.add('show');
  try{const q=document.getElementById('wsPickQ'); if(q&&q.focus) q.focus();}catch(_){}
  wsPickerSearch(cur);
}
function wsPickerClose(){ const v=document.getElementById('wsPicker'); if(v) v.classList.remove('show'); }
function wsPickerSearch(q){
  window.__wsPickQ=q||'';
  const res=document.getElementById('wsPickRes'); if(!res) return;
  const t=(q||'').trim();
  if(!t){ window.__wsPickResults=[]; res.innerHTML='<div class="ws-pick-hint">Type to search the library — typos and muscle names both work</div>'; return; }
  const scored=EXERCISES.map(e=>({e,sc:wsScoreEntry(e,t)})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,30);
  window.__wsPickResults=scored.map(x=>x.e);
  const free=`<div class="ws-pick-row free" onclick="wsPickerFree()">Use “${wsEsc(t)}” as typed</div>`;
  res.innerHTML=free+(scored.length?scored.map(x=>`<div class="ws-pick-row" onclick="wsPickerChoose('${wsEsc(x.e.exId)}')">
      <div class="ws-pick-t">${wsEsc(x.e.title)}</div>
      <div class="ws-pick-m">${wsEsc(((x.e.primary||[])[0])||'')}${x.e.equipment?' · '+wsEsc(x.e.equipment):''}</div></div>`).join('')
    :'<div class="ws-pick-hint">No library match — use it as typed above</div>');
}
function wsPickerApply(fn){
  const p=window.__wsPick; if(!p) return;
  const ex=DAYS[curDay].items[p.ei]; if(!ex) return;
  if(ex.simpleMode!==false){ ex.simpleMode=false; ex.roundsCustom=ex.roundsCustom||[]; }
  fn(ex,p);
  wsPickerClose(); wsPersist(); wsRenderCircEd(p.ei);
}
function wsPickerChoose(exId){
  const e=EXERCISES.find(x=>x.exId===exId); if(!e) return;
  wsPickerApply((ex,p)=>{
    if(p.si>=0&&ex.roundsCustom[p.si]){ ex.roundsCustom[p.si].exId=e.exId; ex.roundsCustom[p.si].name=e.title; }
    else ex.roundsCustom.push({exId:e.exId,name:e.title,work:30,rest:15});
  });
}
function wsPickerFree(){
  const t=(window.__wsPickQ||'').trim(); if(!t) return;
  wsPickerApply((ex,p)=>{
    if(p.si>=0&&ex.roundsCustom[p.si]){ ex.roundsCustom[p.si].name=t; delete ex.roundsCustom[p.si].exId; }
    else ex.roundsCustom.push({name:t,work:30,rest:15});
  });
}
