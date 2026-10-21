
// Progress / PRs stubs — placeholders until those views are built.

// ═══════════════════════════════════════════════════════════════════
// PROGRESS ENGINE (wsProgKit) — pure data layer, no DOM. Exercise-first.
// Groups HISTORY by exId (falling back to normalized name), builds a
// per-exercise timeline, and derives at-a-glance metrics + a plain-language
// insight in the app's grounded voice. Muscle rollup lives here too but is
// surfaced lower in the UI hierarchy (exercise-first is the spine).
// ═══════════════════════════════════════════════════════════════════
const WS_PROG_FRAMES={ '4W':28, '8W':56, '6M':182, '1Y':365, 'ALL':100000 };
let wsProgFrame='8W';   // default lens
let wsProgExId=null;
let wsProgLens='strength';   // 'strength' | 'vol' — the Strength-section lens    // selected exercise for detail (Iteration 2)

function wsProgCutoff(frame){
  const days=WS_PROG_FRAMES[frame]||56;
  if(days>=100000) return 0;
  return Date.now()-days*86400000;
}
// A stable per-exercise key: prefer exId, else normalized name (so free-text
// and catalog entries both aggregate correctly across sessions).
function wsProgKey(entry){
  if(entry.exId) return 'id:'+entry.exId;
  const n=wsMaxKey(entry.name);
  return n?('nm:'+n):null;
}
// e1RM for a single set (loaded lifts). Epley, capped ≤10 reps upstream.
function wsProgSetE1RM(st){
  if(st.completed===false) return null;
  const w=(typeof st.weightKg==='number')?st.weightKg
        :(typeof st.offsetKg==='number'?st.offsetKg:null);
  if(w==null) return null;
  return wsEpley(w, st.reps);
}
// Build the full per-exercise dataset from HISTORY within a time frame.
// Returns { list:[perExercise...], byKey:{} } sorted by most-recent activity.
function wsProgBuild(frame){
  frame=frame||wsProgFrame;
  const cutoff=wsProgCutoff(frame);
  const map={};
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  // PASS 1 — full history (PR events are ALL-TIME, independent of the frame)
  for(const rec of hist){
    const t=new Date(rec.date).getTime();
    if(isNaN(t)) continue;
    for(const e of (rec.entries||[])){
      const key=wsProgKey(e); if(!key) continue;
      let x=map[key];
      if(!x){
        const cat=e.exId?EXERCISES.find(c=>c&&c.exId===e.exId):null;
        x=map[key]={ key, exId:e.exId||null, name:e.name||'(unnamed)',
          kind:e.kind, muscles:(e.muscles&&e.muscles.length?e.muscles:(cat&&cat.muscles)||[]),
          all:[], sessions:[] };
      }
      const pt=wsProgSessionPoint(e, t, rec.date);
      if(pt) x.all.push(pt);
    }
  }
  const list=Object.values(map);
  for(const x of list){
    x.all.sort((a,b)=>a.t-b.t);
    // canonical metric value per point + strict all-time PR marking
    const canon=wsProgCanonVal;
    let run=null;
    const pace=(x.kind==='cardio' && x.all.some(p=>p.pace!=null));
    for(const p of x.all){
      const v=canon(x,p); p._cv=v;
      if(v==null) continue;
      if(run===null){ run=v; p.pr=false; }             // baseline session — never a PR event
      else if(pace ? v<run-0.001 : v>run+0.001){ p.pr=true; run=v; }
      else p.pr=false;
    }
    x.allBest = run;
    x.sessions = x.all.filter(p=>p.t>=cutoff);
    wsProgDerive(x);
  }
  const kept=list.filter(x=>x.sessions.length>0);
  kept.sort((a,b)=> b.sessions[b.sessions.length-1].t - a.sessions[a.sessions.length-1].t);
  const byKey={}; kept.forEach(x=>byKey[x.key]=x);
  return { list:kept, byKey, frame };
}
// The exercise's canonical performance value (PRs live here, whatever the lens).
function wsProgCanonVal(x,p){
  if(x.kind==='weighted'||x.kind==='bodyweight'){
    return (p.e1rm!=null)?p.e1rm:(p.topReps!=null?p.topReps:null);
  }
  if(x.kind==='cardio') return (p.pace!=null)?p.pace:(p.durationSec||null);
  if(x.kind==='hiit') return p.roundsDone||null;
  return null;
}
function wsProgSessionPoint(e, t, dateISO){
  if(e.kind==='weighted'||e.kind==='bodyweight'){
    let bestE=null, topW=null, topReps=null, totReps=0, sets=0;
    for(const st of (e.sets||[])){
      if(st.completed===false) continue;
      sets++; totReps+=(st.reps||0);
      const v=wsProgSetE1RM(st);
      if(v!=null&&(bestE==null||v>bestE)) bestE=v;
      const w=(typeof st.weightKg==='number')?st.weightKg:(st.offsetKg||0);
      if(topW==null||w>topW){ topW=w; }
      if(topReps==null||(st.reps||0)>topReps) topReps=st.reps||0;
    }
    let vol=0;
    for(const st of (e.sets||[])){
      if(st.completed===false) continue;
      const w=(typeof st.weightKg==='number')?st.weightKg:(typeof st.offsetKg==='number'?st.offsetKg:0);
      vol+=(st.reps||0)*w;
    }
    return { t, date:dateISO, kind:e.kind, sets,
             e1rm: bestE!=null?Math.round(bestE):null,
             topW: topW!=null?topW:null, topReps, totReps,
             vol: Math.round(vol),
             bw:(e.kind==='bodyweight') };
  }
  if(e.kind==='cardio'&&e.cardio){
    const c=e.cardio;
    const dist=(typeof c.distanceM==='number')?c.distanceM:null;
    const dur=(typeof c.durationSec==='number')?c.durationSec:null;
    let pace=null; // sec per km (distance runs/rides)
    if(dist&&dur&&dist>0) pace=dur/(dist/1000);
    return { t, date:dateISO, kind:'cardio', cardioKind:c.cardioKind,
             distanceM:dist, durationSec:dur, pace,
             intensity:c.intensityTag||null };
  }
  if(e.kind==='hiit'&&e.hiit){
    const h=e.hiit;
    return { t, date:dateISO, kind:'hiit', roundsDone:h.roundsDone||0,
             roundsPlanned:h.roundsPlanned||0, workSec:h.workSecTotal||0,
             peakRpe:(typeof h.peakRpe==='number')?h.peakRpe:null };
  }
  return null;
}
// Trend + headline + plain-language insight, per exercise kind.
function wsProgDerive(x){
  const S=x.sessions, n=S.length;
  x.count=n;
  x.lastT = n? S[n-1].t : 0;
  x.prTs = S.filter(p=>p.pr).map(p=>p.t);
  x.prEvents = x.prTs.length;
  if(n===0){ x.headline='—'; x.insight='No sessions in this window.'; x.series=[]; x.trend=0; return; }
  const lens=wsProgLens;
  const strength=(x.kind==='weighted'||x.kind==='bodyweight');

  if(strength){
    const hasLoad=S.some(p=>p.e1rm!=null);
    if(lens==='vol'){
      if(hasLoad){
        x.metric='vol';
        x.series=S.map(p=>({t:p.t, v:p.vol||0, pr:p.pr}));
        x.current=x.series[n-1].v;
        x.headline=wsProgVolFmt(x.current)+' kg';
        x.headSub='session volume · '+S[n-1].sets+' set'+(S[n-1].sets===1?'':'s');
      } else {
        x.metric='reps-vol';
        x.series=S.map(p=>({t:p.t, v:p.totReps||0, pr:p.pr}));
        x.current=x.series[n-1].v;
        x.headline=x.current+' reps';
        x.headSub='session total · '+S[n-1].sets+' set'+(S[n-1].sets===1?'':'s');
      }
    } else if(hasLoad){
      x.metric='e1rm';
      x.series=S.filter(p=>p.e1rm!=null).map(p=>({t:p.t, v:p.e1rm, pr:p.pr}));
      x.current=x.series.length?x.series[x.series.length-1].v:null;
      x.headline=(x.current!=null?fmtW(x.current):'—')+' kg';
      x.headSub='est 1RM';
    } else {
      x.metric='reps';
      x.series=S.map(p=>({t:p.t, v:p.topReps||0, pr:p.pr}));
      x.current=x.series[n-1].v;
      x.headline=x.current+' reps';
      x.headSub='top set';
    }
    // all-time best label rides the CANONICAL metric
    if(hasLoad){ x.best=x.allBest; x.bestUnit='kg'; x.bestLabel=(x.allBest!=null?fmtW(x.allBest)+' kg':null); }
    else { x.best=x.allBest; x.bestUnit='reps'; x.bestLabel=(x.allBest!=null?x.allBest+' reps':null); }
    wsProgTrendInsight(x, x.metric==='vol'?'kg-vol':(x.metric==='reps-vol'?'reps':'')||x.bestUnit);
    if(!x.series.length){ x.trend=0; x.insight='No comparable sets in this window.'; }
    return;
  }
  if(x.kind==='cardio'){
    const hasPace=S.some(p=>p.pace!=null);
    if(hasPace){
      x.metric='pace';
      x.series=S.filter(p=>p.pace!=null).map(p=>({t:p.t, v:p.pace, pr:p.pr}));
      x.current=x.series[x.series.length-1].v;
      x.best=x.allBest; x.bestUnit='pace';
      x.bestLabel=(x.allBest!=null?wsFmtPace(x.allBest)+'/km':null);
      x.headline=wsFmtPace(x.current);
      x.headSub='per km';
      wsProgTrendInsight(x,'pace');
    } else {
      x.metric='duration';
      x.series=S.map(p=>({t:p.t, v:p.durationSec||0, pr:p.pr}));
      x.current=x.series[n-1].v;
      x.best=x.allBest; x.bestUnit='dur';
      x.bestLabel=(x.allBest!=null?fmtMS(x.allBest):null);
      x.headline=fmtMS(x.current);
      x.headSub='duration';
      wsProgTrendInsight(x,'dur');
    }
    return;
  }
  if(x.kind==='hiit'){
    x.metric='rounds';
    x.series=S.map(p=>({t:p.t, v:p.roundsDone||0, pr:p.pr}));
    x.current=x.series[n-1].v;
    x.best=x.allBest; x.bestUnit='rounds';
    x.bestLabel=(x.allBest!=null?x.allBest+' rounds':null);
    x.headline=x.current+' rounds';
    x.headSub='last done';
    wsProgTrendInsight(x,'rounds');
    return;
  }
  x.series=[]; x.trend=0; x.headline='—'; x.insight='';
}
function wsProgTrendInsight(x, unit){
  const ser=x.series; const n=ser.length;
  if(n<2){ x.trend=0; x.insight = n===1 ? 'First session logged — baseline set.' : ''; return; }
  const paceMetric=(unit==='pace');
  // Robust trend: mean of the earliest third vs the latest third (single
  // sessions are noisy — a headwind, an off day — so we compare windows).
  const k=Math.max(1,Math.floor(n/3));
  const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
  const early=mean(ser.slice(0,k).map(p=>p.v));
  const recent=mean(ser.slice(-k).map(p=>p.v));
  const first=early, last=recent;
  const improved = paceMetric ? (last<first) : (last>first);
  const delta = Math.abs(last-first);
  // Signal-vs-noise: the windowed change must exceed the series' own natural
  // scatter (mean absolute step between consecutive sessions). This stops
  // steady-state work (e.g. Zone-2 cardio that just oscillates) from being
  // mislabeled as a trend, while real progressions still register.
  const contin = (unit==='kg'||unit==='pace'||unit==='dur');
  let scatter=0;
  if(contin && n>=3){
    let acc=0; for(let i=1;i<ser.length;i++) acc+=Math.abs(ser[i].v-ser[i-1].v);
    scatter=acc/(ser.length-1);
  }
  const floor = contin ? Math.max(first*0.015, scatter*0.9) : 1;
  const sig = delta >= floor;
  x.moveScore = (improved&&sig) ? delta/Math.max(floor,0.001) : 0;
  // recent stall detection: no new best in the last 3 sessions
  const bestVal = paceMetric?Math.min(...ser.map(p=>p.v)):Math.max(...ser.map(p=>p.v));
  // PR machinery is ALL-TIME and canonical (set in wsProgBuild); align here:
  const lastAll = x.sessions[x.sessions.length-1];
  x.newBest = !!(lastAll && lastAll.pr);
  const allPr = x.all ? x.all.filter(p=>p.pr) : [];
  x.bestT = allPr.length ? allPr[allPr.length-1].t : (x.all&&x.all.length?x.all[0].t:ser[n-1].t);
  x.lastIsBest = (x.allBest!=null && lastAll && lastAll._cv!=null)
    ? (paceMetric ? lastAll._cv<=x.allBest+0.001 : lastAll._cv>=x.allBest-0.001)
    : false;
  x.stalledW = Math.max(0, Math.round((x.lastT - x.bestT)/(7*86400000)));
  const lastK=ser.slice(-3);
  const madeRecentBest = lastK.some(p=> paceMetric ? p.v<=bestVal+0.001 : p.v>=bestVal-0.001);
  const spanWeeks=Math.max(1,Math.round((ser[n-1].t-ser[0].t)/(7*86400000)));
  x.trend = paceMetric ? (improved?1:(last>first?-1:0)) : (last>first?1:(last<first?-1:0));

  const fmtDelta=(u,d)=>{
    if(u==='kg') return fmtW(Math.round(d*2)/2)+' kg';
    if(u==='kg-vol') return wsProgVolFmt(Math.round(d))+' kg';
    if(u==='reps'){const r=Math.round(d);return r+(r===1?' rep':' reps');}
    if(u==='rounds'){const r=Math.round(d);return r+(r===1?' round':' rounds');}
    if(u==='pace') return wsFmtPaceDelta(d);
    if(u==='dur') return fmtMS(Math.round(d));
    return Math.round(d)+'';
  };
  if(improved && delta>0 && sig){
    if(paceMetric){
      const word=(n>=4)?'steady gains':'getting faster';
      x.insight = (!madeRecentBest && n>=4)
        ? fmtDelta(unit,delta)+' faster overall · no new best in '+x.stalledW+'w'
        : fmtDelta(unit,delta)+' faster in '+spanWeeks+'w · '+word;
    } else if(!madeRecentBest && n>=4){
      x.insight='Up '+fmtDelta(unit,delta)+' overall · no new best in '+x.stalledW+'w';
    } else {
      const word = (n>=4)?'steady climb':'moving up';
      x.insight='Up '+fmtDelta(unit,delta)+' in '+spanWeeks+'w · '+word;
    }
  } else if(!improved && (paceMetric? last>first : last<first) && delta>0 && sig){
    x.insight = paceMetric
      ? fmtDelta(unit,delta)+' slower than your window start'
      : 'Down '+fmtDelta(unit,delta)+' from your window start';
  } else {
    // flat-ish
    if(n>=3) x.insight='Holding steady · '+n+' sessions';
    else x.insight=n+' sessions logged';
  }
  if(x.lastIsBest && improved && sig && n>=3){
    x.insight += ' — sitting at your best';
  }
  // plateau override: enough data, no recent best
  if(n>=4 && !madeRecentBest && improved){
    x.plateau=true;
  }
}
// pace helpers (sec/km → m:ss)
function wsFmtPace(secPerKm){
  if(secPerKm==null||!isFinite(secPerKm)) return '—';
  const m=Math.floor(secPerKm/60), sec=Math.round(secPerKm%60);
  return m+':'+String(sec).padStart(2,'0');
}
function wsFmtPaceDelta(d){
  const sec=Math.round(d);
  return sec+'s/km';
}
function wsProgVolFmt(v){
  v=Math.round(v||0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009');
}
// Three "nice" gridline values spanning [lo,hi] (1/2/2.5/5 × 10^k steps).
function wsNiceTicks(lo,hi){
  if(!(hi>lo)) hi=lo+1;
  const raw=(hi-lo)/2;
  const mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10));
  const norm=raw/mag;
  const step=(norm<1.5?1:norm<2.25?2:norm<3.5?2.5:norm<7?5:10)*mag;
  const t0=Math.floor(lo/step)*step;
  return [t0, t0+step, t0+2*step].map(v=>Math.round(v*100)/100);
}
function wsProgLoadTrend(){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let refT=0;
  for(const r of hist){ const t=new Date(r.date).getTime(); if(t>refT) refT=t; }
  if(!refT) return null;
  const D=86400000;
  let a=0,c=0;
  for(const r of hist){
    const t=new Date(r.date).getTime(); if(isNaN(t)) continue;
    let sets=0;
    for(const e of (r.entries||[])){
      if(e.kind!=='weighted'&&e.kind!=='bodyweight') continue;
      for(const st of (e.sets||[])) if(st.completed!==false) sets++;
    }
    if(t>refT-7*D && t<=refT) a+=sets;
    if(t>refT-28*D && t<=refT) c+=sets;
  }
  const weekly=c/4;
  if(weekly<1) return null;
  const ratio=a/weekly;
  const state= ratio<0.8?'easing off':(ratio<=1.3?'steady build':(ratio<1.5?'pushing':'spiking'));
  const tail= ratio>=1.5?' · watch recovery':'';
  // v47: this was labelled "Load trend" but it counts SETS, not load — it is an
  // acute:chronic VOLUME ratio. The old string gave a verdict with no numbers, so
  // nobody (including its author) could recall what it meant. The numbers are now
  // the explanation, and the label states the comparison outright.
  const wk=Math.round(weekly);
  return { ratio:Math.round(ratio*100)/100, state, weekSets:a, avgSets:wk,
    label:'Sets this week vs your 4-week average',
    line:a+' sets this week vs '+wk+'/wk average · '+state+tail };
}
// Consistency grid: 84 days ending at the last logged day, sets per day.
function wsProgDayGrid(){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let refT=0;
  for(const r of hist){ const t=new Date(r.date).getTime(); if(t>refT) refT=t; }
  if(!refT) return [];
  // v55: end the grid today, like every other Progress window. It used to end
  // at the last logged session, so a two-week break did not show as a gap.
  refT=Math.max(refT, Date.now());
  const D=86400000, start=refT-83*D;
  const byDay={};
  for(const r of hist){
    const t=new Date(r.date).getTime(); if(isNaN(t)||t<start-D) continue;
    const dk=new Date(r.date).toISOString().slice(0,10);
    let sets=0;
    for(const e of (r.entries||[])){
      if(e.kind==='weighted'||e.kind==='bodyweight'){
        for(const st of (e.sets||[])) if(st.completed!==false) sets++;
      } else sets+=1; // a cardio/circuit session marks the day active
    }
    byDay[dk]=(byDay[dk]||0)+sets;
  }
  const out=[];
  for(let i=0;i<84;i++){
    const d=new Date(start+i*D).toISOString().slice(0,10);
    out.push({ d, sets:byDay[d]||0 });
  }
  return out;
}

// ── Weekly working sets per muscle (strength sets only — the literature's
//     10–20 sets/muscle/week guidance is a resistance-training measure;
//     conditioning rounds are not "working sets" and would pollute it). ──
function wsProgMuscleWeekly(frame){
  frame=frame||wsProgFrame;
  const cutoff=wsProgCutoff(frame);
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const tot={}; let firstT=null,lastT=null;
  for(const rec of hist){
    const t=new Date(rec.date).getTime();
    if(isNaN(t)||t<cutoff) continue;
    let counted=false;
    for(const e of (rec.entries||[])){
      if(e.kind!=='weighted'&&e.kind!=='bodyweight') continue;
      let sets=0; for(const st of (e.sets||[])) if(st.completed!==false) sets++;
      if(!sets) continue;
      counted=true;
      const ms=(e.muscles&&e.muscles.length)?e.muscles:['Other'];
      for(const m of ms) tot[m]=(tot[m]||0)+sets;
    }
    if(counted){ if(firstT==null||t<firstT)firstT=t; if(lastT==null||t>lastT)lastT=t; }
  }
  const weeks=Math.max(1,(lastT!=null?(lastT-firstT):0)/(7*86400000));
  return Object.keys(tot).map(m=>({m,total:tot[m],perWk:Math.round((tot[m]/weeks)*10)/10}))
    .sort((a,b)=>b.perWk-a.perWk);
}

// ── At-a-glance summary across ALL exercises in the frame ──
function wsProgSummary(frame){
  frame=frame||wsProgFrame;
  const cutoff=wsProgCutoff(frame);
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  let sessions=0, sets=0; const days=new Set();
  for(const rec of hist){
    const t=new Date(rec.date).getTime();
    if(isNaN(t)||t<cutoff) continue;
    sessions++;
    days.add(new Date(rec.date).toISOString().slice(0,10));
    for(const e of (rec.entries||[])){
      if(e.kind==='weighted'||e.kind==='bodyweight'){
        for(const st of (e.sets||[])) if(st.completed!==false) sets++;
      }
    }
  }
  return { sessions, sets, activeDays:days.size, frame };
}
