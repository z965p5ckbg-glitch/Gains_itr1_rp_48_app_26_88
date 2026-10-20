

// ─── Circuit editor (S5): the wrench. All config lives here; zero run-UI clutter. ───
const wsEsc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wsPersist(){ try{ wsPersistSave(); }catch(_){}}

function wsSlugify(t){return String(t||'circuit').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'circuit';}
function wsCESaveTemplate(ei){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  const title=(ex.name&&ex.name.trim())||wsCircuitAutoName(ex);
  let slug='tpl-'+wsSlugify(title), n=2;
  while(EXERCISES.some(e=>e&&e.exId===slug)){ slug='tpl-'+wsSlugify(title)+'-'+(n++); }
  const stations=(ex.roundsCustom||[]).map(r=>Object.assign({name:r.name||'',work:r.work||30,rest:r.rest||0},r.exId?{exId:r.exId}:{}));
  const prim=[...new Set(stations.flatMap(st=>{const e=st.exId&&EXERCISES.find(x=>x&&x.exId===st.exId);return (e&&e.primary)?e.primary:[];}))].slice(0,3);
  const base=EXERCISES.find(e=>e&&(e.roundsCustom||(e.defaults&&e.defaults.roundsCustom)));
  const nested=!!(base&&base.defaults&&base.defaults.roundsCustom);
  const core={simpleMode:false,roundsCustom:stations,totalRounds:ex.totalRounds||1,roundRest:ex.roundRest||0,setupSec:ex.setupSec||0,amrap:!!ex.amrap,capMin:ex.capMin||0,workSec:ex.workSec||30,restSec:ex.restSec||0};
  const entry=Object.assign({exId:slug,title:title,kind:(base&&base.kind)||'cardio_intervals',
    subtitle:'Circuit template · '+stations.length+' stations',
    primary:prim.length?prim:['Conditioning'],secondary:[],equipment:'Circuit',
    aliases:[title.toLowerCase(),'circuit','template'],patterns:['conditioning']},
    nested?{defaults:core}:core);
  EXERCISES.push(entry); wsPersist();
  const b=document.getElementById('wsCETplBtn');
  if(b){ b.textContent='Saved ✓ — in your Library'; b.classList.add('done');
    setTimeout(()=>{ try{ b.textContent='Save to Library as template'; b.classList.remove('done'); }catch(_){}} ,2200); }
}

function wsOpenCircuitEditor(ei){
  const v=document.getElementById('wsCircEd'); if(!v) return;
  window.__wsCEEi=ei; wsRenderCircEd(ei); v.classList.add('show');
}
function wsCloseCircEd(){
  const v=document.getElementById('wsCircEd'); if(!v) return;
  v.classList.remove('show'); wsPersist(); renderAll(false);
}
function wsStepHtml(ei,label,val,field,min,max,st,unit){
  return `<div class="ws-step"><div class="ws-step-l">${label}</div><div class="ws-step-c">
    <div class="ws-step-b" onclick="wsCEAdj(${ei},'${field}',-1,${min},${max},${st})">−</div>
    <div class="ws-step-v">${val}${unit||''}</div>
    <div class="ws-step-b" onclick="wsCEAdj(${ei},'${field}',1,${min},${max},${st})">+</div></div></div>`;
}
function wsRenderCircEd(ei){
  const v=document.getElementById('wsCircEd'); const ex=DAYS[curDay]&&DAYS[curDay].items[ei];
  if(!v||!ex){ if(v)v.classList.remove('show'); return; }
  const _ps=v.querySelector('.ws-sheet'); const _keep=_ps?_ps.scrollTop:0;
  const isSimple=ex.simpleMode!==false;
  const adv=!!window.__wsCEAdv;
  let body='';
  if(!isSimple){
    const a=ex.roundsCustom||[];
    const cols=adv?'30px 1fr 58px 58px 34px':'30px 1fr 58px 34px';
    const rests=[...new Set(a.map(st=>st.rest||0))];
    const restLbl=rests.length>1?'varies':(rests[0]||0)+'s';
    const rows=a.map((st,si)=>`<div class="ws-st-row2" data-si="${si}" style="grid-template-columns:${cols}">
      <div class="ws-st-grab" onpointerdown="wsStDragStart(event,${ei},${si})">≡</div>
      <div class="ws-st-name${st.exId?' linked':''}" onclick="wsPickerOpen(${ei},${si})">${wsEsc(st.name||('Station '+(si+1)))}${st.exId?'<span class="ws-link-dot"></span>':''}</div>
      <input class="ws-st-num" type="number" inputmode="numeric" value="${st.work||30}" onchange="wsCEStWork(${ei},${si},this.value)">
      ${adv?`<input class="ws-st-num" type="number" inputmode="numeric" value="${st.rest||0}" onchange="wsCEStRest(${ei},${si},this.value)">`:''}
      <div class="ws-st-x${window.__wsDelArm===(ei+':'+si)?' arm':''}" onclick="wsCEStDel(${ei},${si})">${window.__wsDelArm===(ei+':'+si)?'✓':'×'}</div>
    </div>`).join('');
    body=`<div class="ws-ce-card">
      <div class="ws-ce-cardt">Stations</div>
      <div class="ws-st-head2" style="grid-template-columns:${cols}"><span></span><span>Exercise</span><span>work s</span>${adv?'<span>rest s</span>':''}<span></span></div>
      ${rows||'<div class="ws-pick-hint">Add a station to run this circuit</div>'}
      <div class="ws-add-st" onclick="wsPickerOpen(${ei},-1)">+ Add station</div>
      ${adv?'':`<div class="ws-step" style="border-bottom:none;margin-top:4px"><div class="ws-step-l">Rest between stations</div><div class="ws-step-c">
        <div class="ws-step-b" onclick="wsCEURest(${ei},-1)">−</div><div class="ws-step-v">${restLbl}</div>
        <div class="ws-step-b" onclick="wsCEURest(${ei},1)">+</div></div></div>`}
    </div>
    <div class="ws-ce-card">
      <div class="ws-ce-cardt">Structure</div>
      ${ex.amrap?'':wsStepHtml(ei,'Rounds',ex.totalRounds||1,'totalRounds',1,30,1)}
      ${wsStepHtml(ei,'Round break',ex.roundRest||0,'roundRest',0,300,15,'s')}
      <div class="ws-toggle${ex.amrap?' on':''}" onclick="wsCEAmrap(${ei})"><div class="ws-step-l">AMRAP — as many rounds as possible</div><div class="tv">${ex.amrap?'On':'Off'}</div></div>
      ${ex.amrap?wsStepHtml(ei,'Time cap',ex.capMin||10,'capMin',1,60,1,' min'):''}
      ${adv?wsStepHtml(ei,'Setup',ex.setupSec||0,'setupSec',0,120,5,'s'):''}
    </div>`;
  } else {
    body=`<div class="ws-ce-card">
      <div class="ws-ce-cardt">Structure</div>
      ${wsStepHtml(ei,'Rounds',ex.totalRounds||1,'totalRounds',1,30,1)}
      ${wsStepHtml(ei,'Work',ex.workSec||30,'workSec',5,600,5,'s')}
      ${wsStepHtml(ei,'Rest',ex.restSec||0,'restSec',0,600,5,'s')}
      ${adv?wsStepHtml(ei,'Setup',ex.setupSec||0,'setupSec',0,120,5,'s'):''}
      <div class="ws-add-st" onclick="wsCEToStations(${ei})">Use stations instead</div>
    </div>`;
  }
  v.innerHTML=`<div class="ws-sheet ws-ce2">
    <div class="ws-ce2-grab"></div>
    <div class="ws-sheet-head"><div class="ws-sheet-t">Circuit</div><div class="ws-sheet-done" onclick="wsCloseCircEd()">Done</div></div>
    <div class="ws-ce-card">
      <input class="ws-ce-name" id="wsCEName" value="${wsEsc(ex.name||'')}" placeholder="${wsEsc(wsCircuitAutoName(ex))}" oninput="wsCEName(${ei},this.value)">
      <div class="ws-ce-auto" id="wsCEAuto">Auto: ${wsEsc(wsCircuitAutoName(ex))} — leave the name empty to use it</div>
      ${isSimple?'':`<div class="ws-ce-tpl" id="wsCETplBtn" onclick="wsCESaveTemplate(${ei})">Save to Library as template</div>`}
    </div>
    ${body}
    <div class="ws-ce-card">
      <div class="ws-ce-cardt">Cues</div>
      <div class="ws-toggle${exSnd(ex,'interval')?' on':''}" onclick="wsCESound(${ei})"><div class="ws-step-l">Sound cues</div><div class="tv">${exSnd(ex,'interval')?'On':'Off'}</div></div>
      <div class="ws-toggle${ex.voice?' on':''}" onclick="wsCEVoice(${ei})"><div class="ws-step-l">Voice cues (experimental)</div><div class="tv">${ex.voice?'On':'Off'}</div></div>
    </div>
    ${adv?`<div class="ws-ce-card">
      <div class="ws-ce-cardt">Start mode</div>
      <div class="ws-chips">
        <div class="ws-chip${ex.startMode==='takeover'?'':' on'}" onclick="wsCEStartMode(${ei},'inline')">In the day</div>
        <div class="ws-chip${ex.startMode==='takeover'?' on':''}" onclick="wsCEStartMode(${ei},'takeover')">Full screen</div>
      </div></div>`:''}
    <div class="ws-ce-adv" onclick="wsCEAdvToggle(${ei})"><span class="chev${adv?' open':''}">▸</span> Advanced${adv?'':' · per-station rest, setup, start mode'}</div>
  </div>`;
  const _ns=v.querySelector('.ws-sheet'); if(_ns) _ns.scrollTop=_keep;
}
function wsCEAdvToggle(ei){ window.__wsCEAdv=!window.__wsCEAdv; wsRenderCircEd(ei); }
function wsCEURest(ei,dir){ wsCEMut(ei,ex=>{ const a=ex.roundsCustom||[]; if(!a.length)return;
  const base=a[0].rest||0; const v=Math.max(0,Math.min(600,base+dir*5)); a.forEach(st=>st.rest=v); }); }
function wsStDragStart(e,ei,si){
  try{e.preventDefault();}catch(_){}
  const row=e.target&&e.target.closest?e.target.closest('.ws-st-row2'):null; if(!row) return;
  const y0=(e.clientY!=null)?e.clientY:((e.touches&&e.touches[0])?e.touches[0].clientY:0);
  const h=(row.offsetHeight||46)+6;
  window.__wsDrag={ei,si,to:si,y:y0,h,row};
  row.classList.add('dragging');
  const mv=ev=>{ const d=window.__wsDrag; if(!d) return;
    const y=(ev.clientY!=null)?ev.clientY:((ev.touches&&ev.touches[0])?ev.touches[0].clientY:d.y);
    const dy=y-d.y; d.row.style.transform='translateY('+dy+'px)';
    const n=(DAYS[curDay].items[d.ei].roundsCustom||[]).length;
    d.to=Math.max(0,Math.min(n-1,d.si+Math.round(dy/d.h)));
    try{ev.preventDefault();}catch(_){} };
  const up=()=>{ document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up);
    const d=window.__wsDrag; window.__wsDrag=null; if(!d) return;
    d.row.classList.remove('dragging'); d.row.style.transform='';
    if(d.to!==d.si) wsCEStMoveTo(d.ei,d.si,d.to); };
  document.addEventListener('pointermove',mv,{passive:false});
  document.addEventListener('pointerup',up);
}
function wsCEStMoveTo(ei,from,to){ wsCEMut(ei,ex=>{ const a=ex.roundsCustom; if(!a||from===to)return;
  const it=a.splice(from,1)[0]; a.splice(to,0,it); }); }
function wsCEMut(ei,fn){ const ex=DAYS[curDay].items[ei]; if(!ex)return; fn(ex); wsPersist(); wsRenderCircEd(ei); }
function wsCEName(ei,val){ const ex=DAYS[curDay].items[ei]; if(!ex)return; ex.name=val.trim(); wsPersist();
  const a=document.getElementById('wsCEAuto'); if(a)a.textContent='Leave empty for auto-naming · Auto: '+wsCircuitAutoName(ex); }
function wsCEAdj(ei,field,dir,min,max,st){ wsCEMut(ei,ex=>{ const v=(ex[field]||0)+dir*(st||1); ex[field]=Math.max(min,Math.min(max,v)); }); }
function wsCEToStations(ei){ wsCEMut(ei,ex=>{ ex.simpleMode=false; ex.roundsCustom=[{name:'Station 1',work:ex.workSec||30,rest:ex.restSec||15}]; ex.roundRest=ex.roundRest||60; }); }
function wsCEAmrap(ei){ wsCEMut(ei,ex=>{ ex.amrap=!ex.amrap; if(ex.amrap&&!(ex.capMin>0)) ex.capMin=10; }); }
function wsCESound(ei){ toggleExSound(ei); wsRenderCircEd(ei); }
function wsCEVoice(ei){ wsCEMut(ei,ex=>{ ex.voice=!ex.voice; }); }
function wsCEStartMode(ei,m){ wsCEMut(ei,ex=>{ ex.startMode=m; }); }
function wsCEStWork(ei,si,val){ wsCEMut(ei,ex=>{ const st=ex.roundsCustom[si]; if(st) st.work=Math.max(5,Math.min(600,parseInt(val)||30)); }); }
function wsCEStRest(ei,si,val){ wsCEMut(ei,ex=>{ const st=ex.roundsCustom[si]; if(st) st.rest=Math.max(0,Math.min(600,parseInt(val)||0)); }); }
function wsCEStDel(ei,si){
  const key=ei+':'+si;
  if(window.__wsDelArm!==key){
    window.__wsDelArm=key;
    clearTimeout(window.__wsDelT);
    window.__wsDelT=setTimeout(()=>{ window.__wsDelArm=null; wsRenderCircEd(ei); },1600);
    wsRenderCircEd(ei); return;
  }
  window.__wsDelArm=null;
  wsCEMut(ei,ex=>{ if(ex.roundsCustom) ex.roundsCustom.splice(si,1); });
}
