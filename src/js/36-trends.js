
/* ════════════════════════════════════════════════════════════════════════════
   v48 — TRAINING TRENDS  (replaces the acute:chronic "Load trend" headline)
   ────────────────────────────────────────────────────────────────────────────
   The old metric was an acute:chronic workload ratio — 7-day sets over the
   28-day weekly average. It was built for injury-risk screening in team sport,
   it measured SETS while being labelled "load", and it answered a question a
   lifter rarely asks. It printed a verdict nobody could decode.

   This replaces it with four weekly series that answer the questions actually
   being asked: am I doing more, am I lifting heavier, and how hard did it feel.

   WHY SMALL MULTIPLES AND NOT ONE OVERLAID CHART
   The units are incompatible — sets are a count (~10-40), volume is kilograms
   (~5,000-15,000), load is kg/set (~20-80), effort is a 1-10 perceptual scale.
   Overlaying them needs either a shared axis (which flattens three of the four
   into noise) or multiple axes (which lets you imply any correlation you like
   by choosing scales). Stacked panels on a shared time axis, each with its own
   scale, let you read the SHAPES against each other honestly. That comparison
   is the whole point: heavier + fewer sets + higher effort reads as a strength
   block; everything down together reads as a deload or a layoff.

   WHY SESSIONS/WEEK IS SHOWN TOO
   Without it a drop in weekly volume is ambiguous — fewer sessions, or lighter
   sessions? It is context, not a headline, so it rides in the sets panel.

   EFFORT IS NOT INVENTED
   RPE is optional and per-exercise, and imported history has none at all. Weeks
   without a rating render as a GAP, never as zero — drawing zero would show a
   collapse in effort that never happened.
   ════════════════════════════════════════════════════════════════════════════ */

const WS_TREND_WEEKS = 12;
let wsTrendEx = 'ALL';          // exercise filter; 'ALL' = every exercise

function wsTrendWeekStart(t){   // Monday 00:00 local
  const d=new Date(t); d.setHours(0,0,0,0);
  const dow=(d.getDay()+6)%7;   // Mon=0
  d.setDate(d.getDate()-dow);
  return d.getTime();
}

// One row per week: how much, how heavy, how hard.
function wsTrendBuckets(exKey, weeks){
  weeks = weeks || WS_TREND_WEEKS;
  const hist = Array.isArray(HISTORY) ? HISTORY : [];
  if(!hist.length) return [];
  let maxT=0;
  for(const r of hist){ const t=new Date(r.date).getTime(); if(!isNaN(t)&&t>maxT) maxT=t; }
  if(!maxT) return [];
  const lastWeek = wsTrendWeekStart(maxT);
  const W = 7*86400000;
  const rows=[];
  for(let i=weeks-1;i>=0;i--){
    rows.push({ t:lastWeek-i*W, sets:0, volume:0, loadSum:0, loadN:0,
                effSum:0, effN:0, sessions:0, _days:Object.create(null) });
  }
  const byT = Object.create(null);
  rows.forEach(r=>byT[r.t]=r);

  for(const rec of hist){
    const t=new Date(rec.date).getTime(); if(isNaN(t)) continue;
    const row=byT[wsTrendWeekStart(t)]; if(!row) continue;
    let touched=false;
    for(const e of (rec.entries||[])){
      if(e.kind!=='weighted' && e.kind!=='bodyweight') continue;
      if(exKey!=='ALL' && wsTrendExKey(e)!==exKey) continue;
      for(const s of (e.sets||[])){
        if(s.completed===false) continue;
        if(s.warmup) continue;                       // warm-ups are not working sets
        row.sets++;
        const load=(typeof s.weightKg==='number') ? s.weightKg
                 : ((s.bodyweightKg||0)+(s.offsetKg||0));
        const reps=(typeof s.reps==='number')?s.reps:0;
        row.volume += Math.max(0,load)*reps;
        if(load>0){ row.loadSum+=load; row.loadN++; }
        touched=true;
      }
      // v49: effort moved to the session level — see wsSessionEffort.
    }
    if(touched){
      const dayKey=new Date(t).toDateString();
      if(!row._days[dayKey]){ row._days[dayKey]=1; row.sessions++; }
      // v49: one effort rating per SESSION, so a week of curls and a week of
      // heavy compounds are on the same footing. Composition-proof by design.
      const se=wsSessionEffort(rec);
      if(se){ row.effSum+=se.value; row.effN++; if(se.source==='estimated') row.effEst=(row.effEst||0)+1; }
    }
  }
  return rows.map(r=>({
    t:r.t,
    sets:r.sets,
    volume:Math.round(r.volume),
    load: r.loadN ? Math.round((r.loadSum/r.loadN)*10)/10 : null,
    effort: r.effN ? Math.round((r.effSum/r.effN)*10)/10 : null,   // null = never rated
    effortEstimated: !!r.effEst,
    sessions:r.sessions
  }));
}

function wsTrendExKey(e){ return e.exId || ('name:'+String(e.name||'').trim().toLowerCase()); }

// every exercise present in history, most-recent first
function wsTrendExList(){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const seen=Object.create(null);
  for(const rec of hist){
    const t=new Date(rec.date).getTime();
    for(const e of (rec.entries||[])){
      if(e.kind!=='weighted'&&e.kind!=='bodyweight') continue;
      const k=wsTrendExKey(e);
      if(!seen[k]||t>seen[k].t) seen[k]={key:k,name:e.name||'—',t:t};
    }
  }
  return Object.keys(seen).map(k=>seen[k]).sort((a,b)=>b.t-a.t);
}

// second half of the window vs first half, per series
function wsTrendDelta(rows,field){
  const vals=rows.map(r=>r[field]).filter(v=>typeof v==='number'&&isFinite(v));
  if(vals.length<4) return null;
  const half=Math.floor(rows.length/2);
  const a=rows.slice(0,half).map(r=>r[field]).filter(v=>typeof v==='number');
  const b=rows.slice(half).map(r=>r[field]).filter(v=>typeof v==='number');
  if(!a.length||!b.length) return null;
  const av=a.reduce((x,y)=>x+y,0)/a.length, bv=b.reduce((x,y)=>x+y,0)/b.length;
  if(av===0) return null;
  return Math.round(((bv-av)/av)*1000)/10;   // percent
}

/* The read-out names the SHAPE of the data and stops there. It does not say
   "you were ill" or "you deloaded" — those are causes, and a tracker that
   guesses causes and gets one wrong loses the user's trust in all of it. */
function wsTrendReadout(rows){
  const dl=wsTrendDelta(rows,'load');
  const ds=wsTrendDelta(rows,'sets');
  const de=wsTrendDelta(rows,'effort');
  const dv=wsTrendDelta(rows,'volume');
  const TH=7;                                 // below this is noise, not a trend
  const dir=v=>v==null?null:(v>TH?'up':(v<-TH?'down':'flat'));
  const L=dir(dl), S=dir(ds), E=dir(de), V=dir(dv);
  if(L==null&&S==null) return null;
  const bits=[];
  if(L==='up') bits.push('heavier'); else if(L==='down') bits.push('lighter');
  if(S==='up') bits.push('more sets'); else if(S==='down') bits.push('fewer sets');
  // When set count barely moves, volume is what tells you the workload changed —
  // same sets at a heavier load is the textbook overload pattern and would
  // otherwise go unmentioned.
  else if(V==='up') bits.push('more total work'); else if(V==='down') bits.push('less total work');
  if(E==='up') bits.push('higher effort'); else if(E==='down') bits.push('lower effort');
  if(!bits.length) return {text:'Holding steady across the window.',tone:'flat'};
  let tone='flat';
  if(L==='up'&&S==='down') tone='strength';
  else if(L==='up'&&S==='flat') tone='strength';   // progressive overload
  else if(L==='down'&&S==='down') tone='easing';
  else if(S==='up'&&(L==='up'||L==='flat')) tone='building';
  const cap=bits.join(', ');
  return {text:cap.charAt(0).toUpperCase()+cap.slice(1)+' over the last '+rows.length+' weeks.',tone:tone};
}

// sparkline; nulls become gaps, never zeros
function wsTrendSpark(vals,accent){
  const W=280,H=40,P=3;
  const nums=vals.filter(v=>typeof v==='number'&&isFinite(v));
  if(nums.length<2) return '<div class="wstrend-nodata">Not enough data yet</div>';
  let lo=Math.min.apply(null,nums), hi=Math.max.apply(null,nums);
  if(hi===lo){ hi=lo+1; lo=Math.max(0,lo-1); }
  const x=i=>P+(i*(W-2*P))/(vals.length-1);
  const y=v=>H-P-((v-lo)/(hi-lo))*(H-2*P);
  let d='',open=false,dots='';
  vals.forEach((v,i)=>{
    if(typeof v!=='number'||!isFinite(v)){ open=false; return; }
    d += (open?' L ':' M ')+x(i).toFixed(1)+' '+y(v).toFixed(1);
    open=true;
  });
  const last=vals.length-1;
  if(typeof vals[last]==='number') dots='<circle cx="'+x(last).toFixed(1)+'" cy="'+y(vals[last]).toFixed(1)+'" r="3" fill="'+accent+'"/>';
  return '<svg class="wstrend-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'
       + '<path d="'+d.trim()+'" fill="none" stroke="'+accent+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
       + dots + '</svg>';
}

function wsTrendFmtVol(v){
  if(v>=1000) return (v/1000).toFixed(v>=10000?0:1)+'t';
  return String(Math.round(v));
}
function wsTrendDeltaChip(d,inverse){
  if(d==null) return '<span class="wstrend-d flat">—</span>';
  const cls = Math.abs(d)<7 ? 'flat' : (d>0 ? (inverse?'dn':'up') : (inverse?'up':'dn'));
  const sign = d>0?'+':'';
  return '<span class="wstrend-d '+cls+'">'+sign+d+'%</span>';
}

function wsTrendPanel(title,sub,vals,cur,delta,accent){
  return '<div class="wstrend-p">'
    +'<div class="wstrend-h">'
      +'<span class="wstrend-t">'+title+'</span>'
      +'<span class="wstrend-v">'+cur+'</span>'
      + wsTrendDeltaChip(delta)
    +'</div>'
    + (sub?'<div class="wstrend-s">'+sub+'</div>':'')
    + wsTrendSpark(vals,accent)
  +'</div>';
}

function wsRenderTrends(){
  const rows=wsTrendBuckets(wsTrendEx,WS_TREND_WEEKS);
  if(!rows.length) return '';
  const last=rows[rows.length-1];
  const list=wsTrendExList();
  const opts=['<option value="ALL">All exercises</option>']
    .concat(list.map(e=>'<option value="'+e.key.replace(/"/g,'&quot;')+'"'
      +(e.key===wsTrendEx?' selected':'')+'>'+e.name+'</option>')).join('');

  const ratedWeeks=rows.filter(r=>r.effort!=null).length;
  const estWeeks=rows.filter(r=>r.effortEstimated).length;
  const effortSub = ratedWeeks===0
    ? 'Not rated yet — rate a session at the end of your workout'
    : (estWeeks ? estWeeks+' of '+ratedWeeks+' rated weeks are estimated'
      : (ratedWeeks<rows.length ? ratedWeeks+' of '+rows.length+' weeks rated' : 'session rating, 1-10'));

  const ro=wsTrendReadout(rows);
  const readout = ro ? '<div class="wstrend-read '+ro.tone+'">'+ro.text+'</div>' : '';

  const avgSess=Math.round((rows.reduce((a,r)=>a+r.sessions,0)/rows.length)*10)/10;

  return '<div class="wstrend">'
    +'<div class="wstrend-bar">'
      +'<span class="wstrend-cap">Trends · last '+WS_TREND_WEEKS+' weeks</span>'
      +'<select class="wstrend-sel" onchange="wsTrendSetEx(this.value)" aria-label="Filter by exercise">'+opts+'</select>'
    +'</div>'
    + readout
    + wsTrendPanel('Sets','per week · '+avgSess+' sessions/wk avg',
        rows.map(r=>r.sets), last.sets, wsTrendDelta(rows,'sets'), 'var(--acc)')
    + wsTrendPanel('Volume','per week',
        rows.map(r=>r.volume), wsTrendFmtVol(last.volume)+' kg', wsTrendDelta(rows,'volume'), 'var(--lilac)')
    + (function(){
        // Across all exercises, raw kg/set is a mean over a heterogeneous basket
        // and moves with the exercise MIX. Verified: 3 Aug -> 10 Aug it reported
        // -15.7% in a week where every repeated lift held or rose. Use the
        // fixed-basket index there. For one exercise there is no mix, so show kg.
        const single = wsTrendEx!=='ALL';
        if(single){
          return wsTrendPanel('Load','average per set',
            rows.map(r=>r.load), (last.load==null?'—':last.load+' kg'),
            wsTrendDelta(rows,'load'), '#6fb3d2');
        }
        const ix=wsTrendLoadIndex(rows,'ALL')||[];
        const cur=ix.length?ix[ix.length-1]:null;
        const first=ix.find(v=>v!=null);
        const d=(cur!=null&&first!=null&&first>0)?Math.round((cur-first)*10)/10:null;
        return wsTrendPanel('Load','each lift vs its own baseline · controls for exercise mix',
          ix, (cur==null?'—':cur+'%'), d, '#6fb3d2');
      })()
    + wsTrendPanel('Effort', effortSub,
        rows.map(r=>r.effort), (last.effort==null?'—':last.effort+'/10'), wsTrendDelta(rows,'effort'), '#d99a4e')
    + wsRenderAdaptation()
  +'</div>';
}

function wsTrendSetEx(k){ wsTrendEx=k||'ALL'; try{ wsProgRender(); }catch(_){ try{ renderAll(false); }catch(__){} } }
