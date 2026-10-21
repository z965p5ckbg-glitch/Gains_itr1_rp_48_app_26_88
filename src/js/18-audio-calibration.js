

// ═══ S6: calibration constants, audio bus, voice, gold sweep, calibration overlay ═══
const WS_CAL_DEF={clock:108,nameH:96,glow:1,sweepMs:900,rimPulses:2,rimMs:925,dim:0.28,vol:1,space:1};
let WS_CAL=Object.assign({},WS_CAL_DEF);
try{ const c=JSON.parse(localStorage.getItem('ws_cal_v1')||'null'); if(c) WS_CAL=Object.assign({},WS_CAL_DEF,c); }catch(_){}
function wsApplyCal(){
  try{
    const r=document.documentElement.style;
    r.setProperty('--calClock',WS_CAL.clock+'px');
    r.setProperty('--calNameH',WS_CAL.nameH+'px');
    r.setProperty('--calDim',WS_CAL.dim);
    r.setProperty('--wsSweepMs',WS_CAL.sweepMs+'ms');
    r.setProperty('--rimN',WS_CAL.rimPulses);
    r.setProperty('--rimMs',WS_CAL.rimMs+'ms');
    r.setProperty('--calSpace',WS_CAL.space);
    const g=document.getElementById('wsGold'), rc=document.getElementById('rimCue');
    if(g) g.style.filter='brightness('+WS_CAL.glow+')';
    if(rc) rc.style.filter='brightness('+WS_CAL.glow+')';
    localStorage.setItem('ws_cal_v1',JSON.stringify(WS_CAL));
  }catch(_){}
}
function wsPrimeAudio(){
  try{ const c=ac(); if(c.resume)c.resume();
    const b=c.createBuffer(1,1,22050), src=c.createBufferSource();
    src.buffer=b; src.connect(c.destination); src.start(0);
  }catch(_){}
}
function wsSpeak(t){
  try{ if(!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(t)); u.rate=1.02; u.pitch=1;
    speechSynthesis.speak(u);
  }catch(_){}
}
function wsMaster(c){
  if(!c.__wsM){ c.__wsM=c.createGain(); c.__wsM.connect(c.destination); }
  c.__wsM.gain.value=(typeof WS_CAL!=='undefined'&&WS_CAL.vol!=null)?WS_CAL.vol:1;
  return c.__wsM;
}
function wsGoldSweep(){
  const el=document.getElementById('wsGold'); if(!el) return;
  el.classList.remove('go','fade'); void el.offsetWidth;
  el.style.setProperty('--wsSweepMs',(WS_CAL.sweepMs||900)+'ms');
  el.classList.add('go');
  clearTimeout(el._t1); clearTimeout(el._t2);
  el._t1=setTimeout(()=>el.classList.add('fade'),(WS_CAL.sweepMs||900)+180);
  el._t2=setTimeout(()=>el.classList.remove('go','fade'),(WS_CAL.sweepMs||900)+820);
}
function wsCalTap(){
  const now=Date.now();
  window.__wsCt=(now-(window.__wsCtT||0)<650)?((window.__wsCt||0)+1):1;
  window.__wsCtT=now;
  if(window.__wsCt>=3){ window.__wsCt=0; wsCalOpen(); }
}
function wsCalOpen(){ const v=document.getElementById('wsCal'); if(!v) return; wsCalRender(); v.classList.add('show'); }
function wsCalClose(){ const v=document.getElementById('wsCal'); if(v) v.classList.remove('show'); }
function wsCalSet(k,val){ WS_CAL[k]=+val; wsApplyCal();
  const sp=document.getElementById('wsCalV_'+k); if(sp) sp.textContent=WS_CAL[k]; }
function wsCalRow(k,label,min,max,step){
  return `<div class="ws-cal-row"><div class="ws-cal-l">${label} <span class="ws-cal-v" id="wsCalV_${k}">${WS_CAL[k]}</span></div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${WS_CAL[k]}" oninput="wsCalSet('${k}',this.value)"></div>`;
}
function wsCalRender(){
  const v=document.getElementById('wsCal'); if(!v) return;
  v.innerHTML=`<div class="ws-sheet">
    <div class="ws-sheet-head"><div class="ws-sheet-t">Calibration</div><div class="ws-sheet-done" onclick="wsCalClose()">Close</div></div>
    ${wsCalRow('clock','Clock px',96,136,2)}
    ${wsCalRow('nameH','Name box px',60,120,4)}
    ${wsCalRow('glow','Glow ×',0.5,1.6,0.05)}
    ${wsCalRow('sweepMs','Sweep ms',500,1600,50)}
    ${wsCalRow('rimPulses','Rim pulses',1,4,1)}
    ${wsCalRow('rimMs','Rim pulse ms',500,1400,25)}
    ${wsCalRow('dim','Dim α',0.1,0.6,0.02)}
    ${wsCalRow('vol','Volume',0,1,0.05)}
    ${wsCalRow('space','Spacing ×',0.8,1.2,0.02)}
    <div class="ws-cal-btns">
      <div class="ws-sheet-done" onclick="wsGoldSweep()">Test sweep</div>
      <div class="ws-sheet-done" onclick="fireRimCue('work')">Test rim</div>
      <div class="ws-sheet-done" onclick="wsCalCopy()">Copy values</div>
      <div class="ws-sheet-done" onclick="wsCalShare()">Share…</div>
      <div class="ws-sheet-done" onclick="WS_CAL=Object.assign({},WS_CAL_DEF);wsApplyCal();wsCalRender()">Reset</div>
    </div>
    <textarea class="ws-cal-out" id="wsCalOut" readonly></textarea>
  </div>`;
}
function wsCalCopy(){
  const o=document.getElementById('wsCalOut'); if(!o) return;
  const json=JSON.stringify(WS_CAL);
  o.value=json; o.style.display='block';
  const done=()=>{ o.value='Copied ✓ — now paste it into the chat.\n\n'+json; };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(json).then(done).catch(()=>{ try{o.focus();o.select();}catch(_){} });
  } else { try{ o.focus(); o.select(); document.execCommand&&document.execCommand('copy'); done(); }catch(_){} }
}
function wsCalShare(){
  const json=JSON.stringify(WS_CAL);
  if(navigator.share){ navigator.share({title:'Gains calibration',text:json}).catch(()=>{}); }
  else wsCalCopy();
}

function fmTone(carrier,modRatio,modIndex,start,dur,vol,attack){
  attack=attack||.01;
  const c=ac();
  const car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),og=c.createGain();
  mod.type='sine';mod.frequency.value=carrier*modRatio;mg.gain.value=modIndex*carrier;
  mod.connect(mg);mg.connect(car.frequency);
  car.type='sine';car.frequency.value=carrier;car.connect(og);og.connect(wsMaster(c));
  og.gain.setValueAtTime(0,start);og.gain.linearRampToValueAtTime(vol,start+attack);og.gain.exponentialRampToValueAtTime(.0001,start+dur);
  car.start(start);car.stop(start+dur+.05);mod.start(start);mod.stop(start+dur+.05);
}

function playKnock(){
  if(!snd('stepper')) return;
  try{
    const c=ac();const buf=c.createBuffer(1,c.sampleRate*.04,c.sampleRate);const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,5);
    const src=c.createBufferSource();src.buffer=buf;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=320;f.Q.value=4;
    const g=c.createGain();g.gain.setValueAtTime(.16,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.04);
    src.connect(f);f.connect(g);g.connect(wsMaster(c));src.start();
  }catch(e){}
}

function playSaveSet(ex){
  if(!exSnd(ex||{},'save')) return;
  try{const c=ac();const t=c.currentTime;fmTone(196,2.01,1.4,t,.55,.25,.005);fmTone(98,1.0,0.3,t+.005,.5,.12,.01);fmTone(587,1.5,0.8,t+.04,.25,.06,.008);}catch(e){}
}

function playRestDone(ex){
  if(!exSnd(ex||{},'timer')) return;
  try{
    const c=ac();const t=c.currentTime;
    const partials=[{f:587,vol:.18,decay:1.8},{f:1174,vol:.10,decay:1.4},{f:1738,vol:.08,decay:1.0},{f:2640,vol:.05,decay:.7},{f:3520,vol:.03,decay:.4}];
    partials.forEach((p,i)=>{
      const o=c.createOscillator(),g=c.createGain();
      o.type='sine';o.frequency.value=p.f;o.detune.value=(Math.random()-.5)*8;
      o.connect(g);g.connect(wsMaster(c));
      const st=t+i*.003;
      g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(p.vol,st+.003);g.gain.exponentialRampToValueAtTime(.0001,st+p.decay);
      o.start(st);o.stop(st+p.decay+.05);
    });
  }catch(e){}
}

// SETUP START — calm, anticipatory tone (lilac mood); no sharp attack
function playSetupStart(ex){
  if(!exSnd(ex||{},'interval')) return;
  try{
    const c=ac();const t=c.currentTime;
    const lpf=c.createBiquadFilter();lpf.type='lowpass';lpf.frequency.value=2400;lpf.Q.value=.4;lpf.connect(wsMaster(c));
    // Soft chord rising: D4 + F#4 (gentle major third interval)
    const o1=c.createOscillator(),g1=c.createGain();o1.type='sine';o1.frequency.value=293.66;o1.connect(g1);g1.connect(lpf);
    g1.gain.setValueAtTime(0,t);g1.gain.linearRampToValueAtTime(.10,t+.18);g1.gain.exponentialRampToValueAtTime(.001,t+1.2);
    o1.start(t);o1.stop(t+1.3);
    const o2=c.createOscillator(),g2=c.createGain();o2.type='sine';o2.frequency.value=369.99;o2.connect(g2);g2.connect(lpf);
    g2.gain.setValueAtTime(0,t+.05);g2.gain.linearRampToValueAtTime(.08,t+.25);g2.gain.exponentialRampToValueAtTime(.001,t+1.2);
    o2.start(t+.05);o2.stop(t+1.3);
  }catch(e){}
}

function playWorkStart(ex){
  if(!exSnd(ex||{},'interval')) return;
  try{
    const c=ac();const t=c.currentTime;
    const partials=[{f:880,vol:.15,decay:.6},{f:1320,vol:.10,decay:.5},{f:1760,vol:.08,decay:.4},{f:2640,vol:.05,decay:.3}];
    partials.forEach((p,i)=>{
      const o=c.createOscillator(),g=c.createGain();
      o.type='sine';o.frequency.value=p.f;o.detune.value=(Math.random()-.5)*6;
      o.connect(g);g.connect(wsMaster(c));
      const st=t+i*.003;
      g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(p.vol,st+.002);g.gain.exponentialRampToValueAtTime(.0001,st+p.decay);
      o.start(st);o.stop(st+p.decay+.05);
    });
    setTimeout(()=>{
      const c2=ac();const t2=c2.currentTime;
      [{f:1108,vol:.10,decay:.5},{f:1660,vol:.07,decay:.4}].forEach(p=>{
        const o=c2.createOscillator(),g=c2.createGain();
        o.type='sine';o.frequency.value=p.f;o.connect(g);g.connect(c2.destination);
        g.gain.setValueAtTime(0,t2);g.gain.linearRampToValueAtTime(p.vol,t2+.002);g.gain.exponentialRampToValueAtTime(.0001,t2+p.decay);
        o.start(t2);o.stop(t2+p.decay+.05);
      });
    },140);
  }catch(e){}
}

// CIRCUIT COMPLETE — triumphant chord progression resolving on A
function playRoundComplete(ex){
  if(!exSnd(ex||{},'interval')) return;
  try{
    const c=ac(),t=c.currentTime;
    [{f:293.66,d:0},{f:369.99,d:.085},{f:440.00,d:.17},{f:587.33,d:.255}].forEach(n=>{
      const o=c.createOscillator(),o2=c.createOscillator(),g=c.createGain();
      o.type='triangle';o2.type='sine';o.frequency.value=n.f;o2.frequency.value=n.f*2;o2.detune.value=5;
      o.connect(g);o2.connect(g);g.connect(wsMaster(c));
      const st=t+n.d;g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(.15,st+.02);
      g.gain.exponentialRampToValueAtTime(.0001,st+.9);
      o.start(st);o2.start(st);o.stop(st+.95);o2.stop(st+.95);
    });
    const sub=c.createOscillator(),sg=c.createGain();sub.type='sine';sub.frequency.value=146.83;
    sub.connect(sg);sg.connect(wsMaster(c));sg.gain.setValueAtTime(0,t);
    sg.gain.linearRampToValueAtTime(.11,t+.03);sg.gain.exponentialRampToValueAtTime(.0001,t+.8);
    sub.start(t);sub.stop(t+.85);
    const sp=c.createOscillator(),spg=c.createGain();sp.type='sine';sp.frequency.value=1108.73;
    sp.connect(spg);spg.connect(wsMaster(c));const ss=t+.28;spg.gain.setValueAtTime(0,ss);
    spg.gain.linearRampToValueAtTime(.045,ss+.02);spg.gain.exponentialRampToValueAtTime(.0001,ss+.55);
    sp.start(ss);sp.stop(ss+.6);
  }catch(e){}
}
function playCircuitComplete(ex){
  if(!exSnd(ex||{},'complete')) return;
  try{
    const c=ac();const t=c.currentTime;
    const lpf=c.createBiquadFilter();lpf.type='lowpass';lpf.frequency.value=2200;lpf.Q.value=.5;lpf.connect(wsMaster(c));
    // A2 foundation
    const f=c.createOscillator(),fG=c.createGain();f.type='triangle';f.frequency.value=110;f.connect(fG);fG.connect(lpf);
    fG.gain.setValueAtTime(0,t);fG.gain.linearRampToValueAtTime(.16,t+.2);fG.gain.setValueAtTime(.16,t+1.4);fG.gain.exponentialRampToValueAtTime(.001,t+2.5);
    f.start(t);f.stop(t+2.6);
    // C#3
    const th=c.createOscillator(),thG=c.createGain();th.type='triangle';th.frequency.value=138.6;th.detune.value=-2;th.connect(thG);thG.connect(lpf);
    thG.gain.setValueAtTime(0,t+.15);thG.gain.linearRampToValueAtTime(.12,t+.4);thG.gain.setValueAtTime(.12,t+1.3);thG.gain.exponentialRampToValueAtTime(.001,t+2.4);
    th.start(t+.15);th.stop(t+2.5);
    // E3
    const fi=c.createOscillator(),fiG=c.createGain();fi.type='triangle';fi.frequency.value=164.8;fi.detune.value=2;fi.connect(fiG);fiG.connect(lpf);
    fiG.gain.setValueAtTime(0,t+.3);fiG.gain.linearRampToValueAtTime(.13,t+.55);fiG.gain.setValueAtTime(.13,t+1.3);fiG.gain.exponentialRampToValueAtTime(.001,t+2.4);
    fi.start(t+.3);fi.stop(t+2.5);
    // High A4 sparkle
    const sp=c.createOscillator(),spG=c.createGain();sp.type='sine';sp.frequency.value=440;sp.connect(spG);spG.connect(lpf);
    spG.gain.setValueAtTime(0,t+.45);spG.gain.linearRampToValueAtTime(.06,t+.7);spG.gain.exponentialRampToValueAtTime(.001,t+1.8);
    sp.start(t+.45);sp.stop(t+1.9);
    // Vibrato on third
    const lfo=c.createOscillator(),lG=c.createGain();
    lfo.type='sine';lfo.frequency.value=4.5;lG.gain.value=1.2;
    lfo.connect(lG);lG.connect(fi.frequency);
    lfo.start(t+.3);lfo.stop(t+2.4);
    // Bass settling A1
    const r=c.createOscillator(),rG=c.createGain();r.type='sine';r.frequency.value=55;r.connect(rG);rG.connect(lpf);
    rG.gain.setValueAtTime(0,t+1.0);rG.gain.linearRampToValueAtTime(.10,t+1.4);rG.gain.setValueAtTime(.10,t+1.8);rG.gain.exponentialRampToValueAtTime(.001,t+2.5);
    r.start(t+1.0);r.stop(t+2.6);
  }catch(e){}
}

function playSessionLog(){
  if(!snd('session')) return;
  try{
    const c=ac();const t=c.currentTime;
    const lpf=c.createBiquadFilter();lpf.type='lowpass';lpf.frequency.value=1800;lpf.Q.value=.5;lpf.connect(wsMaster(c));
    const f=c.createOscillator(),fG=c.createGain();f.type='triangle';f.frequency.value=110;f.connect(fG);fG.connect(lpf);
    fG.gain.setValueAtTime(0,t);fG.gain.linearRampToValueAtTime(.16,t+.3);fG.gain.setValueAtTime(.16,t+1.6);fG.gain.exponentialRampToValueAtTime(.001,t+2.4);
    f.start(t);f.stop(t+2.5);
    const fi=c.createOscillator(),fiG=c.createGain();fi.type='triangle';fi.frequency.value=164.8;fi.detune.value=2;fi.connect(fiG);fiG.connect(lpf);
    fiG.gain.setValueAtTime(0,t+.2);fiG.gain.linearRampToValueAtTime(.13,t+.5);fiG.gain.setValueAtTime(.13,t+1.5);fiG.gain.exponentialRampToValueAtTime(.001,t+2.3);
    fi.start(t+.2);fi.stop(t+2.4);
    const th=c.createOscillator(),thG=c.createGain();th.type='triangle';th.frequency.value=138.6;th.detune.value=-2;th.connect(thG);thG.connect(lpf);
    thG.gain.setValueAtTime(0,t+.4);thG.gain.linearRampToValueAtTime(.11,t+.7);thG.gain.setValueAtTime(.11,t+1.5);thG.gain.exponentialRampToValueAtTime(.001,t+2.3);
    th.start(t+.4);th.stop(t+2.4);
    const r=c.createOscillator(),rG=c.createGain();r.type='sine';r.frequency.value=55;r.connect(rG);rG.connect(lpf);
    rG.gain.setValueAtTime(0,t+1.1);rG.gain.linearRampToValueAtTime(.10,t+1.4);rG.gain.setValueAtTime(.10,t+1.8);rG.gain.exponentialRampToValueAtTime(.001,t+2.4);
    r.start(t+1.1);r.stop(t+2.5);
  }catch(e){}
}

function renderTabs(){
  // Workshop foundation: only show days flagged published — banked days exist but don't appear in tabs.
  // We map over filtered days but preserve original DAYS index for switchDay so curDay still indexes the source array.
  const el=document.getElementById('tabsScroll');
  const tabsHtml=DAYS
    .map((d,i)=>({d,i}))
    .filter(({d})=>d.published!==false)
    .map(({d,i})=>`<div class="d-tab${i===curDay?' active':''}" onclick="switchDay(${i})">${d.label}</div>`)
    .join('');
  el.innerHTML=tabsHtml+'<div class="d-tab add">+</div>';
  requestAnimationFrame(()=>{const fade=document.getElementById('tabsFade');if(fade) fade.classList.toggle('show',el.scrollWidth>el.clientWidth);});
}

function renderHeader(){
  const d=DAYS[curDay];
  document.getElementById('hdrTitle').innerHTML=d.titleHtml;
  const lbl=document.getElementById('hdrLbl');
  lbl.textContent=d.label+' · '+todayStr();
  lbl.onclick=wsRenameDay;
  lbl.style.cursor='pointer';
}
// Rename the current day. "Day 3" tells you nothing at 6am; "Legs" does.
function wsRenameDay(){
  const d=DAYS[curDay]; if(!d) return;
  const cur=d.label||'';
  const next=prompt('Name this day', cur);
  if(next===null) return;
  const clean=String(next).trim().slice(0,22);
  if(!clean) return;
  d.label=clean;
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  renderHeader();
  if(typeof renderTabs==='function') renderTabs();
  wsToastMsg('Renamed to '+clean);
}

function todayStr(){
  const now=new Date();
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[now.getDay()]+' '+now.getDate()+' '+months[now.getMonth()];
}
