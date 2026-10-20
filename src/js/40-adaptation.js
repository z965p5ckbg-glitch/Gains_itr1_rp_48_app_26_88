

/* ════════════════════════════════════════════════════════════════════════════
   v52 — ADAPTATION MIX
   ────────────────────────────────────────────────────────────────────────────
   The trend panels answer "how much / how heavy / how hard". This answers
   "what KIND of stimulus, and where" — the Galpin adaptation framing, made
   concrete from data actually logged.

   WHAT IT CAN HONESTLY INFER
   Logged per set: reps and load. NOT logged: bar velocity, reps-in-reserve,
   inter-set rest. So power (needs velocity) and true proximity-to-failure
   (needs RIR) are NOT inferable and are not claimed. What survives is the rep
   band, which is the standard, defensible proxy:
       heavy     1-5    strength-leaning
       moderate  6-12   the classic hypertrophy band
       light     13+    endurance-leaning
   Hypertrophy occurs across a wide rep range when sets approach failure, so
   this describes the DISTRIBUTION of stimulus — it never claims a given set
   "built muscle".

   HOW SETS ARE CREDITED TO MUSCLES — the decision that makes or breaks it
   A bench set trains chest, front delts and triceps. Crediting 1 set to each
   triples the work and makes every pressing muscle look over-trained. The
   catalog splits primary from secondary on all 604 entries, so:
       primary mover    1.0 set
       secondary mover  0.5 set
   which is the convention used in volume-landmark work (Israetel et al).
   Entries with no catalog match fall back to their flat muscle list at 0.5,
   and say so rather than silently inflating.
   ════════════════════════════════════════════════════════════════════════════ */

const WS_ADAPT_BANDS = [
  {key:'heavy', label:'Heavy',    sub:'1-5 reps',  lo:1,  hi:5,   color:'var(--acc)'},
  {key:'mod',   label:'Moderate', sub:'6-12 reps', lo:6,  hi:12,  color:'var(--lilac)'},
  {key:'light', label:'Light',    sub:'13+ reps',  lo:13, hi:999, color:'#6fb3d2'},
];
function wsAdaptBand(reps){
  for(const b of WS_ADAPT_BANDS) if(reps>=b.lo && reps<=b.hi) return b.key;
  return null;
}

function wsAdaptCatalog(exId){
  try{
    if(!exId || typeof EXERCISES==='undefined') return null;
    return EXERCISES.find(e=>e.exId===exId)||null;
  }catch(_){ return null; }
}

// weeks -> { muscles:{name:{heavy,mod,light,total}}, bands:{...}, conditioning, weeks, unmatched }
function wsAdaptBuckets(weeks){
  weeks=weeks||WS_TREND_WEEKS;
  const rows=wsTrendBuckets('ALL',weeks);
  if(!rows.length) return null;
  const from=rows[0].t, to=rows[rows.length-1].t+7*86400000;
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const muscles=Object.create(null);
  const bands={heavy:0,mod:0,light:0};
  let conditioning=0, unmatched=0, totalSets=0;

  const credit=(name,band,amount)=>{
    const m=muscles[name]||(muscles[name]={heavy:0,mod:0,light:0,total:0});
    m[band]+=amount; m.total+=amount;
  };

  for(const rec of hist){
    const t=new Date(rec.date).getTime();
    if(isNaN(t)||t<from||t>=to) continue;
    for(const e of (rec.entries||[])){
      if(e.kind==='cardio'||e.kind==='hiit'){ conditioning++; continue; }
      if(e.kind!=='weighted'&&e.kind!=='bodyweight') continue;
      const cat=wsAdaptCatalog(e.exId);
      let prim=[], sec=[];
      if(cat&&Array.isArray(cat.primary)&&cat.primary.length){
        prim=cat.primary; sec=Array.isArray(cat.secondary)?cat.secondary:[];
      } else {
        // no catalog match: treat every listed muscle as secondary rather than
        // pretending we know which one is the prime mover
        sec=Array.isArray(e.muscles)?e.muscles:[];
        if(sec.length) unmatched++;
      }
      for(const s of (e.sets||[])){
        if(s.completed===false||s.warmup) continue;
        const reps=(typeof s.reps==='number')?s.reps:0;
        const band=wsAdaptBand(reps);
        if(!band) continue;
        bands[band]++; totalSets++;
        for(const m of prim) credit(m,band,1);
        for(const m of sec)  credit(m,band,0.5);
      }
    }
  }
  const list=Object.keys(muscles).map(k=>({name:k,...muscles[k]}))
    .filter(m=>m.total>0).sort((a,b)=>b.total-a.total);
  // weeks = complete weeks in the window (this week's sets are included in the
  // mix, but the caption names the period the way the rest of Progress does)
  return {muscles:list, bands, conditioning, weeks:rows.filter(r=>!r.partial).length, totalSets, unmatched};
}

/* Describes the distribution. Makes no prescription — "you need more heavy work"
   depends on goals, training age and recovery that the app does not know. */
function wsAdaptReadout(d){
  if(!d||!d.totalSets) return null;
  const b=d.bands, tot=d.totalSets;
  const pct=k=>Math.round((b[k]/tot)*100);
  const parts=WS_ADAPT_BANDS.map(x=>pct(x.key)+'% '+x.label.toLowerCase());
  const top=WS_ADAPT_BANDS.slice().sort((x,y)=>b[y.key]-b[x.key])[0];
  const missing=WS_ADAPT_BANDS.filter(x=>b[x.key]===0);
  let tail='';
  if(missing.length===1) tail=' No '+missing[0].label.toLowerCase()+' work logged in this window.';
  else if(missing.length===2) tail=' Everything sat in the '+top.label.toLowerCase()+' band.';
  return {text:parts.join(' · ')+'.'+tail, top:top.key};
}

function wsAdaptBarHtml(m,max){
  const seg=WS_ADAPT_BANDS.map(b=>{
    const v=m[b.key]; if(!v) return '';
    return '<span class="wsad-seg" style="flex:'+v+';background:'+b.color+'" title="'+b.label+': '+v+'"></span>';
  }).join('');
  const w=max>0?Math.max(6,Math.round((m.total/max)*100)):0;
  return '<div class="wsad-row">'
    +'<span class="wsad-m">'+hiEscape(m.name)+'</span>'
    +'<span class="wsad-bw" style="width:'+w+'%">'+seg+'</span>'
    +'<span class="wsad-n">'+(Math.round(m.total*10)/10)+'</span>'
  +'</div>';
}

function wsRenderAdaptation(){
  // v55: same window as the period picked at the top of Progress
  const d=wsAdaptBuckets(wsTrendWeeksFor(typeof wsProgFrame!=='undefined'?wsProgFrame:'8W'));
  if(!d||!d.totalSets) return '';
  const ro=wsAdaptReadout(d);
  const max=d.muscles.length?d.muscles[0].total:0;
  const legend=WS_ADAPT_BANDS.map(b=>
    '<span class="wsad-lg"><i style="background:'+b.color+'"></i>'+b.label
    +'<em>'+b.sub+'</em></span>').join('');
  const bars=d.muscles.slice(0,12).map(m=>wsAdaptBarHtml(m,max)).join('');
  return '<div class="wsad">'
    +'<div class="wsad-h">Adaptation mix</div>'
    +'<div class="wsad-s">Working sets by rep range · '+wsTrendFrameCaption(d.weeks)+'</div>'
    + (ro?'<div class="wsad-read">'+ro.text+'</div>':'')
    +'<div class="wsad-legend">'+legend+'</div>'
    +'<div class="wsad-bars">'+bars+'</div>'
    +'<div class="wsad-n2">Prime movers count as a full set, assisting muscles as a half — otherwise one bench set would read as three sets of work.'
      + (d.conditioning?' '+d.conditioning+' conditioning entries are tracked separately and not shown here.':'')
      + (d.unmatched?' '+d.unmatched+' entries had no library match and were counted as assisting only.':'')
    +'</div>'
  +'</div>';
}
