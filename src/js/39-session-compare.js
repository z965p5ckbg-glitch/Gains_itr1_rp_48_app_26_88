

/* v49: the acute:chronic ratio returns, but at the BOTTOM of Progress rather
   than as the headline. It is a workload-spike screen borrowed from team-sport
   injury monitoring — useful as a "have I ramped too fast" check, wrong as the
   first thing a lifter sees about their training. It is labelled as what it is
   and it says out loud that it is descriptive. */

/* ════════════════════════════════════════════════════════════════════════════
   v50 — LIKE-FOR-LIKE SESSION COMPARISON
   ────────────────────────────────────────────────────────────────────────────
   Answers a different question from the trend panels: not "where am I heading"
   but "was this session better than the last one like it".

   WHY NOT MATCH ON THE DAY LABEL, WHICH IS THE OBVIOUS ANSWER
   Measured on real history (48 sessions): 43 have a prior session with the same
   label, so label matching looks fine — until you notice 13 of those sessions
   are ALL labelled "Mixed session". Matching by name would compare a leg+push
   day against an arm+core day and call it like-for-like. Label also breaks
   whenever the plan is edited: "Day 1" in April and "Day 1" in August shared
   almost no exercises after the slot rewrites.

   SO MATCH ON CONTENT
   overlap(S,C) = share of S's working sets that fall on exercises C also has.
   Best-scoring earlier session wins; a matching day label only breaks ties.
   Measured median best-overlap across his history: 1.00.

   AND COMPARE ONLY THE SHARED PART
   A session that added two accessories is not "more volume" in a way that
   means anything — that is the same composition trap the Load panel fell into.
   Every number below is computed over the exercises BOTH sessions contain, and
   the card states how many that was.
   ════════════════════════════════════════════════════════════════════════════ */

const WS_CMP_MIN_OVERLAP = 0.4;   // below this, decline rather than mislead

function wsSessionSig(rec){
  const byEx=Object.create(null); let totalSets=0;
  for(const e of (rec&&rec.entries||[])){
    if(e.kind!=='weighted' && e.kind!=='bodyweight') continue;
    const k=wsTrendExKey(e);
    let sets=0, loadSum=0, loadN=0, vol=0, top=0;
    for(const s of (e.sets||[])){
      if(s.completed===false || s.warmup) continue;
      const load=(typeof s.weightKg==='number') ? s.weightKg
               : ((s.bodyweightKg||0)+(s.offsetKg||0));
      const reps=(typeof s.reps==='number')?s.reps:0;
      sets++; vol+=Math.max(0,load)*reps;
      if(load>0){ loadSum+=load; loadN++; if(load>top) top=load; }
    }
    if(!sets) continue;
    const slot=byEx[k]||(byEx[k]={name:e.name||'—',sets:0,vol:0,loadSum:0,loadN:0,top:0});
    slot.sets+=sets; slot.vol+=vol; slot.loadSum+=loadSum; slot.loadN+=loadN;
    if(top>slot.top) slot.top=top;
    totalSets+=sets;
  }
  return {byEx,totalSets};
}

function wsFindComparable(rec){
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const t=new Date(rec&&rec.date).getTime();
  if(isNaN(t)) return null;
  const a=wsSessionSig(rec);
  if(!a.totalSets) return null;
  const aKeys=Object.keys(a.byEx);
  let best=null;
  for(const c of hist){
    if(!c || c.id===rec.id) continue;
    const ct=new Date(c.date).getTime();
    if(isNaN(ct) || ct>=t) continue;                 // strictly earlier
    const b=wsSessionSig(c);
    if(!b.totalSets) continue;
    let shared=0, sharedKeys=[];
    for(const k of aKeys){ if(b.byEx[k]){ shared+=a.byEx[k].sets; sharedKeys.push(k); } }
    if(!shared) continue;
    const overlap=shared/a.totalSets;
    const sameLabel = !!(rec.dayLabel && c.dayLabel && rec.dayLabel===c.dayLabel
                         && rec.dayLabel!=='Mixed session');
    // overlap decides; a matching label only separates near-ties, and never for
    // "Mixed session", which is a placeholder rather than a real identity
    const score = overlap + (sameLabel?0.001:0) + (ct/1e15);
    if(!best || score>best.score) best={rec:c,overlap:overlap,sharedKeys:sharedKeys,score:score,sameLabel:sameLabel,sig:b};
  }
  if(!best || best.overlap<WS_CMP_MIN_OVERLAP) return null;
  return {match:best.rec, overlap:best.overlap, sharedKeys:best.sharedKeys,
          basis: best.sameLabel?'same day':'similar session', sigA:a, sigB:best.sig};
}

function wsCompareSessions(rec){
  const f=wsFindComparable(rec);
  if(!f) return null;
  const A=f.sigA.byEx, B=f.sigB.byEx;
  let setsA=0,setsB=0,volA=0,volB=0,num=0,den=0;
  const lifts=[];
  for(const k of f.sharedKeys){
    const a=A[k], b=B[k];
    setsA+=a.sets; setsB+=b.sets; volA+=a.vol; volB+=b.vol;
    const la=a.loadN?a.loadSum/a.loadN:0, lb=b.loadN?b.loadSum/b.loadN:0;
    if(lb>0){ num+=a.sets*(la/lb); den+=a.sets; }
    lifts.push({ name:a.name, loadNow:Math.round(la*10)/10, loadThen:Math.round(lb*10)/10,
                 setsNow:a.sets, setsThen:b.sets,
                 d: lb>0 ? Math.round(((la-lb)/lb)*1000)/10 : null });
  }
  lifts.sort((x,y)=>Math.abs((y.d||0))-Math.abs((x.d||0)));
  const loadPct = den ? Math.round(((num/den)-1)*1000)/10 : null;
  const volPct  = volB ? Math.round(((volA-volB)/volB)*1000)/10 : null;
  const ea=wsSessionEffort(rec), eb=wsSessionEffort(f.match);
  return {
    when:f.match.date, label:f.match.dayLabel||'', basis:f.basis,
    sharedCount:f.sharedKeys.length,
    totalNow:Object.keys(A).length, totalThen:Object.keys(B).length,
    loadPct, volPct, setsNow:setsA, setsThen:setsB,
    volNow:Math.round(volA), volThen:Math.round(volB),
    effortNow: ea?ea.value:null, effortThen: eb?eb.value:null,
    effortNowEst: !!(ea&&ea.source==='estimated'), effortThenEst: !!(eb&&eb.source==='estimated'),
    lifts:lifts
  };
}

function wsCmpArrow(d,inv){
  if(d==null) return '<span class="wscmp-d flat">—</span>';
  const cls=Math.abs(d)<1.5?'flat':(d>0?(inv?'dn':'up'):(inv?'up':'dn'));
  return '<span class="wscmp-d '+cls+'">'+(d>0?'+':'')+d+'%</span>';
}

function wsCompareCardHtml(rec){
  const c=wsCompareSessions(rec);
  if(!c) return '<div class="wscmp wscmp-none">No comparable earlier session yet — this one becomes the baseline.</div>';
  const d=new Date(c.when);
  const when=d.toLocaleDateString(undefined,{day:'numeric',month:'short'});
  const setsD=c.setsNow-c.setsThen;
  const effLine = (c.effortNow!=null && c.effortThen!=null)
    ? '<div class="wscmp-r"><span class="wscmp-l">Effort</span>'
      +'<span class="wscmp-v">'+c.effortThen+(c.effortThenEst?'*':'')+' → '+c.effortNow+(c.effortNowEst?'*':'')+'</span>'
      + wsCmpArrow(c.effortThen?Math.round(((c.effortNow-c.effortThen)/c.effortThen)*1000)/10:null,true)+'</div>'
    : '';
  const top=c.lifts.slice(0,4).map(l=>
      '<div class="wscmp-lift"><span class="wscmp-ln">'+hiEscape(l.name)+'</span>'
      +'<span class="wscmp-lv">'+(l.loadThen||'—')+' → '+(l.loadNow||'—')+' kg</span>'
      + wsCmpArrow(l.d)+'</div>').join('');
  return '<div class="wscmp">'
    +'<div class="wscmp-h">vs '+when+(c.label?' · '+hiEscape(c.label):'')+'</div>'
    +'<div class="wscmp-basis">'+c.sharedCount+' of '+c.totalNow+' lifts in common · matched on '+c.basis+'</div>'
    +'<div class="wscmp-rows">'
      +'<div class="wscmp-r"><span class="wscmp-l">Load</span><span class="wscmp-v">same lifts</span>'+wsCmpArrow(c.loadPct)+'</div>'
      +'<div class="wscmp-r"><span class="wscmp-l">Sets</span><span class="wscmp-v">'+c.setsThen+' → '+c.setsNow+'</span>'
        +'<span class="wscmp-d '+(setsD>0?'up':(setsD<0?'dn':'flat'))+'">'+(setsD>0?'+':'')+setsD+'</span></div>'
      +'<div class="wscmp-r"><span class="wscmp-l">Volume</span><span class="wscmp-v">'
        +wsTrendFmtVol(c.volThen)+' → '+wsTrendFmtVol(c.volNow)+' kg</span>'+wsCmpArrow(c.volPct)+'</div>'
      + effLine
    +'</div>'
    +'<div class="wscmp-lifts">'+top+'</div>'
    +(c.effortNowEst||c.effortThenEst?'<div class="wscmp-n">* estimated effort</div>':'')
    +'<div class="wscmp-n">Only the lifts both sessions contain are counted, so adding or dropping an exercise cannot move these numbers.</div>'
  +'</div>';
}
