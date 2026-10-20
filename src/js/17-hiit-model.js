
// ── HIIT helpers ──
function getHiitSegments(ex){
  // Always reads from live ex — display follows user edits immediately.
  // The running engine snapshots its OWN segment list at start, so edits don't disrupt
  // a running circuit; but the display reflects what's currently set.
  const segs=[];
  if(ex.simpleMode!==false){
    const total=Math.max(1,ex.totalRounds||1);
    for(let i=0;i<total;i++){
      segs.push({type:'work',label:'Work',duration:ex.workSec,roundIdx:i});
      if(i<total-1&&ex.restSec>0) segs.push({type:'rest',label:'Rest',duration:ex.restSec,roundIdx:i});
    }
  } else if(ex.amrap && (ex.capMin||0)>0){
    // AMRAP: loop stations until the cap; segments prebuilt, last one truncated at the cap.
    const stations=ex.roundsCustom||[];
    if(!stations.length) return segs;
    const capSec=Math.round(ex.capMin*60);
    let t=0,r=0,stop=false;
    while(!stop && t<capSec && r<500){
      for(let si=0;si<stations.length && !stop;si++){
        const st=stations[si];
        let w=Math.max(1,st.work||30); if(t+w>capSec) w=capSec-t;
        if(w<=0){stop=true;break;}
        segs.push(Object.assign({type:'work',label:st.name||`Station ${si+1}`,duration:w,roundIdx:r,stIdx:si},st.exId?{exId:st.exId}:{}));
        t+=w; if(t>=capSec){stop=true;break;}
        const isLast=si===stations.length-1;
        const isRB=isLast&&(ex.roundRest||0)>0;
        let rest=isLast?((ex.roundRest||0)>0?ex.roundRest:(st.rest||0)):(st.rest||0);
        if(rest>0){
          if(t+rest>capSec) rest=capSec-t;
          if(rest<=0){stop=true;break;}
          segs.push(Object.assign({type:'rest',label:isRB?'Round break':'Rest',duration:rest,roundIdx:r,stIdx:si},isRB?{roundRest:true}:{}));
          t+=rest; if(t>=capSec){stop=true;break;}
        }
      }
      r++;
    }
  } else {
    // Custom circuit: STATIONS × ROUNDS. Rests sit between stations (none after the
    // last station of a round); rounds are separated by a Round break (ex.roundRest),
    // falling back to the last station's rest when roundRest is 0.
    const stations=ex.roundsCustom||[];
    const R=Math.max(1,ex.totalRounds||1);
    if(stations.length){
      for(let r=0;r<R;r++){
        stations.forEach((st,si)=>{
          segs.push(Object.assign({type:'work',label:st.name||`Station ${si+1}`,duration:st.work||30,roundIdx:r,stIdx:si},st.exId?{exId:st.exId}:{}));
          if(si<stations.length-1 && st.rest>0) segs.push({type:'rest',label:'Rest',duration:st.rest,roundIdx:r,stIdx:si});
        });
        if(r<R-1){
          if((ex.roundRest||0)>0) segs.push({type:'rest',label:'Round break',duration:ex.roundRest,roundIdx:r,roundRest:true});
          else { const last=stations[stations.length-1]; if(last&&last.rest>0) segs.push({type:'rest',label:'Rest',duration:last.rest,roundIdx:r,stIdx:stations.length-1}); }
        }
      }
    }
  }
  return segs;
}

function getHiitTotalRounds(ex){
  if(ex.simpleMode!==false) return ex.totalRounds||1;
  if(ex.amrap && (ex.capMin||0)>0){ const s=getHiitSegments(ex); return s.length?(s[s.length-1].roundIdx+1):1; }
  return Math.max(1,ex.totalRounds||1);
}

// ════════ Circuit auto-naming (locked spec; "Punchy" removed per user) ════════
// "<Adjective> <Noun>" — adjective from intensity tier (work:rest, volume-gated),
// noun from the lead movement (substring-matched on free-text station names) or a
// neutral word. Deterministic per circuit (hashed) so a given circuit names stably.
const WS_ADJ={
  easy:['Steady','Base','Even','Ground','Clean','Early','Light'],
  mid:['Solid','Working','Sharp','Honest','Field','Stone','March'],
  hard:['Hard','Heavy','Iron','Grit','Long','Stark','Raw','Flint'],
  brutal:['Grim','Punishing','Relentless','Granite','Cold','Last'],
};
const WS_NEUTRAL=['Engine','Grind','Circuit','Gauntlet','Forge','Burner','Shift','Ladder','Block'];
const WS_HOT_NEUTRALS=['Forge','Burner'];
const WS_SOFT_ADJS=['Base','Even','Clean','Early','Light','Ground'];
// ordered most-specific first so "push press"→Press beats "press", "jump rope"→Rope beats "jump"
const WS_MOVE_NOUNS=[['push press','Press'],['jump rope','Rope'],['box jump','Jump'],['wall ball','Ball'],
  ['mountain climber','Climber'],['kettlebell swing','Swing'],['goblet squat','Squat'],['back squat','Squat'],
  ['push-up','Push'],['pushup','Push'],['pull-up','Pull'],['pullup','Pull'],['sit-up','Core'],['situp','Core'],
  ['burpee','Burpee'],['thruster','Thruster'],['snatch','Snatch'],['clean','Clean'],['swing','Swing'],
  ['squat','Squat'],['climber','Climber'],['lunge','Lunge'],['plank','Core'],['row','Row'],['press','Press'],
  ['rope','Rope'],['jump','Jump'],['ball','Ball'],['pull','Pull'],['push','Push']];
function wsHashStr(str){let h=0;for(let i=0;i<str.length;i++){h=(h*31+str.charCodeAt(i))>>>0;}return h;}
function wsTierFor(totalWork,totalRest,rounds){
  if(totalRest<=0)totalRest=0.0001;
  const r=totalWork/totalRest;
  let t=r<0.9?'easy':r<1.5?'mid':r<2.5?'hard':'brutal';
  if(totalWork<180&&(t==='hard'||t==='brutal'))t='mid';
  if(totalWork<90)t='easy';
  if(t==='brutal'&&(totalWork<360||rounds<5))t='hard';
  if(t==='hard'&&totalWork>=720&&rounds>=8)t='brutal';
  return t;
}
function wsCircuitStations(ex){
  if(ex.simpleMode!==false) return [{name:ex.name||'',work:ex.workSec||30,rest:ex.restSec||0}];
  return (ex.roundsCustom||[]).map(r=>({name:r.name||'',work:r.work||30,rest:r.rest||0}));
}
function wsCircuitRounds(ex){ return Math.max(1,ex.totalRounds||1); }
function wsNounFor(name){const s=(name||'').toLowerCase();for(const kv of WS_MOVE_NOUNS){if(s.includes(kv[0]))return kv[1];}return null;}
function wsDominantNoun(stations){
  const names=stations.map(s=>s.name||'');
  const cnt={};names.forEach(n=>cnt[n]=(cnt[n]||0)+1);
  const lead=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  if(stations.length===1||lead[1]>1||new Set(names).size<=2){
    const n=wsNounFor(lead[0]);if(n)return {noun:n,src:'movement'};
  }
  if(stations.length<=3){
    const byWork=[...stations].sort((a,b)=>(b.work||0)-(a.work||0));
    const n=wsNounFor(byWork[0].name);if(n)return {noun:n,src:'movement'};
  }
  return {noun:null,src:'neutral'};
}
function wsCircuitAutoName(ex){
  const stations=wsCircuitStations(ex);
  const rounds=ex.amrap?6:wsCircuitRounds(ex);
  const perWork=stations.reduce((a,s)=>a+(s.work||0),0);
  const perRest=stations.reduce((a,s)=>a+(s.rest||0),0);
  const totalWork=perWork*rounds;
  const totalRest=perRest*rounds+(ex.roundRest||0)*Math.max(0,rounds-1);
  const tier=wsTierFor(totalWork,totalRest,rounds);
  const id=String(ex._iid||ex.name||stations.map(s=>s.name).join('|'));
  const h=wsHashStr(id+tier);
  let adj=WS_ADJ[tier][h%WS_ADJ[tier].length];
  const nn=wsDominantNoun(stations);
  let noun=nn.noun;
  if(!noun){let pool=WS_NEUTRAL.slice();if(tier==='easy'||tier==='mid')pool=pool.filter(n=>!WS_HOT_NEUTRALS.includes(n));noun=pool[(h>>>3)%pool.length];}
  if(WS_SOFT_ADJS.includes(adj)&&nn.src!=='movement'){const alt=WS_ADJ[tier].filter(a=>!WS_SOFT_ADJS.includes(a));adj=alt[h%alt.length];}
  return adj+' '+noun;
}
// Use the explicit name when set; otherwise the smart default. (Seeds keep their names.)
function wsCircuitName(ex){ return (ex.name&&String(ex.name).trim())?ex.name:wsCircuitAutoName(ex); }

// The running engine keeps its OWN segment list, captured at start. This is what the
// timer ticks through. Edits to ex.* don't disrupt the running run.
function snapshotHiitConfig(ex){
  ex._engineSegs = getHiitSegments(ex);
  ex._engineTotalRounds = getHiitTotalRounds(ex);
}
function clearHiitSnapshot(ex){
  delete ex._engineSegs;
  delete ex._engineTotalRounds;
}

function fireRimCue(phase){
  // phase: undefined/'work' = amber, 'rest' = sage, 'setup' = lilac, 'complete' = sage-bright
  if(!settings.rim) return;
  const el=document.getElementById('rimCue');
  el.classList.remove('rest','setup','complete');
  el.classList.add('active');
  if(phase==='rest') el.classList.add('rest');
  else if(phase==='setup') el.classList.add('setup');
  else if(phase==='complete') el.classList.add('complete');
  // 4 pulses at .9s each = 3.6s
  setTimeout(()=>{el.classList.remove('active','rest','setup','complete');},3600);
}
