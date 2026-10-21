
/* ═══ 1RM CAPTURE ═══
   Two honest states: "your max" (user-given via slider-confirm — tested or
   estimated, we don't ask which) and "estimated" (Epley over qualifying sets:
   ≤10 reps, last 5 weeks, max estimate wins). User max is fresh ~12 weeks;
   past that a fresh estimate is preferred, else the max shows its age.
   Bodyweight exercises are excluded for now (measurement-type framework
   handles them in the enriched-library build). */
const WS_1RM_EST_WINDOW_MS = 5*7*24*3600*1000;
const WS_1RM_USER_FRESH_MS = 12*7*24*3600*1000;
function wsMaxKey(name){ return String(name||'').trim().toLowerCase(); }
function wsEpley(w,reps){
  if(!(w>0)||!(reps>0)||reps>10) return null;
  return w*(1+reps/30);
}
function wsEst1RM(name){
  const key=wsMaxKey(name); if(!key) return null;
  let best=null;
  const cutoff=Date.now()-WS_1RM_EST_WINDOW_MS;
  // Recent history: real recorded sets.
  try{
    for(const rec of (HISTORY||[])){
      if(!(new Date(rec.date).getTime()>=cutoff)) continue;
      for(const e of (rec.entries||[])){
        if(e.kind!=='weighted') continue;
        if(wsMaxKey(e.name)!==key) continue;
        for(const st of (e.sets||[])){
          if(st.completed===false) continue;
          const v=wsEpley(st.weightKg, st.reps);
          if(v!=null && (best==null||v>best)) best=v;
        }
      }
    }
  }catch(_){}
  // Today's logged sets (not yet in history).
  try{
    for(const d of (DAYS||[])){
      for(const ex of (d.items||[])){
        if(wsEffortKind(ex)!=='strength' || ex._bodyweight) continue;
        if(wsMaxKey(ex.name)!==key) continue;
        for(const st of (ex.sets||[])){
          if(!st._logged) continue;
          const v=wsEpley(st.w, st.r);
          if(v!=null && (best==null||v>best)) best=v;
        }
      }
    }
  }catch(_){}
  return best!=null ? Math.round(best) : null;
}
function ws1rmResolve(name){
  // fresh user max > calculated estimate > aged user max > null
  const m=wsMaxes[wsMaxKey(name)];
  const est=wsEst1RM(name);
  if(m && typeof m.kg==='number' && m.kg>0){
    const age=Date.now()-(m.setAt||0);
    if(age<=WS_1RM_USER_FRESH_MS) return {kg:m.kg, src:'user', est:est};
    if(est!=null) return {kg:est, src:'est', est:est};
    return {kg:m.kg, src:'user', agedWeeks:Math.floor(age/(7*24*3600*1000)), est:est};
  }
  if(est!=null) return {kg:est, src:'est', est:est};
  return null;
}
function ws1rmFmt(v){ const r=Math.round(v*2)/2; return (r%1===0)?String(r):r.toFixed(1); }
function ws1rmChip(ex,ei){
  try{
    if(wsEffortKind(ex)!=='strength' || ex._bodyweight) return '';
    const r=ws1rmResolve(ex.name);
    if(!r) return '';
    const label = r.src==='user'
      ? (r.agedWeeks ? `max · ${r.agedWeeks}w old` : 'your max')
      : 'est. 1RM';
    return `<span class="ws-rm-mini" onclick="event.stopPropagation();ws1rmOpen(${ei})">${label} <b>${ws1rmFmt(r.kg)} kg</b></span>`;
  }catch(_){ return ''; }
}
function ws1rmPanel(ex,ei){
  const r=ws1rmResolve(ex.name);
  const cur=(typeof ex._rmPending==='number') ? ex._rmPending : (r ? r.kg : 60);
  const est=r && r.est!=null ? r.est : null;
  // Slider: whole-kg steps, range from 0 up to at least 250 so very heavy
  // lifts (leg press 200+) are reachable by drag; steppers fine-tune by 0.5
  // and extend the bounds if walked past them.
  const lo=0;
  const hi=Math.max(250, Math.ceil((cur*1.5+30)/10)*10);
  const srcLine = est!=null
    ? `app estimates ${ws1rmFmt(est)} kg from your sets`
    : `no estimate yet — needs a set under about 10 reps`;
  // Sanity interruption: value way above the derived estimate (>40%) —
  // likely a typo or a lbs/kg mixup, but maybe a monster lift. Ask once.
  let warn='';
  if(ex._rmSanity){
    const v=ex._rmSanity.val;
    const isLow=ex._rmSanity.dir==='low';
    const pct=Math.abs(Math.round((v/est-1)*100));
    const msg = isLow
      ? `<b>That's below your own sets</b> — they suggest around ${ws1rmFmt(est)} kg, about ${pct}% more. Modest, or a slip of the thumb? If it's right, confirm away.`
      : `<b>That's a big jump</b> — about ${pct}% above what your sets suggest (${ws1rmFmt(est)} kg). Monster lift, or a slip of the thumb? If it's real, confirm away — we'll cheer either way.`;
    warn=`<div class="ws-rm-warn">${msg}</div>
    <div class="ws-rm-actions">
      <div class="ws-rm-cancel" onclick="event.stopPropagation();ws1rmSanityAdjust(${ei})">Let me adjust</div>
      <div class="ws-rm-confirm" onclick="event.stopPropagation();ws1rmConfirm(${ei},true)">Confirm · ${ws1rmFmt(v)} kg</div>
    </div>`;
  }
  const actions = ex._rmSanity ? '' : `<div class="ws-rm-actions">
      <div class="ws-rm-cancel" onclick="event.stopPropagation();ws1rmCancel(${ei})">Cancel</div>
      <div class="ws-rm-confirm" id="wsRmConfirm-${ei}" onclick="event.stopPropagation();ws1rmConfirm(${ei})">Confirm max · ${ws1rmFmt(cur)} kg</div>
    </div>`;
  return `<div class="ws-rm-panel">
    <div class="ws-rm-q">Your max for this lift</div>
    <div class="ws-rm-sub">The most you could lift once. Tested or your best estimate — either works, consistency is what matters.</div>
    <div class="ws-rm-readout"><span class="num" id="wsRmNum-${ei}">${ws1rmFmt(cur)}</span><span class="unit">kg</span><div class="src">${srcLine}</div></div>
    <input type="range" class="ws-rm-range" id="wsRmRange-${ei}" min="${lo}" max="${hi}" step="1" value="${cur}" oninput="ws1rmSlide(${ei},this.value)">
    <div class="ws-rm-steppers">
      <div class="ws-rm-step" onclick="event.stopPropagation();ws1rmStep(${ei},-0.5)">−</div>
      <span class="ws-rm-step-lbl">0.5 kg</span>
      <div class="ws-rm-step" onclick="event.stopPropagation();ws1rmStep(${ei},0.5)">+</div>
    </div>
    ${actions}${warn}
  </div>`;
}
// Slider/steppers update the DOM in place — re-rendering mid-drag would
// destroy the range input under the user's finger.
function ws1rmSync(ei,val){
  const n=document.getElementById('wsRmNum-'+ei); if(n) n.textContent=ws1rmFmt(val);
  const c=document.getElementById('wsRmConfirm-'+ei); if(c) c.textContent='Confirm max · '+ws1rmFmt(val)+' kg';
}
function ws1rmOpen(ei){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  ex._rmOpen=true; ex._rmPending=null; delete ex._rmSanity;
  // close the RPE panel if open — one panel at a time keeps the card calm
  ex._rpeOpen=false; ex._rpeInfo=false;
  renderAll(false);
}
function ws1rmCancel(ei){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  ex._rmOpen=false; ex._rmPending=null; delete ex._rmSanity;
  renderAll(false);
}
function ws1rmSanityAdjust(ei){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  delete ex._rmSanity; // back to the editor, value kept, no commitment
  renderAll(false);
}
function ws1rmSlide(ei,v){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  const val=Math.round(parseFloat(v));
  if(!(val>=0)) return;
  ex._rmPending=val;
  delete ex._rmSanity; // value changed — any pending sanity question is moot
  ws1rmSync(ei,val);
}
function ws1rmStep(ei,d){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  const r=ws1rmResolve(ex.name);
  const cur=(typeof ex._rmPending==='number') ? ex._rmPending : (r ? r.kg : 60);
  const val=Math.max(0, Math.round((cur+d)*2)/2);
  ex._rmPending=val;
  delete ex._rmSanity;
  const rng=document.getElementById('wsRmRange-'+ei);
  if(rng){
    if(val<parseFloat(rng.min)) rng.min=val;
    if(val>parseFloat(rng.max)) rng.max=val;
    rng.value=val;
  }
  ws1rmSync(ei,val);
}
function ws1rmConfirm(ei,force){
  const ex=DAYS[curDay].items[ei]; if(!ex) return;
  const r=ws1rmResolve(ex.name);
  const val=(typeof ex._rmPending==='number') ? ex._rmPending : (r ? r.kg : null);
  if(val==null || !(val>0)){ ws1rmCancel(ei); return; }
  // Sanity check: >40% above the derived estimate is usually a typo or a
  // lbs/kg mixup — but honest headroom exists for far-from-failure trainers,
  // so we ask once rather than block. No estimate → nothing to compare → no
  // interruption.
  const est=r && r.est!=null ? r.est : null;
  if(!force && est!=null && val > est*1.4){
    ex._rmSanity={ val:val, dir:'high' };
    renderAll(false);
    return;
  }
  // Low side is the physically contradictory one: your sets already imply a
  // floor — a max meaningfully below it is almost certainly a slip.
  if(!force && est!=null && val < est*0.8){
    ex._rmSanity={ val:val, dir:'low' };
    renderAll(false);
    return;
  }
  delete ex._rmSanity;
  wsMaxes[wsMaxKey(ex.name)]={ kg:Math.round(val*2)/2, setAt:Date.now() };
  ex._rmOpen=false; ex._rmPending=null;
  wsLogPush('1rm_set',{kg:val});
  try{ if(navigator.vibrate) navigator.vibrate(8); }catch(_){}
  renderAll(false);
  wsPersistFlush();
}
