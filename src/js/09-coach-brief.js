
// ── PACKET I TIER 1 — COACH BRIEF ─────────────────────────────────────
// Exports a plain-text picture of your training that you paste into whichever
// AI you already pay for. Deliberately NO API key, NO network call, no account:
// there is no credential to steal, rotate or leak, and it works with any model.
// The preview sheet is mandatory — this contains personal data and you see
// exactly what leaves before it leaves.
const WS_BRIEF_MAX_EX = 12;   // token discipline; uncapped briefs balloon

function wsBriefAsk(){
  try{ return (settings && settings.coachAsk) || ''; }catch(_){ return ''; }
}
function wsCoachBrief(customAsk){
  const NL=String.fromCharCode(10);
  const frame = (typeof wsProgFrame!=='undefined' && wsProgFrame) ? wsProgFrame : '8W';
  const B = wsProgBuild(frame);
  const cutoff = wsProgCutoff(frame);
  const hist = (Array.isArray(HISTORY)?HISTORY:[]).filter(r=>{
    const t=new Date(r.date).getTime(); return !isNaN(t) && t>=cutoff;
  });
  let sets=0; const dayset={};
  hist.forEach(r=>{
    (r.entries||[]).forEach(e=>{ sets += (e.sets||[]).filter(st=>st.completed!==false).length; });
    dayset[(r.date||'').slice(0,10)]=1;
  });
  let prCount=0; B.list.forEach(x=>{ (x.all||[]).forEach(p=>{ if(p.pr && p.t>=cutoff) prCount++; }); });

  const L=[];
  L.push('# TRAINING BRIEF — Gains app export');
  L.push('');
  L.push('## How to read this');
  L.push('- "e1RM" is an Epley estimate from top sets. It is an ESTIMATE, never a tested max.');
  L.push('- "sets" means working sets I logged. Proximity to failure is NOT verified unless an RPE is shown.');
  L.push('- The sets-this-week line compares the last 7 days against the 28-day weekly average. It is descriptive, not a diagnosis.');
  L.push('- Pace is lower-is-better. Muscle growth zone is taken as 10-20 hard sets per week.');
  L.push('- Bodyweight-movement load is not measured; reps are the honest metric there.');
  L.push('');

  // Profile (Packet J). Absent for now — say so rather than inventing context.
  const prof=wsProfile(); const bw=wsBodyLatest(); const age=wsProfileAge();
  const anyProf = !!(age||prof.sex||prof.goal||prof.trainingAge||bw||prof.limits);
  L.push('## Who I am');
  if(anyProf){
    if(age) L.push('- Age: '+age);
    if(prof.sex && prof.sex!=='na') L.push('- Sex: '+(prof.sex==='m'?'male':(prof.sex==='f'?'female':prof.sex)));
    if(prof.heightCm) L.push('- Height: '+prof.heightCm+' cm');
    if(bw){
      const a7=wsBodyAvg(7);
      L.push('- Bodyweight: '+bw.kg+' kg (logged '+bw.d+')'+(a7!=null&&a7!==bw.kg?' · 7-day average '+a7+' kg':''));
      const tr=wsBodyTrend();
      if(tr) L.push('  - 7-day average vs the previous three weeks: '+(tr.delta>0?'+':'')+tr.delta+' kg. Stated as fact only — I log no diet, and you should not infer one.');
    }
    if(prof.trainingAge) L.push('- Training age: '+prof.trainingAge);
    if(prof.goal) L.push('- Main goal: '+prof.goal);
    if(prof.equipment) L.push('- Equipment available: '+prof.equipment);
    if(prof.limits) L.push('- Limits / injuries / no-go movements: '+prof.limits);
    const missing=[];
    if(!age) missing.push('age'); if(!prof.sex||prof.sex==='na') missing.push('sex');
    if(!bw) missing.push('bodyweight'); if(!prof.goal) missing.push('goal');
    if(!prof.equipment) missing.push('equipment'); if(!prof.limits) missing.push('injury history');
    if(missing.length) L.push('- NOT recorded: '+missing.join(', ')+'. Ask rather than assume if it would change your answer.');
  } else {
    L.push('- Nothing recorded yet. Ask me about age, bodyweight, goal, equipment or injury');
    L.push('  history if it would change your answer, rather than assuming.');
  }
  L.push('');
  const rel=wsRelStrength(6);
  if(rel.length){
    L.push('## Relative strength (estimated 1RM per kg of bodyweight)');
    rel.forEach(r=>L.push('- '+r.name+': '+r.ratio+'x bodyweight (best '+r.best+' kg)'));
    L.push('');
  }

  L.push('## This stretch ('+frame+')');
  L.push('- Sessions: '+hist.length+'  ·  working sets: '+sets+'  ·  days trained: '+Object.keys(dayset).length);
  L.push('- New all-time bests in this window: '+prCount);
  try{
    const lt=wsProgLoadTrend(frame);
    if(lt && lt.line) L.push('- '+lt.line.replace(/^Load trend:\s*/,'Load trend: '));
  }catch(_){}
  L.push('');

  const rank = B.list.slice().sort((a,b)=>(b.lastT||0)-(a.lastT||0)).slice(0,WS_BRIEF_MAX_EX);
  L.push('## Exercises (' + rank.length + ' most recently trained' + (B.list.length>rank.length ? ' of '+B.list.length : '') + ')');
  rank.forEach(x=>{
    const bits=[];
    bits.push('current '+(x.headline||'—'));
    if(x.allBest!=null && typeof wsProgFmtVal==='function'){
      try{ bits.push('all-time best '+wsProgFmtVal(x, x.allBest)); }catch(_){}
    }
    bits.push(x.count+' session'+(x.count===1?'':'s'));
    if(x.prEvents) bits.push(x.prEvents+' all-time record'+(x.prEvents===1?'':'s'));
    L.push('- **'+x.name+'** ('+x.kind+') — '+bits.join(' · '));
    if(x.insight) L.push('  - '+x.insight);
  });
  L.push('');

  try{
    const mw=wsProgMuscleWeekly(frame);
    if(mw && mw.length){
      L.push('## Weekly sets by muscle (growth zone 10-20)');
      mw.slice(0,14).forEach(m=>{
        const z = m.perWk<6 ? 'below maintenance' : (m.perWk<10 ? 'maintenance' : (m.perWk<=20 ? 'in zone' : 'above zone'));
        L.push('- '+m.m+': '+m.perWk+'/wk — '+z);
      });
      L.push('');
    }
  }catch(_){}

  // Honesty block — MANDATORY. Conditional on what is actually captured.
  let rpeOn=false;
  try{ rpeOn = !!(settings && settings.showIntensityScore); }catch(_){}
  L.push('## What this data does NOT contain — please do not over-read it');
  L.push(rpeOn
    ? '- RPE is captured per exercise where I entered it, but not per set. Absent RPE means I did not log one, not that the set was easy.'
    : '- NO RPE or proximity-to-failure data at all. A set being logged says nothing about how hard it was.');
  L.push('- NO heart-rate data. Any "easy pace" or Z2 reference is a pace proxy, not a measured zone.');
  L.push('- NO diet, sleep, stress, bodyweight-trend or recovery data.');
  L.push('- Bodyweight-movement load is not measured. Reps are the honest metric there.');
  L.push('- Estimated 1RMs are formula outputs, not tested maxes.');
  L.push('- This is a log, not a supervised assessment. If something here suggests pain or injury, say so plainly and tell me to see a professional.');
  L.push('');

  const ask = (customAsk!=null ? customAsk : wsBriefAsk()) ||
    'Given the above, what would you change in my training over the next 2-4 weeks, and why? Point out anything in the data that looks off or that you would want measured before advising.';
  L.push('## What I am asking');
  L.push(ask);
  return L.join(NL);
}
