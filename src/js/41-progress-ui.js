
function wsAcuteChronicPanel(){
  let lt=null;
  try{ lt=wsProgLoadTrend(); }catch(_){ return ''; }
  if(!lt) return '';
  const pct=Math.round(lt.ratio*100);
  return '<div class="wsac'+(lt.ratio>=1.5?' hot':'')+'">'
    +'<div class="wsac-h">Workload ramp</div>'
    +'<div class="wsac-v">'+pct+'%<span class="wsac-u">of your 4-week average</span></div>'
    +'<div class="wsac-s">'+lt.weekSets+' sets in the last 7 days vs '+lt.avgSets+'/week over 28 days · <b>'+lt.state+'</b></div>'
    +'<div class="wsac-n">A spike check borrowed from team-sport injury monitoring. Descriptive, not a diagnosis — a high reading after a planned overload week is expected.</div>'
  +'</div>';
}
function wsProgRender(){
  const root=document.getElementById('histView'); if(!root) return;
  const data=wsProgBuild(wsProgFrame);
  if(wsProgExId){
    const x=data.byKey[wsProgExId];
    if(x){ wsProgRenderDetail(root,x); return; }
    wsProgExId=null;
  }
  const sum=wsProgSummary(wsProgFrame);
  const prCount=data.list.reduce((a,x)=>a+(x.prEvents||0),0);
  window.__wsProgRefT=data.list.reduce((m,x)=>Math.max(m,x.lastT||0),0);
  const frames=['4W','8W','6M','1Y','ALL'];
  const seg=frames.map(fr=>`<div class="wsprog-seg${fr===wsProgFrame?' on':''}" onclick="wsProgSetFrame('${fr}')">${fr==='ALL'?'All':fr}</div>`).join('');
  const frameLabel={'4W':'4 weeks','8W':'8 weeks','6M':'6 months','1Y':'12 months','ALL':'all time'}[wsProgFrame];

  // ── hero v2 + load trend + consistency grid ──
  // v48: the acute:chronic headline was replaced by wsRenderTrends(). The
  // function survives only to feed one descriptive line into the Coach Brief.
  const grid=wsProgDayGrid();
  const gcells=grid.map(g=>{
    const lv=g.sets===0?0:(g.sets<=3?1:(g.sets<=7?2:3));
    return `<div class="wsgrid-c g${lv}"></div>`;
  }).join('');
  const hero = sum.sessions===0 ? '' : `<div class="wsprog-cap">This stretch<span class="wsprog-frame-badge">${frameLabel}</span></div>
    <div class="wsprog-hero">
      <div class="wsprog-hero-cell"><div class="wsprog-hn">${sum.sessions}</div><div class="wsprog-hl">session${sum.sessions===1?'':'s'}</div></div>
      <div class="wsprog-hero-cell"><div class="wsprog-hn">${sum.sets}</div><div class="wsprog-hl">sets</div></div>
      <div class="wsprog-hero-cell"><div class="wsprog-hn">${sum.activeDays}</div><div class="wsprog-hl">active days</div></div>
      <div class="wsprog-hero-cell gold"><div class="wsprog-hn">${prCount}</div><div class="wsprog-hl">new bests</div></div>
    </div>
    ${wsRenderTrends()}
    <div class="wsgrid-cap">Consistency · last 12 weeks</div>
    <div class="wsgrid" aria-label="Consistency, last 12 weeks">${gcells}</div>`;

  // ── highlights (auto-curated) ──
  let hi='';
  if(data.list.length){
    const movers=data.list.filter(x=>x.trend>0&&x.moveScore>0).sort((a,b)=>b.moveScore-a.moveScore);
    const stall=data.list.filter(x=>x.plateau&&x.stalledW>=2).sort((a,b)=>b.stalledW-a.stalledW);
    const cards=[];
    if(movers[0]) cards.push({t:'Top mover',n:movers[0].name,s:movers[0].insight,k:movers[0].key});
    if(prCount>0) cards.push({t:'New bests',n:prCount+' this stretch',s:'strict all-time breaks',k:null,prs:true});
    if(stall[0]) cards.push({t:'Needs attention',n:stall[0].name,s:'Stalled · '+stall[0].stalledW+'w',k:stall[0].key,warn:true});
    if(cards.length) hi=`<div class="wsprog-sect">Highlights</div><div class="wshi-row">`+cards.map(c=>
      `<div class="wshi-card${c.warn?' warn':''}${c.prs?' gold':''}" onclick="${c.k?`wsProgOpenDetail('${encodeURIComponent(c.k)}')`:(c.prs?`routeTo('prs')`:'')}">
        <div class="wshi-t">${c.t}</div><div class="wshi-n">${hiEscape(c.n)}</div><div class="wshi-s">${hiEscape(c.s)}</div></div>`).join('')+`</div>`;
  }

  // ── filters / sort / search / muscle-sel ──
  const F=[['all','All'],['strength','Strength'],['cond','Cond'],['cardio','Cardio'],['days','Days']];
  const sortLbl={recent:'Recent',movers:'Movers',stalled:'Stalled'}[wsProgSort];
  const controls=`<div class="wsprog-ctl">
      <div class="wsprog-chipsrow">${F.map(([k,l])=>`<div class="wsprog-fchip${wsProgFilter===k?' on':''}" onclick="wsProgSetFilter('${k}')">${l}</div>`).join('')}</div>
      <div class="wsprog-sortbtn" onclick="wsProgSortCycle()">${sortLbl} ▸</div>
    </div>
    <input class="wsprog-search" placeholder="Search exercises" value="${hiEscape(wsProgQ)}" oninput="wsProgSearchLive(this.value)">
    ${wsProgMuscleSel?`<div class="wsprog-msel">Muscle: ${hiEscape(wsProgMuscleSel)} <span onclick="wsProgMuscleClear()">✕</span></div>`:''}`;

  // ── body ──
  let body='';
  if(data.list.length===0){
    // v55: "No sessions yet" was shown whenever the selected period was empty,
    // even with months of history just outside it — so a fresh install showed
    // 78 sessions in History and "No sessions yet" in Progress. Say which it is.
    const hist=Array.isArray(HISTORY)?HISTORY:[];
    const lastT=hist.reduce((m,r)=>{ const t=new Date(r.date).getTime(); return isNaN(t)?m:Math.max(m,t); },0);
    const icon=`<div class="hi-empty-icon"><svg viewBox="0 0 24 24"><polyline points="2 16 7 10 12 13 20 4"/><polyline points="15 4 20 4 20 9"/></svg></div>`;
    if(lastT && wsProgFrame!=='ALL'){
      const when=new Date(lastT).toLocaleDateString(undefined,{day:'numeric',month:'short',year:(new Date(lastT).getFullYear()!==new Date().getFullYear()?'numeric':undefined)});
      body=`<div class="hi-empty">${icon}
        <div class="hi-empty-title">Nothing in the last ${frameLabel}</div>
        <div class="hi-empty-sub">Your most recent session was ${hiEscape(when)}. Pick a longer period to see your trends.</div>
        <button class="wsprog-empty-btn" onclick="wsProgSetFrame('ALL')">Show all time</button></div>`;
    } else {
      body=`<div class="hi-empty">${icon}
        <div class="hi-empty-title">No sessions yet</div>
        <div class="hi-empty-sub">Log a workout and your exercise trends will appear here — strength, reps, pace and rounds, each tracked over time.</div></div>`;
    }
  } else if(wsProgFilter==='days'){
    body=wsProgDaysHtml();
  } else {
    let list=data.list.slice();
    if(wsProgMuscleSel) list=list.filter(x=>(x.muscles||[]).includes(wsProgMuscleSel));
    if(wsProgSort==='movers') list.sort((a,b)=>(b.trend>0?b.moveScore:-1)-(a.trend>0?a.moveScore:-1));
    if(wsProgSort==='stalled') list.sort((a,b)=>((b.plateau?b.stalledW:-1))-((a.plateau?a.stalledW:-1)));
    const pins=(settings.progPins||[]);
    const pinned=pins.map(k=>data.byKey[k]).filter(Boolean);
    const strength=list.filter(x=>x.kind==='weighted'||x.kind==='bodyweight');
    const cond=list.filter(x=>x.kind==='hiit');
    const cardio=list.filter(x=>x.kind==='cardio');
    const lensSeg=`<span class="wsprog-lens"><span class="${wsProgLens==='strength'?'on':''}" onclick="wsProgSetLens('strength')">1RM</span><span class="${wsProgLens==='vol'?'on':''}" onclick="wsProgSetLens('vol')">Vol</span></span>`;
    const sect=(id,label,arr,extraHead,extraBody)=>{
      if(!arr.length&&!extraBody) return '';
      const exp=!!(window.__wsProgExp&&window.__wsProgExp[id]);
      const show=exp?arr:arr.slice(0,3);
      const more=arr.length>3&&!exp?`<div class="wsprog-more" onclick="wsProgExpand('${id}')">Show all ${arr.length} ▾</div>`:'';
      return `<div class="wsprog-sect">${label} · ${arr.length}${extraHead||''}</div>${extraBody||''}<div class="wsprog-list">${show.map(wsProgCardHtml).join('')}</div>${more}`;
    };
    const showS=(wsProgFilter==='all'||wsProgFilter==='strength');
    const showC=(wsProgFilter==='all'||wsProgFilter==='cond');
    const showK=(wsProgFilter==='all'||wsProgFilter==='cardio');
    body = (pinned.length&&wsProgFilter==='all'&&!wsProgMuscleSel?`<div class="wsprog-sect">My lifts</div><div class="wsprog-list">${pinned.map(wsProgCardHtml).join('')}</div>`:'')
         + (showS?sect('s','Strength',strength,lensSeg):'')
         + (wsProgFilter==='all'&&!wsProgMuscleSel?wsProgMuscleHtml():'')
         + (showC?sect('c','Conditioning',cond):'')
         + (showK?sect('k','Cardio',cardio,'',wsProgEasyHtml()):'');
  }

  root.innerHTML=`<div class="hi-hdr">
      <div class="hi-hdr-main">
        <div class="hi-hdr-title">Pro<em>gress</em></div>
        <div style="display:flex;align-items:flex-end;gap:10px">
          <div class="hi-hdr-gear" onclick="openSettings()" aria-label="Settings"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="3.2"/><path d="M11 2.8v2.4M11 16.8v2.4M2.8 11h2.4M16.8 11h2.4M5.2 5.2l1.7 1.7M15.1 15.1l1.7 1.7M16.8 5.2l-1.7 1.7M6.9 15.1l-1.7 1.7"/></svg></div>
        </div>
      </div>
      <div class="wsprog-frames">${seg}</div>
    </div>
    <div class="hi-scroll wsprog-scroll">
      ${hero}
      ${hi}
      ${controls}
      ${body}
      <div class="wsprog-foot">Estimated 1RM · Epley on your top sets. Reads finished sessions. Trends compare recent sessions against earlier ones; a change smaller than your normal scatter reads as steady. Gold dots mark all-time bests set in this window.</div>
    </div>`;
  requestAnimationFrame(()=>{ wsProgPaintSparks(data); wsProgSearchLive(wsProgQ,true); });
}
function wsProgSetLens(l){ if(l===wsProgLens) return; wsProgLens=l; wsProgRender(); }
function wsProgSetFilter(k){ if(k===wsProgFilter) return; wsProgFilter=k; wsProgRender(); }
function wsProgSortCycle(){ wsProgSort=wsProgSort==='recent'?'movers':(wsProgSort==='movers'?'stalled':'recent'); wsProgRender(); }
function wsProgExpand(id){ window.__wsProgExp=window.__wsProgExp||{}; window.__wsProgExp[id]=true; wsProgRender(); }
function wsProgMuscleTap(m){ wsProgMuscleSel=m; wsProgRender(); }
function wsProgMuscleClear(){ wsProgMuscleSel=null; wsProgRender(); }
function wsProgPinToggle(key){
  try{ key=decodeURIComponent(key); }catch(_){}
  settings.progPins=settings.progPins||[];
  const i=settings.progPins.indexOf(key);
  if(i>=0) settings.progPins.splice(i,1); else settings.progPins.unshift(key);
  if(typeof wsPersist==='function') wsPersist();
  wsProgRender();
}
// Live search: hides non-matching cards without re-render (keeps the keyboard up).
function wsProgSearchLive(v,silent){
  wsProgQ=v||'';
  const q=wsProgQ.trim().toLowerCase();
  const root=document.getElementById('histView'); if(!root||!root.querySelectorAll) return;
  const cards=root.querySelectorAll('[data-pname]');
  cards.forEach&&cards.forEach(c=>{ c.style.display=(!q||(c.getAttribute('data-pname')||'').includes(q))?'':'none'; });
}
// Weekly easy-pace minutes vs the 150-minute aerobic base (Z2 proxy — no HR data).
function wsProgEasyHtml(){
  const cutoff=wsProgCutoff(wsProgFrame);
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let min=0, firstT=null,lastT=null;
  for(const r of hist){
    const t=new Date(r.date).getTime(); if(isNaN(t)||t<cutoff) continue;
    for(const e of (r.entries||[])){
      if(e.kind!=='cardio'||!e.cardio) continue;
      const tag=String(e.cardio.intensityTag||'').toLowerCase();
      if(!tag.startsWith('eas')) continue;
      min+=(e.cardio.durationSec||0)/60;
      if(firstT==null||t<firstT)firstT=t; if(lastT==null||t>lastT)lastT=t;
    }
  }
  if(min===0) return '';
  const weeks=Math.max(1,((lastT-firstT)||0)/(7*86400000));
  const wk=Math.round(min/weeks);
  const pct=Math.min(100,(wk/150)*100);
  return `<div class="wsez"><div class="wsez-top"><span>Aerobic base</span><span>${wk} / 150 min·wk</span></div>
    <div class="wsez-track"><div class="wsez-bar${wk>=150?' ok':''}" style="width:${pct.toFixed(1)}%"></div></div>
    <div class="wsez-cap">easy-pace minutes · Z2 proxy (no HR data)</div></div>`;
}
// Days view: chronological day rows with composition diffs vs the previous
// day of the same weekday (training days repeat weekly).
function wsProgDaysHtml(){
  const cutoff=wsProgCutoff(wsProgFrame);
  const hist=(Array.isArray(HISTORY)?HISTORY:[]).filter(r=>{const t=new Date(r.date).getTime();return !isNaN(t)&&t>=cutoff;})
    .slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const lastByWd={};
  const rows=hist.map(r=>{
    const t=new Date(r.date);
    const label=wd[t.getDay()];
    const names=(r.entries||[]).map(e=>e.name).filter(Boolean);
    let sets=0, vol=0;
    for(const e of (r.entries||[])){
      if(e.kind==='weighted'||e.kind==='bodyweight'){
        for(const st of (e.sets||[])){ if(st.completed===false) continue; sets++;
          const w=(typeof st.weightKg==='number')?st.weightKg:(typeof st.offsetKg==='number'?st.offsetKg:0);
          vol+=(st.reps||0)*w; }
      }
    }
    const prev=lastByWd[label];
    let diff='';
    if(prev){
      const add=names.filter(n=>!prev.includes(n)).slice(0,3);
      const drop=prev.filter(n=>!names.includes(n)).slice(0,3);
      diff=add.map(n=>`<span class="wsday-chip add">+${hiEscape(n)}</span>`).join('')
          +drop.map(n=>`<span class="wsday-chip drop">−${hiEscape(n)}</span>`).join('');
    }
    lastByWd[label]=names;
    return `<div class="wsday-row">
      <div class="wsday-d">${wsProgFmtDate(t.getTime())}<span>${label}</span></div>
      <div class="wsday-m"><div class="wsday-n">${names.length} exercise${names.length===1?'':'s'} · ${sets} sets${vol?` · ${wsProgVolFmt(vol)} kg`:''}</div>
      ${diff?`<div class="wsday-diff">${diff}</div>`:''}</div>
    </div>`;
  }).reverse().join('');
  return `<div class="wsprog-sect">Days · ${hist.length}</div><div class="wspd-list">${rows}</div>`;
}

function wsProgMuscleHtml(){
  const rows=wsProgMuscleWeekly(wsProgFrame);
  if(!rows.length) return '';
  const scale=Math.max(24, Math.ceil((rows[0].perWk+2)/4)*4);
  const zoneL=(10/scale)*100, zoneW=((20-10)/scale)*100;
  const bars=rows.map(r=>{
    const w=Math.min(100,(r.perWk/scale)*100);
    const cls=r.perWk<10?'lo':(r.perWk<=20?'ok':'hi');
    return `<div class="wspm-row" onclick="wsProgMuscleTap('${r.m.replace(/'/g,"\\'")}')">
      <div class="wspm-m">${hiEscape(r.m)}</div>
      <div class="wspm-track"><div class="wspm-zone" style="left:${zoneL.toFixed(1)}%;width:${zoneW.toFixed(1)}%"></div><div class="wspm-mv" style="left:${((6/scale)*100).toFixed(1)}%"></div><div class="wspm-bar ${cls}" style="width:${w.toFixed(1)}%"></div></div>
      <div class="wspm-v">${r.perWk}</div>
    </div>`;
  }).join('');
  return `<div class="wsprog-sect">Muscle volume <span class="wsprog-sect-sub">· working sets / week (logged)</span></div>
    <div class="wspm-card">${bars}
      <div class="wspm-legend"><span class="wspm-dot ok"></span>10–20 sets/wk — the evidence-based growth zone</div>
    </div>`;
}
function wsProgSetFrame(fr){ if(fr===wsProgFrame) return; wsProgFrame=fr; wsProgRender(); }

// A single exercise card: name, headline metric, trend chip, sparkline, insight.
function wsProgCardHtml(x){
  const trendCls = x.trend>0?'up':(x.trend<0?'down':'flat');
  const arrow = x.trend>0?'▲':(x.trend<0?'▼':'—');
  const kindTag = wsProgKindTag(x);
  const spkId='spk_'+x.key.replace(/[^a-z0-9]/gi,'');
  const chips = (x.newBest ? '<span class="wsprog-chip gold">New best</span>' : '')
              + (x.plateau&&x.stalledW>=2 ? '<span class="wsprog-chip warn">Stalled · '+x.stalledW+'w</span>' : '');
  const bestLine = (x.best!=null && x.bestLabel && x.current!==x.best)
      ? '<div class="wsprog-card-best">best '+x.bestLabel+'</div>' : '';
  const gapD=window.__wsProgRefT?Math.round((window.__wsProgRefT-x.lastT)/86400000):0;
  const fade=(x.count>=4&&gapD>=21)?`<div class="wsprog-fadenote">${Math.round(gapD/7)} weeks since last — the groove fades before the strength does.</div>`:'';
  return `<div class="wsprog-card" data-pname="${hiEscape(x.name.toLowerCase())}" onclick="wsProgOpenDetail('${encodeURIComponent(x.key)}')">
    <div class="wsprog-card-top">
      <div class="wsprog-card-id">
        <div class="wsprog-card-name">${hiEscape(x.name)}</div>
        <div class="wsprog-card-tags"><span class="wsprog-card-kind">${kindTag}</span>${chips}</div>
      </div>
      <div class="wsprog-card-metric">
        <div class="wsprog-card-val">${x.headline}</div>
        <div class="wsprog-card-sub">${x.headSub||''}</div>
        ${bestLine}
      </div>
    </div>
    <div class="wsprog-spark" id="${spkId}"></div>
    <div class="wsprog-card-bot">
      <div class="wsprog-trend ${trendCls}"><span class="wsprog-tarrow">${arrow}</span><span>${hiEscape(x.insight||'')}</span></div>
    </div>${fade}
  </div>`;
}
function wsProgKindTag(x){
  if(x.kind==='weighted') return 'Weighted';
  if(x.kind==='bodyweight') return 'Bodyweight';
  if(x.kind==='cardio') return x.metric==='pace'?'Cardio · pace':'Cardio';
  if(x.kind==='hiit') return 'Circuit';
  return '';
}
// Render all sparklines. Each is a small SVG line; gold dot marks the best point.
function wsProgPaintSparks(data){
  data.list.forEach(x=>{
    const id='spk_'+x.key.replace(/[^a-z0-9]/gi,'');
    const box=document.getElementById(id); if(!box) return;
    const ser=x.series||[]; if(ser.length<2){ box.innerHTML=`<div class="wsprog-spark-flat">${ser.length?'One session':'—'}</div>`; return; }
    const W=box.clientWidth||280, H=44, pad=4, padL=6;
    const vals=ser.map(p=>p.v);
    let lo=Math.min(...vals), hi=Math.max(...vals);
    if(lo===hi){ lo-=1; hi+=1; }
    const paceMetric=(x.metric==='pace');
    const yOf=v=>{ const t=(v-lo)/(hi-lo); const tt=paceMetric?t:(1-t); return pad+tt*(H-2*pad); };
    const xOf=i=>padL+(i/(ser.length-1))*(W-padL-pad);
    let d=''; ser.forEach((p,i)=>{ d+=(i?'L':'M')+xOf(i).toFixed(1)+' '+yOf(p.v).toFixed(1); });
    const area=d+`L${xOf(ser.length-1).toFixed(1)} ${H-pad} L${xOf(0).toFixed(1)} ${H-pad} Z`;
    const col = x.trend>0?'var(--rest-c)':(x.trend<0?'#cf7052':'var(--tx3)');
    const y0=yOf(ser[0].v).toFixed(1);
    // anchoring: dotted baseline at the first value + its tiny label
    const startLbl=wsProgFmtVal(x,ser[0].v).replace(' kg','').replace(' reps','').replace(' rounds','');
    const dots = ser.length<=10
      ? ser.map((p,i)=>`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="1.8" fill="${col}"/>`).join('')
      : '';
    // PR events only — no PR in frame, no gold
    const prDots = ser.map((p,i)=> p.pr?`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="3" fill="var(--gold)"/>`:'').join('');
    box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}">
      <defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${col}" stop-opacity="0.22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/>
      </linearGradient></defs>
      <line x1="${padL}" y1="${y0}" x2="${W-pad}" y2="${y0}" stroke="rgba(255,255,255,.14)" stroke-dasharray="2 3"/>
      <path d="${area}" fill="url(#g${id})"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${prDots}
      <circle cx="${xOf(ser.length-1).toFixed(1)}" cy="${yOf(ser[ser.length-1].v).toFixed(1)}" r="2.5" fill="${col}"/>
      <text x="${padL}" y="${Math.min(H-2, parseFloat(y0)+11)}" class="wspk-lbl">${startLbl}</text>
    </svg>`;
  });
}
function wsProgOpenDetail(keyEnc){
  wsProgExId=decodeURIComponent(keyEnc);
  window.__wsProgCmp=false;
  wsProgRender();
}
function wsProgCmpToggle(){ window.__wsProgCmp=!window.__wsProgCmp; wsProgRender(); }
function wsProgBack(){ wsProgExId=null; wsProgRender(); }
function wsProgFmtDate(t){
  const d=new Date(t);
  const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return M[d.getMonth()]+' '+d.getDate();
}
function wsProgFmtVal(x,v){
  if(v==null) return '—';
  if(x.metric==='e1rm') return fmtW(v)+' kg';
  if(x.metric==='reps') return v+' reps';
  if(x.metric==='pace') return wsFmtPace(v);
  if(x.metric==='duration') return fmtMS(v);
  if(x.metric==='rounds') return v+' rounds';
  return String(v);
}
function wsProgSessionRow(x,p,prev){
  let main='—', sub='', dv=null, inv=false;
  if(x.kind==='weighted'){
    if(p.e1rm!=null){ main='e1RM '+p.e1rm+' kg'; sub=p.sets+' set'+(p.sets===1?'':'s')+(p.topW!=null?' · top '+fmtW(p.topW)+' kg':'');
      if(prev&&prev.e1rm!=null) dv={d:p.e1rm-prev.e1rm,f:v=>fmtW(Math.abs(v))+' kg'}; }
    else { main=(p.topReps||0)+' reps'; sub=p.sets+' set'+(p.sets===1?'':'s');
      if(prev) dv={d:(p.topReps||0)-(prev.topReps||0),f:v=>Math.abs(v)+''}; }
  } else if(x.kind==='bodyweight'){
    main=(p.topReps||0)+' reps'; sub=p.sets+' set'+(p.sets===1?'':'s')+' · '+(p.totReps||0)+' total';
    if(prev) dv={d:(p.topReps||0)-(prev.topReps||0),f:v=>Math.abs(v)+''};
  } else if(x.kind==='cardio'){
    if(p.pace!=null){ main=wsFmtPace(p.pace)+'/km'; sub=(p.distanceM?(p.distanceM/1000).toFixed(1)+' km':'')+(p.durationSec?' · '+fmtMS(p.durationSec):'');
      if(prev&&prev.pace!=null){ dv={d:p.pace-prev.pace,f:v=>Math.round(Math.abs(v))+'s'}; inv=true; } }
    else { main=fmtMS(p.durationSec||0); sub=p.intensity||''; }
  } else if(x.kind==='hiit'){
    main=(p.roundsDone||0)+' rounds';
    sub=fmtMS(p.workSec||0)+' work'+(p.peakRpe!=null?' · RPE '+p.peakRpe:'');
    if(prev) dv={d:(p.roundsDone||0)-(prev.roundsDone||0),f:v=>Math.abs(v)+''};
  }
  let chip='';
  if(dv&&dv.d!==0){
    const good=inv?dv.d<0:dv.d>0;
    chip=`<span class="wspd-dc ${good?'up':'down'}">${dv.d>0?'+':'−'}${dv.f(dv.d)}</span>`;
  }
  return `<div class="wspd-row"><div class="wspd-date">${wsProgFmtDate(p.t)}${p.pr?'<span class="wspd-prtag">PR</span>':''}</div><div class="wspd-main">${main}${chip}</div><div class="wspd-sub">${hiEscape(sub)}</div></div>`;
}
// Socratic limiting-factor line — detail only, real stalls only, one line.
function wsProgLimit(x){
  if(!(x.plateau && x.stalledW>=3 && x.count>=4)) return '';
  const nm=(x.name||'').toLowerCase(); const M=x.muscles||[];
  let q='sleep, food, or frequency?';
  if(/pull|row|chin/.test(nm)||M.includes('Lats')||M.includes('Upper back')) q='grip endurance? lat fatigue? too big a load jump?';
  else if(/bench|press|dip|push/.test(nm)||M.includes('Chest')||M.includes('Front delts')) q='triceps lockout? shoulder stability? pressing frequency?';
  else if(/squat|lunge|leg ext/.test(nm)||M.includes('Quads')) q='recovery between leg days? depth consistency?';
  else if(/rdl|deadlift|hinge|hip|glute|curl.*leg|nordic/.test(nm)||M.includes('Hamstrings')||M.includes('Glutes')) q='posterior chain fatigue? sleep this stretch?';
  return `<div class="wspd-limit">${x.stalledW} weeks without a new best — worth asking what limits the set: ${q} Small factors decide these.</div>`;
}
function wsProgRenderDetail(root,x){
  const trendCls=x.trend>0?'up':(x.trend<0?'down':'flat');
  const arrow=x.trend>0?'▲':(x.trend<0?'▼':'—');
  const muscles=(x.muscles||[]).map(m=>`<span class="wspd-mchip">${hiEscape(m)}</span>`).join('');
  const chips=(x.newBest?'<span class="wsprog-chip gold">New best</span>':'')
            +(x.plateau&&x.stalledW>=2?'<span class="wsprog-chip warn">Stalled · '+x.stalledW+'w</span>':'');
  const rowsArr=x.sessions.map((p,i)=>wsProgSessionRow(x,p,x.sessions[i-1]));
  const rows=rowsArr.slice().reverse().join('');
  const pinned=(settings.progPins||[]).includes(x.key);
  const strength=(x.kind==='weighted'||x.kind==='bodyweight');
  const canCmp=strength && x.sessions.length>=3;
  const cmp=!!window.__wsProgCmp && canCmp;
  const cmpSeg=canCmp?`<div class="wspd-cmpseg"><span class="${cmp?'':'on'}" onclick="if(window.__wsProgCmp)wsProgCmpToggle()">Chart</span><span class="${cmp?'on':''}" onclick="if(!window.__wsProgCmp)wsProgCmpToggle()">Compare</span></div>`:'';
  root.innerHTML=`<div class="hi-hdr">
      <div class="hi-hdr-main">
        <div class="wspd-back" onclick="wsProgBack()"><svg viewBox="0 0 12 20"><polyline points="9 2 3 10 9 18"/></svg>Progress</div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="wspd-pin${pinned?' on':''}" onclick="wsProgPinToggle('${encodeURIComponent(x.key)}')" aria-label="Pin">★</div>
          <div class="hi-hdr-gear" onclick="openSettings()" aria-label="Settings"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="3.2"/><path d="M11 2.8v2.4M11 16.8v2.4M2.8 11h2.4M16.8 11h2.4M5.2 5.2l1.7 1.7M15.1 15.1l1.7 1.7M16.8 5.2l-1.7 1.7M6.9 15.1l-1.7 1.7"/></svg></div>
        </div>
      </div>
    </div>
    <div class="hi-scroll wsprog-scroll">
      <div class="wspd-name">${hiEscape(x.name)}</div>
      <div class="wsprog-card-tags" style="margin:6px 0 2px"><span class="wsprog-card-kind">${wsProgKindTag(x)}</span>${chips}</div>
      ${muscles?`<div class="wspd-muscles">${muscles}</div>`:''}
      <div class="wspd-hero">
        <div><div class="wspd-hv">${x.headline}</div><div class="wspd-hl">${x.headSub||''}</div></div>
        <div><div class="wspd-hv2">${x.bestLabel||'—'}</div><div class="wspd-hl">best</div></div>
        <div><div class="wspd-hv2">${x.count}</div><div class="wspd-hl">sessions</div></div>
      </div>
      <div class="wsprog-trend ${trendCls}" style="margin:2px 2px 8px"><span class="wsprog-tarrow">${arrow}</span><span>${hiEscape(x.insight||'')}</span></div>
      ${wsProgLimit(x)}
      ${cmpSeg}
      <div class="wspd-chart" id="${cmp?'wspdCmp':'wspdChart'}"></div>
      ${cmp?'<div class="wspd-cmpins" id="wspdCmpIns"></div>':''}
      <div class="wsprog-sect">Sessions</div>
      <div class="wspd-list">${rows}</div>
    </div>`;
  requestAnimationFrame(()=>{ if(cmp) wsProgPaintCmp(x); else wsProgPaintBig(x); });
}
// Compare mode: sets & session-volume indexed to 100 at the window start —
// overlay on one honest axis (never dual y-axes). The intersection is the story.
function wsProgPaintCmp(x){
  const box=document.getElementById('wspdCmp'); if(!box) return;
  const S=x.sessions;
  const setsSer=S.map(p=>p.sets||0);
  const volSer=S.map(p=>(p.vol!=null?p.vol:(p.totReps||0)));
  if(S.length<3||setsSer[0]<=0||volSer[0]<=0){ box.innerHTML='<div class="wsprog-spark-flat">Compare needs three sessions with sets logged.</div>'; return; }
  const iSets=setsSer.map(v=>v/setsSer[0]*100);
  const iVol=volSer.map(v=>v/volSer[0]*100);
  const all=iSets.concat(iVol);
  const dLo=Math.min(...all), dHi=Math.max(...all);
  const ticks=wsNiceTicks(dLo, dHi===dLo?dLo+1:dHi);
  let lo=Math.min(ticks[0],dLo,100), hi=Math.max(ticks[2],dHi,100);
  const span=(hi-lo)||1; lo-=span*0.04; hi+=span*0.04;
  const W=box.clientWidth||340, H=180, padL=8, padR=8, padT=14, padB=24;
  const yOf=v=>padT+(1-(v-lo)/(hi-lo))*(H-padT-padB);
  const xOf=i=>padL+(i/(S.length-1))*(W-padL-padR);
  const path=a=>a.map((v,i)=>(i?'L':'M')+xOf(i).toFixed(1)+' '+yOf(v).toFixed(1)).join('');
  const grid=ticks.map(v=>`<line x1="${padL}" y1="${yOf(v).toFixed(1)}" x2="${W-padR}" y2="${yOf(v).toFixed(1)}" stroke="rgba(255,255,255,.07)"/><text x="${W-padR}" y="${(yOf(v)-4).toFixed(1)}" text-anchor="end" class="wspd-gl">${Math.round(v)}</text>`).join('');
  box.innerHTML=`<div class="wspd-leg"><span class="l1">Sets</span><span class="l2">Volume</span><span class="l0">index · start = 100</span></div>
  <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
    ${grid}
    <line x1="${padL}" y1="${yOf(100).toFixed(1)}" x2="${W-padR}" y2="${yOf(100).toFixed(1)}" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 4"/>
    <path d="${path(iSets)}" fill="none" stroke="var(--rbreak)" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path(iVol)}" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linejoin="round"/>
    ${iSets.map((v,i)=>`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="2" fill="var(--rbreak)"/>`).join('')}
    ${iVol.map((v,i)=>`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="2.2" fill="var(--acc)"/>`).join('')}
    <text x="${padL}" y="${H-6}" class="wspd-gl">${wsProgFmtDate(S[0].t)}</text>
    <text x="${W-padR}" y="${H-6}" text-anchor="end" class="wspd-gl">${wsProgFmtDate(S[S.length-1].t)}</text>
  </svg>`;
  const ins=document.getElementById('wspdCmpIns');
  if(ins){
    const dS=iSets[iSets.length-1]-100, dV=iVol[iVol.length-1]-100;
    const F=5;
    let t;
    if(dV>F&&Math.abs(dS)<=F) t=`Volume up ${Math.round(dV)}% on flat sets — heavier work per set. Capability is rising.`;
    else if(dS>F&&Math.abs(dV)<=F) t=`Sets up ${Math.round(dS)}% with flat volume — more sets, lighter work per set.`;
    else if(Math.abs(dS)<=F&&Math.abs(dV)<=F&&x.trend>0) t=`Same work, more strength — efficiency. The 1RM line tells the rest.`;
    else if(dV>F&&dS>F) t=`Volume +${Math.round(dV)}% and sets +${Math.round(dS)}% — a building phase. Watch recovery.`;
    else if(dV<-F&&Math.abs(dS)<=F) t=`Volume down ${Math.round(-dV)}% on the same sets — lighter work per set lately.`;
    else t=`Volume ${dV>=0?'+':''}${Math.round(dV)}% · sets ${dS>=0?'+':''}${Math.round(dS)}% across this stretch.`;
    ins.textContent=t;
  }
}
function wsProgPaintBig(x){
  const box=document.getElementById('wspdChart'); if(!box) return;
  const ser=x.series||[];
  if(ser.length<2){ box.innerHTML='<div class="wsprog-spark-flat">Not enough sessions in this window for a trend line.</div>'; return; }
  const W=box.clientWidth||340, H=180, padL=8, padR=8, padT=14, padB=24;
  const vals=ser.map(p=>p.v);
  const dLo=Math.min(...vals), dHi=Math.max(...vals);
  const ticks=wsNiceTicks(dLo, dHi===dLo?dLo+1:dHi);
  let lo=Math.min(ticks[0], dLo), hi=Math.max(ticks[2], dHi);
  const span=(hi-lo)||1; lo-=span*0.04; hi+=span*0.04;
  const paceMetric=(x.metric==='pace');
  const yOf=v=>{ const t=(v-lo)/(hi-lo); const tt=paceMetric?t:(1-t); return padT+tt*(H-padT-padB); };
  const xOf=i=>padL+(i/(ser.length-1))*(W-padL-padR);
  let d=''; ser.forEach((p,i)=>{ d+=(i?'L':'M')+xOf(i).toFixed(1)+' '+yOf(p.v).toFixed(1); });
  const area=d+`L${xOf(ser.length-1).toFixed(1)} ${H-padB} L${xOf(0).toFixed(1)} ${H-padB} Z`;
  const col=x.trend>0?'var(--rest-c)':(x.trend<0?'#cf7052':'var(--tx3)');
  const grid=ticks.map((v,i)=>{
    const lbl=wsProgFmtVal(x, x.metric==='pace'?v:Math.round(v*100)/100);
    const shown=i===ticks.length-1 ? lbl : lbl.replace(' kg','').replace(' reps','').replace(' rounds','');
    return `<line x1="${padL}" y1="${yOf(v).toFixed(1)}" x2="${W-padR}" y2="${yOf(v).toFixed(1)}" stroke="rgba(255,255,255,.07)"/>
      <text x="${W-padR}" y="${(yOf(v)-4).toFixed(1)}" text-anchor="end" class="wspd-gl">${shown}</text>`;
  }).join('');
  const dots=ser.map((p,i)=>`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="2.2" fill="${col}"/>`).join('');
  const prDots=ser.map((p,i)=> p.pr?`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="4" fill="var(--gold)"/>`:'').join('');
  const midI=Math.floor((ser.length-1)/2);
  const midLbl = ser.length>=5 ? `<text x="${xOf(midI).toFixed(1)}" y="${H-6}" text-anchor="middle" class="wspd-gl">${wsProgFmtDate(ser[midI].t)}</text>` : '';
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
    <defs><linearGradient id="gBig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${col}" stop-opacity="0.2"/><stop offset="1" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#gBig)"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${prDots}
    <text x="${padL}" y="${H-6}" class="wspd-gl">${wsProgFmtDate(ser[0].t)}</text>
    ${midLbl}
    <text x="${W-padR}" y="${H-6}" text-anchor="end" class="wspd-gl">${wsProgFmtDate(ser[ser.length-1].t)}</text>
  </svg>`;
}
function hiRenderStub(view){
  const app=document.getElementById('app');
  // We render stubs into histView too (reusing the chrome-hidden state) but
  // since Progress/PRs aren't History, we render into #scroll-like area.
  // Simplest: temporarily use histView as a generic non-Today container.
  const root=document.getElementById('histView');
  if(!root) return;
  const title=view==='progress'?'Pro<em>gress</em>':'P<em>Rs</em>';
  const msg=view==='progress'
    ? 'The Progress dashboard is coming next — volume trends, movers, and your cross-modality intensity mix.'
    : 'Personal records are coming soon — your best lifts, paces, and circuits, tracked over time.';
  root.innerHTML=`<div class="hi-hdr"><div class="hi-hdr-main"><div class="hi-hdr-title">${title}</div><div class="hi-hdr-gear" onclick="openSettings()" aria-label="Settings"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="3.2"/><path d="M11 2.8v2.4M11 16.8v2.4M2.8 11h2.4M16.8 11h2.4M5.2 5.2l1.7 1.7M15.1 15.1l1.7 1.7M16.8 5.2l-1.7 1.7M6.9 15.1l-1.7 1.7"/></svg></div></div></div>
    <div class="hi-scroll"><div class="hi-empty">
      <div class="hi-empty-icon"><svg viewBox="0 0 24 24"><polyline points="2 16 7 10 12 13 20 4"/><polyline points="15 4 20 4 20 9"/></svg></div>
      <div class="hi-empty-title">Coming soon</div>
      <div class="hi-empty-sub">${msg}</div>
    </div></div>`;
}

function hiEscape(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// Initialize the body view class so Today shows by default.
document.getElementById('app').classList.add('view-today');
