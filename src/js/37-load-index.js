

/* ════════════════════════════════════════════════════════════════════════════
   v49 — LOAD INDEX: fixing a composition effect that reversed the truth
   ────────────────────────────────────────────────────────────────────────────
   v48's Load panel averaged kilograms-per-set across every exercise in a week.
   That is a mean over a heterogeneous population, so it moves when the MIX of
   exercises changes, even if no lift changed at all.

   Verified on real data. Week of 3 Aug vs 10 Aug:
       RDL            83 -> 86 kg      Hack Squat   75 -> 80 kg
       Toe Press      75 -> 80 kg      DB Sh. Press 16 -> 20 kg
       Dips/Hip Thrust/Leg Raises  unchanged
   Every repeated lift held or rose. Yet the average fell 63.5 -> 53.5 kg (-16%)
   because that week added Lateral Raises (10kg), Single-Leg Lunge (10kg), Back
   Hyperextension (15kg) and Face Pulls (20kg). The panel reported a 16% decline
   in a week of across-the-board progress. That is not a rounding issue, it is
   the metric answering a different question than the one on the label.

   THE FIX — a fixed-basket index, the same correction retail uses for
   same-store sales and statistics agencies use for price indices.
     baseline(e) = load of exercise e in its earliest week inside the window
     index(w)    = Σ over e present in w of  sets(e,w) × load(e,w)/baseline(e)
                   ────────────────────────────────────────────────────────
                                    Σ sets(e,w)
   Each lift is compared ONLY against itself, then set-weighted. Adding curls
   can no longer drag the number down, because curls are measured against curls.

   An exercise only counts once it has a baseline from an EARLIER week —
   otherwise a debut lift self-indexes to exactly 1.0 and flattens the series
   toward no-change. This is the standard new-entrant problem in chain indices.

   Per-exercise view keeps raw kilograms: with one lift there is no mix to bias,
   and kilograms are more legible than an index.
   ════════════════════════════════════════════════════════════════════════════ */

const WS_IDX_MIN_EX = 2;   // fewer comparable lifts than this in a week -> gap

function wsTrendLoadIndex(rows, exKey){
  if(exKey && exKey!=='ALL') return null;          // no mix, no bias, no index
  if(!rows || rows.length<2) return null;

  // per-week, per-exercise load and set count
  const hist=Array.isArray(HISTORY)?HISTORY:[];
  const weekIdx=Object.create(null);
  rows.forEach((r,i)=>weekIdx[r.t]=i);
  const per=rows.map(()=>Object.create(null));     // [weekIndex][exKey] = {sum,n}

  for(const rec of hist){
    const t=new Date(rec.date).getTime(); if(isNaN(t)) continue;
    const wi=weekIdx[wsTrendWeekStart(t)]; if(wi===undefined) continue;
    for(const e of (rec.entries||[])){
      if(e.kind!=='weighted' && e.kind!=='bodyweight') continue;
      const k=wsTrendExKey(e);
      for(const s of (e.sets||[])){
        if(s.completed===false || s.warmup) continue;
        const load=(typeof s.weightKg==='number') ? s.weightKg
                 : ((s.bodyweightKg||0)+(s.offsetKg||0));
        if(!(load>0)) continue;                    // unloaded work carries no load signal
        const slot=per[wi][k]||(per[wi][k]={sum:0,n:0});
        slot.sum+=load; slot.n++;
      }
    }
  }

  // baseline = first week in the window where the lift appears
  const base=Object.create(null);
  per.forEach((wk,wi)=>{
    for(const k in wk){
      if(base[k]===undefined) base[k]={w:wi, load:wk[k].sum/wk[k].n};
    }
  });

  return rows.map((r,wi)=>{
    let num=0, den=0, used=0;
    for(const k in per[wi]){
      const b=base[k];
      if(!b || b.w>=wi) continue;                  // needs an earlier baseline
      if(!(b.load>0)) continue;
      const load=per[wi][k].sum/per[wi][k].n;
      const n=per[wi][k].n;
      num += n*(load/b.load); den += n; used++;
    }
    if(used<WS_IDX_MIN_EX || den===0) return null; // honest gap, never a guess
    return Math.round((num/den)*1000)/10;          // percent of baseline
  });
}
