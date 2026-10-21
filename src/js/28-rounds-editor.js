
// === ROUNDS EDITOR (simple + advanced modes) ===
function setRoundsMode(simple){
  cardioEditCtx.temp.simpleMode=simple;
  document.querySelectorAll('.rmt-btn').forEach((el,i)=>el.classList.toggle('active',(i===0)===simple));
  renderRoundsModeBody();
}

function renderRoundsModeBody(){
  const body=document.getElementById('roundsModeBody');
  if(!body) return;
  const setupSec=cardioEditCtx.temp.setupSec||0;
  const setupHtml=`
      <div class="sh-fields" style="padding:0 0 14px 0">
        <div class="sh-f"><span class="sh-fl" style="color:var(--lilac)">Setup</span><div class="stepper"><button class="sb" onclick="stepSimple('setupSec',-5)">−</button><div class="sm"><span class="sv" id="srSetup">${setupSec===0?'Off':setupSec}</span><span class="su">${setupSec===0?'no setup':'seconds before start'}</span></div><button class="sb" onclick="stepSimple('setupSec',5)">+</button></div></div>
      </div>`;
  if(cardioEditCtx.temp.simpleMode){
    const tr=cardioEditCtx.temp.totalRounds||1;
    const ws=cardioEditCtx.temp.workSec||40;
    const rs=cardioEditCtx.temp.restSec!==undefined?cardioEditCtx.temp.restSec:20;
    body.innerHTML=setupHtml+wsPresetRowHtml()+`
      <div class="sh-fields" style="padding:0 0 14px 0">
        <div class="sh-f"><span class="sh-fl">Cycles</span><div class="stepper"><button class="sb" onclick="stepSimple('totalRounds',-1)">−</button><div class="sm"><span class="sv" id="srTr">${tr}</span><span class="su">rounds</span></div><button class="sb" onclick="stepSimple('totalRounds',1)">+</button></div></div>
      </div>
      <div class="sh-fields" style="padding:0 0 14px 0">
        <div class="sh-f"><span class="sh-fl">Work</span><div class="stepper"><button class="sb" onclick="stepSimple('workSec',-5)">−</button><div class="sm"><span class="sv" id="srWs">${ws}</span><span class="su">seconds</span></div><button class="sb" onclick="stepSimple('workSec',5)">+</button></div></div>
      </div>
      <div class="sh-fields" style="padding:0 0 14px 0">
        <div class="sh-f"><span class="sh-fl">Rest</span><div class="stepper"><button class="sb" onclick="stepSimple('restSec',-5)">−</button><div class="sm"><span class="sv" id="srRs">${rs}</span><span class="su">seconds</span></div><button class="sb" onclick="stepSimple('restSec',5)">+</button></div></div>
      </div>
      <div class="adv-rounds-totals">
        <span>Total time:<strong id="srTotal">${fmtMS(setupSec+tr*ws+(tr-1)*rs)}</strong></span>
        <span>${tr*2-1} segments</span>
      </div>`;
  } else {
    // Advanced: setup row + list of custom rounds
    body.innerHTML=setupHtml+`<div id="advRoundsContainer"></div>`;
    setTimeout(()=>renderAdvancedRoundsList(),10);
  }
}

function renderAdvancedRoundsList(){
  const body=document.getElementById('advRoundsContainer')||document.getElementById('roundsModeBody');
  if(!body) return;
  const rounds=cardioEditCtx.temp.roundsCustom;
  let totalSec=0;
  rounds.forEach(r=>{totalSec+=(r.work||0)+(r.rest||0);});

  // Hint shown when timer is running — edits apply from next round forward
  const ex=DAYS[curDay].items[cardioEditCtx.ei];
  const isRunning=ex&&(ex.phase==='work'||ex.phase==='rest'||ex.phase==='paused');
  let hintHtml='';
  if(isRunning){
    hintHtml=`<div class="rounds-edit-hint"><strong>Timer running.</strong> Changes apply from the next round forward — current round finishes with its existing values.</div>`;
  }

  let html=hintHtml+'<div class="advanced-rounds-list">';
  rounds.forEach((r,i)=>{
    const noRestCls=(r.rest===0)?'no-rest':'';
    const restDisplay=r.rest===0?'no rest':(r.rest+' s');
    html+=`<div class="adv-round">
      <div class="adv-round-header">
        <span class="adv-round-num">Round ${i+1}</span>
        <div class="adv-round-del" onclick="delAdvRound(${i})" title="Remove round">
          <svg viewBox="0 0 16 16"><path d="M3 5h10M6 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M5 5l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      <input class="adv-round-name" type="text" placeholder="Round name (e.g. KB Swings)" value="${(r.name||'').replace(/"/g,'&quot;')}" oninput="updateAdvRound(${i},'name',this.value)" />
      <div class="adv-round-times">
        <div class="adv-r-time">
          <span class="adv-r-time-lbl">Work</span>
          <div class="adv-r-time-row">
            <div class="adv-r-time-btn" onclick="advRoundDelta(${i},'work',-5)">−</div>
            <div class="adv-r-time-val" id="advW${i}">${r.work}<small>s</small></div>
            <div class="adv-r-time-btn" onclick="advRoundDelta(${i},'work',5)">+</div>
          </div>
        </div>
        <div class="adv-r-time">
          <span class="adv-r-time-lbl">Rest</span>
          <div class="adv-r-time-row">
            <div class="adv-r-time-btn" onclick="advRoundDelta(${i},'rest',-5)">−</div>
            <div class="adv-r-time-val ${noRestCls}" id="advR${i}">${restDisplay}</div>
            <div class="adv-r-time-btn" onclick="advRoundDelta(${i},'rest',5)">+</div>
          </div>
        </div>
      </div>
    </div>`;
  });
  html+='</div>';
  html+=`<div class="adv-round-add" onclick="addAdvRound()">+ ADD ROUND</div>`;
  html+=`<div class="adv-rounds-totals">
    <span>Total time:<strong>${fmtMS(totalSec)}</strong></span>
    <span>${rounds.length} ${rounds.length===1?'round':'rounds'} · rest=0 → no break</span>
  </div>`;
  body.innerHTML=html;
}

// ± stepper for advanced rounds — applies to work or rest field
function advRoundDelta(idx,key,delta){
  playKnock();
  const r=cardioEditCtx.temp.roundsCustom[idx];
  if(!r) return;
  const min=key==='rest'?0:5;
  const max=600;
  r[key]=Math.max(min,Math.min(max,(r[key]||0)+delta));
  // Update specific cell + totals (avoid full re-render to keep focus + scroll)
  const valEl=document.getElementById((key==='work'?'advW':'advR')+idx);
  if(valEl){
    if(key==='rest'){
      valEl.innerHTML=r.rest===0?'no rest':(r.rest+'<small>s</small>');
      valEl.classList.toggle('no-rest',r.rest===0);
    } else {
      valEl.innerHTML=r.work+'<small>s</small>';
    }
  }
  // Update totals row
  const totals=document.querySelector('.adv-rounds-totals');
  if(totals){
    let totalSec=0;
    cardioEditCtx.temp.roundsCustom.forEach(rd=>{totalSec+=(rd.work||0)+(rd.rest||0);});
    const ct=cardioEditCtx.temp.roundsCustom.length;
    totals.innerHTML=`<span>Total time:<strong>${fmtMS(totalSec)}</strong></span><span>${ct} ${ct===1?'round':'rounds'} · rest=0 → no break</span>`;
  }
}

// Interval steppers move in 5s below a minute, 10s below two, 30s above that,
// snapped to the grid. Keeps short intervals precise without making a 4-minute
// work block a 42-tap journey.
function wsIntervalStep(cur,delta){
  cur=cur||0;
  const mag = cur>=120 ? 30 : (cur>=60 ? 10 : 5);
  let next = Math.round((cur + (delta>0?mag:-mag))/mag)*mag;
  if(next===cur) next = cur + (delta>0?mag:-mag);
  return next;
}
// Named protocols. Every one of these already fits the engine's 5-600s clamp —
// they were simply undiscoverable: the words Tabata, EMOM and 4x4 appeared
// nowhere in the app.
const WS_INTERVAL_PRESETS=[
  {n:'Tabata',       w:20,  r:10,  c:8, t:'20s on / 10s off x8'},
  {n:'30:15',        w:30,  r:15,  c:10,t:'30s on / 15s off x10'},
  {n:'40:20',        w:40,  r:20,  c:8, t:'40s on / 20s off x8'},
  {n:'1:1',          w:60,  r:60,  c:8, t:'60s on / 60s off x8'},
  {n:'1:2',          w:30,  r:60,  c:8, t:'30s on / 60s off x8'},
  {n:'Norwegian 4x4',w:240, r:180, c:4, t:'4min hard / 3min easy x4'},
];
function wsApplyIntervalPreset(i){
  const p=WS_INTERVAL_PRESETS[i]; if(!p||!window.cardioEditCtx||!cardioEditCtx.temp) return;
  try{ playKnock(); }catch(_){}
  cardioEditCtx.temp.simpleMode=true;
  cardioEditCtx.temp.workSec=p.w;
  cardioEditCtx.temp.restSec=p.r;
  cardioEditCtx.temp.totalRounds=p.c;
  renderRoundsModeBody();
}
function wsPresetRowHtml(){
  const cur=cardioEditCtx&&cardioEditCtx.temp?cardioEditCtx.temp:{};
  return '<div style="padding:0 0 14px 0">'
    +'<div class="sh-fl" style="display:block;margin:0 0 8px 2px;opacity:.75">Protocol</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + WS_INTERVAL_PRESETS.map(function(p,i){
        const on = cur.workSec===p.w && cur.restSec===p.r && cur.totalRounds===p.c;
        return '<button title="'+p.t+'" onclick="wsApplyIntervalPreset('+i+')" style="'
          +'font:600 13px/1 inherit;min-height:44px;padding:0 14px;border-radius:999px;cursor:pointer;'+'display:inline-flex;align-items:center;justify-content:center;'
          +'border:1px solid '+(on?'var(--lilac)':'rgba(255,255,255,.16)')+';'
          +'background:'+(on?'rgba(174,148,255,.18)':'rgba(255,255,255,.05)')+';'
          +'color:'+(on?'var(--lilac)':'inherit')+'">'+p.n+'</button>';
      }).join('')
    +'</div></div>';
}
function stepSimple(key,delta){
  playKnock();
  if(key==='totalRounds') cardioEditCtx.temp.totalRounds=Math.max(1,Math.min(99,cardioEditCtx.temp.totalRounds+delta));
  else if(key==='workSec') cardioEditCtx.temp.workSec=Math.max(5,Math.min(600,wsIntervalStep(cardioEditCtx.temp.workSec,delta)));
  else if(key==='restSec') cardioEditCtx.temp.restSec=Math.max(0,Math.min(600,wsIntervalStep(cardioEditCtx.temp.restSec,delta)));
  else if(key==='setupSec') cardioEditCtx.temp.setupSec=Math.max(0,Math.min(60,(cardioEditCtx.temp.setupSec||0)+delta));
  renderRoundsModeBody();
}

function updateAdvRound(idx,key,val){
  const r=cardioEditCtx.temp.roundsCustom[idx];
  if(!r) return;
  r[key]=val;
  // Only update totals row to avoid losing input focus
  const totals=document.querySelector('.adv-rounds-totals');
  if(totals){
    let totalSec=0;
    cardioEditCtx.temp.roundsCustom.forEach(rd=>{totalSec+=(rd.work||0)+(rd.rest||0);});
    const ct=cardioEditCtx.temp.roundsCustom.length;
    totals.innerHTML=`<span>Total time:<strong>${fmtMS(totalSec)}</strong></span><span>${ct} ${ct===1?'round':'rounds'} · rest=0 → no break</span>`;
  }
}

function addAdvRound(){
  playKnock();
  const last=cardioEditCtx.temp.roundsCustom[cardioEditCtx.temp.roundsCustom.length-1]||{work:40,rest:20};
  const newIdx=cardioEditCtx.temp.roundsCustom.length+1;
  cardioEditCtx.temp.roundsCustom.push({name:`Round ${newIdx}`,work:last.work||40,rest:last.rest!==undefined?last.rest:20});
  renderAdvancedRoundsList();
}

function delAdvRound(idx){
  if(cardioEditCtx.temp.roundsCustom.length<=1) return;
  playKnock();
  cardioEditCtx.temp.roundsCustom.splice(idx,1);
  renderAdvancedRoundsList();
}

// Piecewise non-linear mapping with multiple breakpoints.
// Accepts either a raw zones array OR a preset object with .zones property
// (so call sites can pass SLIDER_ZONES.duration directly without .zones unwrap).
function posToVal(pos,arg){
  const zones = Array.isArray(arg) ? arg : arg.zones;
  if(!Array.isArray(zones)) return pos*arg; // backward compat (number)
  pos=Math.max(0,Math.min(1,pos));
  for(let i=1;i<zones.length;i++){
    const a=zones[i-1],b=zones[i];
    if(pos<=b.pos){
      const t=(pos-a.pos)/(b.pos-a.pos);
      return a.val+t*(b.val-a.val);
    }
  }
  return zones[zones.length-1].val;
}
function valToPos(val,arg){
  const zones = Array.isArray(arg) ? arg : arg.zones;
  if(!Array.isArray(zones)) return val/arg;
  val=Math.max(zones[0].val,Math.min(zones[zones.length-1].val,val));
  for(let i=1;i<zones.length;i++){
    const a=zones[i-1],b=zones[i];
    if(val<=b.val){
      const t=(val-a.val)/(b.val-a.val);
      return a.pos+t*(b.pos-a.pos);
    }
  }
  return 1;
}

// Predefined zone curves
// Each preset has:
// - zones: piecewise mapping curve (pos→val)
// - milestones: values that the slider snaps to magnetically (full set, used by snap logic only)
// - visualMarks: subset of milestones rendered as visible dots on the track (kept sparse for clarity)
// - stepSchedule: array of {threshold, step} pairs — fine-tune step size scales with current value
const SLIDER_ZONES={
  duration:{
    zones:[
      {pos:0,val:0},
      {pos:0.25,val:120},     // 0-2 min in first 25% (fine control here)
      {pos:0.70,val:3600},    // 2 min - 60 min in next 45%
      {pos:1.0,val:59940}     // 60 min - 999 min in last 30%
    ],
    // Common workout durations users want to land on quickly (snap-only)
    milestones:[60,120,300,600,900,1200,1500,1800,2700,3600,5400,7200,10800,14400,21600,36000],
    // Visible track dots — a small symmetric set of anchors
    visualMarks:[60,600,3600,14400],
    stepSchedule:[
      {threshold:120, step:5,    label:'5s'},
      {threshold:3600,step:30,   label:'30s'},
      {threshold:59940,step:600, label:'10m'}
    ]
  },
  distanceKm:{
    zones:[
      {pos:0,val:0},
      {pos:0.30,val:5},       // 0-5 km in first 30%
      {pos:0.70,val:30},      // 5-30 km in next 40%
      {pos:1.0,val:999}       // 30-999 km in last 30%
    ],
    milestones:[0.05,0.1,0.2,0.3,0.4,0.5,1,1.5,2,3,4,5,7.5,10,15,20,25,30,42.195,45,50,75,100,150,200,250,300,500,750,999],
    // Sparse anchors: 1km, 5km, 10km, 21.1km (half), 42.195km (marathon), 100km
    visualMarks:[1,5,10,21.0975,42.195,100],
    stepSchedule:[
      {threshold:0.5,  step:0.01,  label:'10 m'},
      {threshold:1,    step:0.05,  label:'50 m'},
      {threshold:5,    step:0.1,   label:'100 m'},
      {threshold:45,   step:0.5,   label:'500 m'},
      {threshold:999,  step:5,     label:'5 km'}
    ]
  },
  distanceM:{
    zones:[
      {pos:0,val:0},
      {pos:0.30,val:150},     // 0-150 m in first 30%
      {pos:0.70,val:3000},    // 150-3000 m in next 40%
      {pos:1.0,val:20000}     // 3km-20km in last 30%
    ],
    milestones:[25,50,100,150,200,250,300,400,500,750,1000,1500,2000,2500,3000,5000,7500,10000,15000,20000],
    visualMarks:[100,500,1000,5000,10000],
    stepSchedule:[
      {threshold:500,   step:10,   label:'10 m'},
      {threshold:1000,  step:50,   label:'50 m'},
      {threshold:5000,  step:100,  label:'100 m'},
      {threshold:20000, step:500,  label:'500 m'}
    ]
  },
  workRestSec:{
    zones:[
      {pos:0,val:0},
      {pos:0.60,val:60},      // 0-60s in first 60%
      {pos:1.0,val:600}       // 60s-10 min in last 40%
    ],
    milestones:[10,15,20,30,45,60,90,120,180,240,300,420,600],
    // Sparse: 30s (sprint), 60s (boundary), 3m (full recovery)
    visualMarks:[30,60,180],
    stepSchedule:[
      {threshold:60,  step:5,  label:'5s'},
      {threshold:600, step:30, label:'30s'}
    ]
  }
};

// Helper: pick the step size for a given value from a stepSchedule
function getAdaptiveStep(value, stepSchedule){
  for(let i=0;i<stepSchedule.length;i++){
    if(value < stepSchedule[i].threshold) return stepSchedule[i];
  }
  return stepSchedule[stepSchedule.length-1];
}

// Helper: find the nearest milestone within a position-tolerance window
function snapToMilestone(val, zones, milestones, posTolerance){
  if(!milestones||!milestones.length) return val;
  const valPos = valToPos(val, zones);
  let bestVal = val, bestDelta = Infinity;
  for(const m of milestones){
    const mPos = valToPos(m, zones);
    const delta = Math.abs(mPos - valPos);
    if(delta < posTolerance && delta < bestDelta){
      bestDelta = delta;
      bestVal = m;
    }
  }
  return bestVal;
}

// Render small visible tick marks on the slider track for visual landmarks only.
// Uses preset.visualMarks (a sparse subset of milestones) to keep the track uncluttered.
// All milestones still snap magnetically — visualMarks is purely for visual reference.
function renderMilestoneTicks(preset){
  if(!preset) return '';
  const marks=preset.visualMarks||preset.milestones||[];
  return marks.map(m=>{
    const pos=valToPos(m,preset)*100;
    return `<div class="slider-milestone" style="left:${pos}%"></div>`;
  }).join('');
}

function bindSlider(prefix,wrapId,trackId,fillId,handleId,displayId,preset,fmtFn,formatVal,fineTuneLabelId){
  // preset: full SLIDER_ZONES object (with .zones, .milestones, .stepSchedule)
  // fmtFn: how to format value for display.textContent
  // formatVal: optional alternative formatter (used for distance with unit switch)
  // fineTuneLabelId: optional id of an element whose text should reflect current step size
  const wrap=document.getElementById(wrapId);
  const track=document.getElementById(trackId);if(!track) return;
  const fill=document.getElementById(fillId);
  const handle=document.getElementById(handleId);
  const display=document.getElementById(displayId);
  const labelEl=fineTuneLabelId?document.getElementById(fineTuneLabelId):null;
  const zones=preset.zones||preset; // backward compat
  const milestones=preset.milestones||[];
  const stepSchedule=preset.stepSchedule||[];
  let dragging=false;
  // grabMode: when user taps near the handle, we grab without jumping —
  // the press gesture is interpreted as "pick up the handle" rather than "set new value"
  // Drag movements still update normally.
  let grabMode=false;
  const minVal=zones[0].val;
  const maxVal=zones[zones.length-1].val;
  // Magnetic snap tolerance — 1.5% of slider width
  const SNAP_TOL=0.015;
  // Touch target around handle (in pixels) within which a press becomes a grab, not a jump
  const GRAB_RADIUS=32;
  function setFromX(clientX){
    const rect=track.getBoundingClientRect();
    let pos=(clientX-rect.left)/rect.width;
    pos=Math.max(0,Math.min(1,pos));
    // Edge magnetism
    if(pos<0.012) pos=0;
    if(pos>0.988) pos=1;
    let val=posToVal(pos,zones);
    // Adaptive step — round to current step size based on value
    const adaptiveStep=stepSchedule.length?getAdaptiveStep(val,stepSchedule).step:1;
    val=Math.round(val/adaptiveStep)*adaptiveStep;
    val=parseFloat(val.toFixed(3));
    // Milestone snap
    val=snapToMilestone(val,zones,milestones,SNAP_TOL);
    if(val>maxVal) val=maxVal;
    if(val<minVal) val=minVal;
    if(prefix==='dur'){cardioEditCtx.temp.totalSec=val;display.textContent=fmtFn(val);}
    else if(prefix==='dist'){cardioEditCtx.temp.value=val;display.textContent=formatVal?formatVal(val):val;}
    else if(prefix==='act'){cardioEditCtx.temp.totalSec=val;display.textContent=fmtFn(val);}
    else if(prefix==='work'||prefix==='rest'){cardioEditCtx.temp.value=val;display.textContent=val;}
    const visualPct=valToPos(val,zones)*100;
    fill.style.width=visualPct+'%';handle.style.left=visualPct+'%';
    // Update fine-tune label if provided
    if(labelEl&&stepSchedule.length){
      const cur=getAdaptiveStep(val,stepSchedule);
      labelEl.textContent='FINE-TUNE · '+cur.label;
    }
    // Also update distance unit suffix if it's a distance slider with formatVal
    if(prefix==='dist'&&cardioEditCtx.temp.unitEl&&cardioEditCtx.temp.unitGetter){
      cardioEditCtx.temp.unitEl.textContent=cardioEditCtx.temp.unitGetter(val);
    }
  }
  const onDown=e=>{
    dragging=true;
    if(wrap) wrap.classList.add('dragging');
    const x=e.touches?e.touches[0].clientX:e.clientX;
    // Determine if the press is near the handle's current position
    const handleRect=handle.getBoundingClientRect();
    const handleCx=handleRect.left+handleRect.width/2;
    const dist=Math.abs(x-handleCx);
    grabMode=dist<=GRAB_RADIUS;
    if(!grabMode){
      // Press is far from handle — jump to that value immediately
      setFromX(x);
    }
    // If grabMode, do nothing on initial press — wait for drag movement
    e.preventDefault();
  };
  const onMove=e=>{
    if(!dragging) return;
    const x=e.touches?e.touches[0].clientX:e.clientX;
    setFromX(x);
  };
  const onUp=()=>{
    if(dragging){playKnock();}
    dragging=false;
    grabMode=false;
    if(wrap) wrap.classList.remove('dragging');
  };
  const target=wrap||track;
  target.addEventListener('mousedown',onDown);
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
  target.addEventListener('touchstart',onDown,{passive:false});
  window.addEventListener('touchmove',onMove,{passive:true});
  window.addEventListener('touchend',onUp);
}

function setIntensity(v){
  cardioEditCtx.temp.value=v;
  ['Low','Mod','High'].forEach(k=>{const el=document.getElementById('seg-'+k);if(el) el.classList.toggle('active',k===v);});
  playKnock();
}
function stepDurSec(dir){
  playKnock();
  const preset=cardioEditCtx.temp.preset||SLIDER_ZONES.duration;
  const zones=preset.zones;
  const max=zones[zones.length-1].val;
  const cur=cardioEditCtx.temp.totalSec;
  const step=getAdaptiveStep(cur,preset.stepSchedule);
  let next=cur+dir*step.step;
  // Snap onto step grid (so increments don't drift if user crossed thresholds)
  next=Math.round(next/step.step)*step.step;
  cardioEditCtx.temp.totalSec=Math.max(0,Math.min(max,next));
  document.getElementById('durDisplay').textContent=fmtMS(cardioEditCtx.temp.totalSec);
  const fill=document.getElementById('durFill');const handle=document.getElementById('durHandle');
  const pct=valToPos(cardioEditCtx.temp.totalSec,zones)*100;
  if(fill) fill.style.width=pct+'%';if(handle) handle.style.left=pct+'%';
  const lbl=document.getElementById('durFineLbl');
  if(lbl) lbl.textContent='FINE-TUNE · '+getAdaptiveStep(cardioEditCtx.temp.totalSec,preset.stepSchedule).label;
}
function stepActSec(dir){
  playKnock();
  const preset=cardioEditCtx.temp.preset||SLIDER_ZONES.duration;
  const zones=preset.zones;
  const max=zones[zones.length-1].val;
  const cur=cardioEditCtx.temp.totalSec;
  const step=getAdaptiveStep(cur,preset.stepSchedule);
  let next=cur+dir*step.step;
  next=Math.round(next/step.step)*step.step;
  cardioEditCtx.temp.totalSec=Math.max(60,Math.min(max,next));
  document.getElementById('actDisplay').textContent=fmtMS(cardioEditCtx.temp.totalSec);
  const fill=document.getElementById('actFill');const handle=document.getElementById('actHandle');
  const pct=valToPos(cardioEditCtx.temp.totalSec,zones)*100;
  if(fill) fill.style.width=pct+'%';if(handle) handle.style.left=pct+'%';
  const lbl=document.getElementById('actFineLbl');
  if(lbl) lbl.textContent='FINE-TUNE · '+getAdaptiveStep(cardioEditCtx.temp.totalSec,preset.stepSchedule).label;
}
function stepDistFine(dir){
  playKnock();
  const preset=cardioEditCtx.temp.preset;
  const zones=preset.zones;
  const max=zones[zones.length-1].val;
  const cur=cardioEditCtx.temp.value;
  const step=getAdaptiveStep(cur,preset.stepSchedule);
  let next=cur+dir*step.step;
  next=Math.round(next/step.step)*step.step;
  cardioEditCtx.temp.value=Math.max(0,Math.min(max,parseFloat(next.toFixed(3))));
  const fmtv=cardioEditCtx.temp.formatVal||(v=>String(v));
  document.getElementById('distDisplay').textContent=fmtv(cardioEditCtx.temp.value);
  if(cardioEditCtx.temp.unitEl&&cardioEditCtx.temp.unitGetter){
    cardioEditCtx.temp.unitEl.textContent=cardioEditCtx.temp.unitGetter(cardioEditCtx.temp.value);
  }
  const fill=document.getElementById('distFill');const handle=document.getElementById('distHandle');
  const pct=valToPos(cardioEditCtx.temp.value,zones)*100;
  if(fill) fill.style.width=pct+'%';if(handle) handle.style.left=pct+'%';
  const lbl=document.getElementById('distFineLbl');
  if(lbl) lbl.textContent='FINE-TUNE · '+getAdaptiveStep(cardioEditCtx.temp.value,preset.stepSchedule).label;
}
function stepWRFine(dir){
  playKnock();
  const preset=cardioEditCtx.temp.preset||SLIDER_ZONES.workRestSec;
  const zones=preset.zones;
  const max=zones[zones.length-1].val;
  const cur=cardioEditCtx.temp.value;
  const step=getAdaptiveStep(cur,preset.stepSchedule);
  let next=cur+dir*step.step;
  next=Math.round(next/step.step)*step.step;
  cardioEditCtx.temp.value=Math.max(0,Math.min(max,next));
  document.getElementById('wrDisplay').textContent=cardioEditCtx.temp.value;
  const fill=document.getElementById('wrFill');const handle=document.getElementById('wrHandle');
  const pct=valToPos(cardioEditCtx.temp.value,zones)*100;
  if(fill) fill.style.width=pct+'%';if(handle) handle.style.left=pct+'%';
  const lbl=document.getElementById('wrFineLbl');
  if(lbl) lbl.textContent='FINE-TUNE · '+getAdaptiveStep(cardioEditCtx.temp.value,preset.stepSchedule).label;
}
function stepRounds(d){playKnock();if(!window.cardioEditCtx||!cardioEditCtx.temp)return;cardioEditCtx.temp.value=Math.max(0,Math.min(99,cardioEditCtx.temp.value+d));/* v47: #rndVal is never created anywhere in the file - this threw a TypeError. stepRounds is currently unreachable so it never fired, but it was a landmine. */const el=document.getElementById('rndVal');if(el)el.textContent=cardioEditCtx.temp.value;}
function stepTotalRounds(d){playKnock();cardioEditCtx.temp.value=Math.max(1,Math.min(99,cardioEditCtx.temp.value+d));document.getElementById('trVal').textContent=cardioEditCtx.temp.value;}

function saveCardioEdit(){
  if(!cardioEditCtx) return;
  const {ei,field,temp,listKey}=cardioEditCtx;
  const ex=DAYS[curDay].items[ei];
  if(!ex) return;
  // v55: picking an intensity or a goal no longer marks the item done — the
  // cardio counterpart of v47's "editing a set must not tick it". Done means
  // the timer ran, the run was finished, or a distance was entered.
  if(field==='intensity'){ex.intensity=temp.value;}
  else if(field==='duration'){
    const newGoal=temp.totalSec;
    const oldGoal=ex.duration||0;
    const isOpen=ex.timerMode==='open';
    if(ex.rs==='idle'){
      // Pure goal-set: update duration; rl mirrors for limit-mode display
      ex.duration=newGoal;
      ex.rl=isOpen?0:newGoal;
    } else if(ex.rs==='running'||ex.rs==='paused'){
      // Live edit while timer is active.
      // Limit mode: keep elapsed the same, recalc remaining = newGoal - elapsed (clamp ≥ 0)
      // Open mode: timer keeps counting, just update goal display
      if(!isOpen){
        const elapsed=Math.max(0,oldGoal-ex.rl);
        ex.duration=newGoal;
        ex.rl=Math.max(0,newGoal-elapsed);
        // If user shortened goal below current elapsed, the limit is already past — finish gracefully
        if(ex.rl===0&&elapsed>0){
          if(activityIntervals[ei]) clearInterval(activityIntervals[ei]);
          ex.actualDuration=elapsed;
          ex.logged=true;ex.rs='ready';
          maybeReleaseWakeLock();
        }
      } else {
        ex.duration=newGoal;
      }
    } else if(ex.rs==='ready'){
      // After completion, "Duration" edit means correcting the logged result
      ex.actualDuration=newGoal;
      ex.duration=newGoal; // also update goal so subsequent runs start from corrected value
      ex.rl=isOpen?0:newGoal;
    }
    // (v55: no blanket ex.logged here — while idle this edit sets the GOAL)
  }
  else if(field==='distance'){ex.distance=temp.value;if(temp.value>0) ex.logged=true;}
  else if(field==='activityLimit'){
    // Legacy field — now equivalent to duration goal. Route to same handler.
    ex.duration=temp.totalSec;
    if(ex.rs==='idle') ex.rl=ex.timerMode==='open'?0:temp.totalSec;
  }
  else if(field==='strengthRest'){ex.rest=temp.value;if(ex.rs==='idle') ex.rl=temp.value;}
  else if(field==='rounds'){
    // Full rounds editor — writes simpleMode, totalRounds OR roundsCustom, plus setupSec
    ex.simpleMode=temp.simpleMode;
    ex.setupSec=temp.setupSec||0;
    if(temp.simpleMode){
      ex.totalRounds=temp.totalRounds;
      ex.workSec=temp.workSec;
      ex.restSec=temp.restSec;
    } else {
      // Advanced — store the custom rounds, also keep workSec/restSec/totalRounds in sync as fallback
      ex.roundsCustom=JSON.parse(JSON.stringify(temp.roundsCustom));
      ex.totalRounds=temp.roundsCustom.length;
    }
    // If timer is idle, sync phaseLeft to first segment's duration so it picks up the change
    if(ex.phase==='idle'){
      const segs=getHiitSegments(ex);
      ex.phaseLeft=segs[0]?segs[0].duration:(ex.workSec||40);
    }
    // If timer is currently running/paused, re-snapshot the engine with the new config so
    // edits apply to the live run. The engine continues from the same phaseIdx.
    // If phaseIdx is now past the end (e.g. user shortened the workout), finish gracefully.
    if(ex.phase==='work'||ex.phase==='rest'||ex.phase==='paused'||ex.phase==='setup'){
      snapshotHiitConfig(ex);
      const newSegs=ex._engineSegs||[];
      if(ex.phase==='setup'){
        // Setup phase: just update setupSec for the running countdown
        if(ex.setupSec===0){
          // User turned setup off mid-setup — jump to first work segment
          ex.phaseIdx=0;
          ex.phase=newSegs[0]?newSegs[0].type:'idle';
          ex.phaseLeft=newSegs[0]?newSegs[0].duration:(ex.workSec||40);
          ex._segStartMs=Date.now();
          ex._segDurSec=ex.phaseLeft;
        }
      } else {
        // Currently in a work/rest segment
        if(ex.phaseIdx>=newSegs.length){
          // Workout shortened past current position — finish gracefully
          ex.phase='done';
          ex.rounds=ex._engineTotalRounds||getHiitTotalRounds(ex);
          ex.logged=true;
          if(hiitIntervals[ei]) clearInterval(hiitIntervals[ei]);
          if(hiitRafs&&hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
          maybeReleaseWakeLock();
          (wsGoldSweep(),playCircuitComplete(ex));
        } else {
          // Continue at the same phaseIdx with the new segment's duration
          const curSeg=newSegs[ex.phaseIdx];
          // Update phase type if it changed (e.g. advanced edits removed a rest)
          ex.phase=curSeg.type;
          ex.phaseLeft=curSeg.duration;
          ex._segStartMs=Date.now();
          ex._segDurSec=curSeg.duration;
        }
      }
      // B2 fix: engine was paused when editor opened — restart it now that edits are applied
      if(ex._pausedForEdit){
        ex._pausedForEdit=false;
        if(ex.phase!=='done'&&ex.phase!=='idle') startHiit(ei);
      }
    }
  }
  else if(field==='workSec'){
    ex.workSec=temp.value;
    if(ex.phase==='idle'){
      const segs=getHiitSegments(ex);
      ex.phaseLeft=segs[0]?segs[0].duration:ex.workSec;
    }
  }
  else if(field==='restSec'){ex.restSec=temp.value;}
  else if(field==='totalRounds'){
    ex.totalRounds=temp.value;
    if(ex.phase==='idle'){
      const segs=getHiitSegments(ex);
      ex.phaseLeft=segs[0]?segs[0].duration:(ex.workSec||40);
    }
  }
  playSaveSet(ex);closeCardioEdit();renderAll(false);
}
function closeCardioEdit(){
  // B2 fix: if editor was cancelled while circuit was running, restart the frozen engine
  if(cardioEditCtx){
    const {ei}=cardioEditCtx;
    const ex=DAYS[curDay].items[ei];
    if(ex&&ex._pausedForEdit){
      ex._pausedForEdit=false;
      if(ex.phase!=='done'&&ex.phase!=='idle') startHiit(ei);
    }
  }
  document.getElementById('cardioEditModal').classList.remove('open');
  cardioEditCtx=null;
}

function openIconPicker(ei){
  iconPickerCtx={ei};
  const ex=DAYS[curDay].items[ei];
  const grid=document.getElementById('iconGrid');
  grid.innerHTML=Object.keys(ICONS).map(key=>{
    const data=ICONS[key];
    return `<div class="icon-cell${ex.icon===key?' selected':''}" onclick="pickIcon('${key}')">
      <svg viewBox="0 0 24 24">${data.svg}</svg><span class="icon-cell-name">${data.name}</span>
    </div>`;
  }).join('');
  document.getElementById('iconPickerModal').classList.add('open');
}
function pickIcon(key){
  if(!iconPickerCtx) return;
  DAYS[curDay].items[iconPickerCtx.ei].icon=key;
  // v47: this wrote to the model and re-rendered but never persisted, so the
  // icon reverted on reload unless an unrelated action happened to save first.
  // Same class of bug as apply-to-all-sets.
  wsPersistSave();
  closeIconPicker();renderAll(false);
}
function closeIconPicker(){document.getElementById('iconPickerModal').classList.remove('open');iconPickerCtx=null;}
