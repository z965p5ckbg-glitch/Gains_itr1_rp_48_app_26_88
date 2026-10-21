function exerciseTint(name){
  if(!name) return null;
  let hash=0;
  for(let i=0;i<name.length;i++) hash=((hash<<5)-hash+name.charCodeAt(i))|0;
  const idx=Math.abs(hash)%EXERCISE_TINTS.length;
  const [r,g,b]=EXERCISE_TINTS[idx];
  return {bg:`rgba(${r},${g},${b},0.04)`,border:`rgba(${r},${g},${b},0.16)`};
}

function addSet(ei){
  const ex=DAYS[curDay].items[ei];
  if(ex.deletedSets&&ex.deletedSets.length>0) ex.sets.push(ex.deletedSets.pop());
  else {const last=ex.sets[ex.sets.length-1];ex.sets.push({w:last?last.w:0,r:last?last.r:8,_session:true});}
  // v52: added a set to the model and re-rendered but never persisted, so a
  // set added late in a session was lost on reload unless something else
  // happened to save. Third instance of this pattern (see pickIcon v47,
  // apply-to-all v47).
  wsPersistSave();
  renderAll(false);playKnock();
}
function removeSet(ei){
  const ex=DAYS[curDay].items[ei];if(ex.sets.length<=1) return;
  const removed=ex.sets.pop();if(!ex.deletedSets) ex.deletedSets=[];
  ex.deletedSets.push(removed);renderAll(false);playKnock();
}

function cellTap(ei,si){
  // v53: once logged, captureSessionRecord has frozen a snapshot into HISTORY.
  // Mutating the on-screen day afterwards changed what you SAW without changing
  // what was RECORDED — the screen and the log silently disagreed. Corrections
  // after logging belong in History -> Fix this session, which edits the record.
  if(DAYS[curDay] && DAYS[curDay].logged){
    if(typeof wsToastMsg==='function') wsToastMsg('Already logged — fix it in History');
    return;
  }
  const ex=DAYS[curDay].items[ei];const set=ex.sets[si];
  if(set._logged){set._logged=false;}
  else {
    if(!set.r||set.r===0){let reps=8;for(let i=0;i<ex.sets.length;i++){if(ex.sets[i]._logged&&ex.sets[i].r>0) reps=ex.sets[i].r;}set.r=reps;}
    set._logged=true;playSaveSet(ex);
    const card=document.querySelector(`.ex-card[data-ei="${ei}"]`);
    const checks=card?card.querySelectorAll('.set-check'):null;
    if(checks&&checks[si]){checks[si].classList.add('bounce');setTimeout(()=>checks[si].classList.remove('bounce'),300);}
    ex.rl=ex.rest;ex.rs='idle';
  }
  renderAll(false);
  wsPersistSave();
}

function openCardioEdit(ei,field,fromList){
  // fromList parameter kept for back-compat but ignored; we always resolve
  // via items[] now. The instance carries its own kind via _itemKind.
  const ex=DAYS[curDay].items[ei];
  if(!ex) return;
  cardioEditCtx={ei,field,temp:{},listKey:fromList||'cardio'};
  const body=document.getElementById('cardioEditBody');
  const title=document.getElementById('cardioEditTitle');
  const sub=document.getElementById('cardioEditSub');

  if(field==='intensity'){
    title.textContent='Intensity';sub.textContent='How hard was the effort?';
    cardioEditCtx.temp.value=ex.intensity;
    body.innerHTML=`
      <div class="segmented">
        <div class="seg-opt${ex.intensity==='Low'?' active':''}" id="seg-Low" onclick="setIntensity('Low')">
          <span class="seg-opt-main">Low</span><span class="seg-opt-sub">easy</span>
        </div>
        <div class="seg-opt${ex.intensity==='Mod'?' active':''}" id="seg-Mod" onclick="setIntensity('Mod')">
          <span class="seg-opt-main">Mod</span><span class="seg-opt-sub">moderate</span>
        </div>
        <div class="seg-opt${ex.intensity==='High'?' active':''}" id="seg-High" onclick="setIntensity('High')">
          <span class="seg-opt-main">High</span><span class="seg-opt-sub">hard</span>
        </div>
      </div>`;
  } else if(field==='duration'){
    title.textContent='Duration';sub.textContent='Sensitive under 2 min, then under 60 min, coarser above';
    const total=ex.duration||0;
    cardioEditCtx.temp.totalSec=total;
    cardioEditCtx.temp.preset=SLIDER_ZONES.duration;
    const initPctD=valToPos(total,SLIDER_ZONES.duration)*100;
    const initStepD=getAdaptiveStep(total,SLIDER_ZONES.duration.stepSchedule);
    cardioEditCtx.temp.adaptiveStep=initStepD.step;
    body.innerHTML=`
      <div class="slider-block">
        <div class="slider-display"><span class="sv" id="durDisplay">${fmtMS(total)}</span><span class="su">min : sec</span></div>
        <div class="slider-wrap" id="durWrap">
          <div class="slider-track" id="durTrack">
            <div class="slider-fill" id="durFill" style="width:${initPctD}%"></div>
            ${renderMilestoneTicks(SLIDER_ZONES.duration)}
            <div class="slider-breakpoint" style="left:25%"></div>
            <div class="slider-breakpoint" style="left:70%"></div>
            <div class="slider-handle" id="durHandle" style="left:${initPctD}%"></div>
          </div>
        </div>
        <div class="slider-ticks"><span>0</span><span>2m</span><span>60m</span><span>999m</span></div>
      </div>
      <div class="slider-with-stepper">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--tx3);letter-spacing:.05em;flex:1" id="durFineLbl">FINE-TUNE · ${initStepD.label}</span>
        <div class="stepper-mini">
          <button class="sb-mini" onclick="stepDurSec(-1)">−</button>
          <button class="sb-mini" onclick="stepDurSec(1)">+</button>
        </div>
      </div>`;
    setTimeout(()=>bindSlider('dur','durWrap','durTrack','durFill','durHandle','durDisplay',SLIDER_ZONES.duration,fmtMS,null,'durFineLbl'),50);
  } else if(field==='distance'){
    title.textContent='Distance';
    const isTime=ex.kind==='time';
    sub.textContent=isTime?'Snaps to common values · drag to set':'Snaps to milestones · drag to set';
    const cur=ex.distance!==null?ex.distance:0;
    cardioEditCtx.temp.value=cur;
    cardioEditCtx.temp.preset=isTime?SLIDER_ZONES.distanceM:SLIDER_ZONES.distanceKm;
    // For time-based exercises: stored value is in metres
    // For distance-based exercises: stored value is in kilometres, but display switches m/km at 1km
    const formatValDist=isTime?(v=>String(Math.round(v))):(v=>{
      if(v<1) return String(Math.round(v*1000)); // show as metres
      return v.toFixed(v>=10?1:2); // 12.5 km, but 1.50 km
    });
    const unitGetter=isTime?(v=>'m'):(v=>v<1?'m':'km');
    cardioEditCtx.temp.formatVal=formatValDist;
    cardioEditCtx.temp.unitGetter=unitGetter;
    const initStepDist=getAdaptiveStep(cur,cardioEditCtx.temp.preset.stepSchedule);
    cardioEditCtx.temp.adaptiveStep=initStepDist.step;
    const tickLabels=isTime?'<span>0</span><span>150m</span><span>3km</span><span>20km</span>':'<span>0</span><span>5km</span><span>30km</span><span>999km</span>';
    const initPctDist=valToPos(cur,cardioEditCtx.temp.preset)*100;
    body.innerHTML=`
      <div class="slider-block">
        <div class="slider-display"><span class="sv" id="distDisplay">${formatValDist(cur)}</span><span class="su" id="distUnit">${unitGetter(cur)}</span></div>
        <div class="slider-wrap" id="distWrap">
          <div class="slider-track" id="distTrack">
            <div class="slider-fill" id="distFill" style="width:${initPctDist}%"></div>
            ${renderMilestoneTicks(cardioEditCtx.temp.preset)}
            <div class="slider-breakpoint" style="left:30%"></div>
            <div class="slider-breakpoint" style="left:70%"></div>
            <div class="slider-handle" id="distHandle" style="left:${initPctDist}%"></div>
          </div>
        </div>
        <div class="slider-ticks">${tickLabels}</div>
      </div>
      <div class="slider-with-stepper">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--tx3);letter-spacing:.05em;flex:1" id="distFineLbl">FINE-TUNE · ${initStepDist.label}</span>
        <div class="stepper-mini">
          <button class="sb-mini" onclick="stepDistFine(-1)">−</button>
          <button class="sb-mini" onclick="stepDistFine(1)">+</button>
        </div>
      </div>`;
    setTimeout(()=>{
      // wire unit suffix updates from inside bindSlider
      cardioEditCtx.temp.unitEl=document.getElementById('distUnit');
      bindSlider('dist','distWrap','distTrack','distFill','distHandle','distDisplay',cardioEditCtx.temp.preset,v=>String(v),formatValDist,'distFineLbl');
    },50);
  } else if(field==='activityLimit'){
    title.textContent='Activity time limit';sub.textContent='Snaps to common values · alerts when reached';
    const total=ex.duration||1800;
    cardioEditCtx.temp.value=total;
    cardioEditCtx.temp.totalSec=total;
    cardioEditCtx.temp.preset=SLIDER_ZONES.duration;
    const initPctA=valToPos(total,SLIDER_ZONES.duration)*100;
    const initStepA=getAdaptiveStep(total,SLIDER_ZONES.duration.stepSchedule);
    cardioEditCtx.temp.adaptiveStep=initStepA.step;
    body.innerHTML=`
      <div class="slider-block">
        <div class="slider-display"><span class="sv" id="actDisplay">${fmtMS(total)}</span><span class="su">min : sec</span></div>
        <div class="slider-wrap" id="actWrap">
          <div class="slider-track" id="actTrack">
            <div class="slider-fill" id="actFill" style="width:${initPctA}%"></div>
            ${renderMilestoneTicks(SLIDER_ZONES.duration)}
            <div class="slider-breakpoint" style="left:25%"></div>
            <div class="slider-breakpoint" style="left:70%"></div>
            <div class="slider-handle" id="actHandle" style="left:${initPctA}%"></div>
          </div>
        </div>
        <div class="slider-ticks"><span>0</span><span>2m</span><span>60m</span><span>999m</span></div>
      </div>
      <div class="slider-with-stepper">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--tx3);letter-spacing:.05em;flex:1" id="actFineLbl">FINE-TUNE · ${initStepA.label}</span>
        <div class="stepper-mini">
          <button class="sb-mini" onclick="stepActSec(-1)">−</button>
          <button class="sb-mini" onclick="stepActSec(1)">+</button>
        </div>
      </div>`;
    setTimeout(()=>bindSlider('act','actWrap','actTrack','actFill','actHandle','actDisplay',SLIDER_ZONES.duration,fmtMS,null,'actFineLbl'),50);
  } else if(field==='rounds'){
    // Rounds editor: simple (cycles of work/rest) OR advanced (custom per-round)
    title.textContent='Rounds & circuit structure';
    sub.textContent='Choose a mode below';
    const isSimple=ex.simpleMode!==false;
    cardioEditCtx.temp.simpleMode=isSimple;
    cardioEditCtx.temp.totalRounds=ex.totalRounds||1;
    cardioEditCtx.temp.workSec=ex.workSec||40;
    cardioEditCtx.temp.restSec=ex.restSec!==undefined?ex.restSec:20;
    cardioEditCtx.temp.setupSec=ex.setupSec||0;
    cardioEditCtx.temp.roundsCustom=JSON.parse(JSON.stringify(ex.roundsCustom||[
      {name:'Round 1',work:ex.workSec||40,rest:ex.restSec!==undefined?ex.restSec:20}
    ]));
    body.innerHTML=`
      <div class="rounds-mode-toggle">
        <div class="rmt-btn ${isSimple?'active':''}" onclick="setRoundsMode(true)">Simple · same round repeated</div>
        <div class="rmt-btn ${!isSimple?'active':''}" onclick="setRoundsMode(false)">Advanced · custom each round</div>
      </div>
      <div id="roundsModeBody"></div>`;
    // If the circuit is currently running, swap the Save button for a slide-to-save
    // so a casual tap doesn't disrupt the workout
    const isCircuitRunning=ex.phase==='work'||ex.phase==='rest'||ex.phase==='paused'||ex.phase==='setup';
    // B2 fix: freeze the HIIT engine while the editor is open — prevents the engine
    // from advancing a segment under the user mid-edit, which would cause phaseIdx
    // to point at the wrong segment in the new snapshot after save.
    if(isCircuitRunning){
      if(hiitIntervals[ei]) clearInterval(hiitIntervals[ei]);
      if(hiitRafs&&hiitRafs[ei]) cancelAnimationFrame(hiitRafs[ei]);
      ex._pausedForEdit=true;
    }
    if(isCircuitRunning){
      const actions=document.getElementById('cardioEditActions');
      if(actions){
        actions.innerHTML=`
          <button class="tba-cancel" onclick="closeCardioEdit()">Cancel</button>
          <div class="slide-to-save" id="slideToSave">
            <div class="sts-track">
              <div class="sts-fill" id="stsFill"></div>
              <div class="sts-label">Slide to apply →</div>
              <div class="sts-thumb" id="stsThumb">
                <svg viewBox="0 0 16 16"><polyline points="6 4 10 8 6 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
            </div>
          </div>`;
        setTimeout(()=>bindSlideToSave(),20);
      }
    }
    setTimeout(()=>renderRoundsModeBody(),20);
  } else if(field==='workSec'||field==='restSec'){
    const isWork=field==='workSec';
    title.textContent=isWork?'Work duration':'Rest duration';
    sub.textContent='Snaps to common values · drag to set';
    const cur=ex[field];
    cardioEditCtx.temp.value=cur;
    cardioEditCtx.temp.preset=SLIDER_ZONES.workRestSec;
    const initPctWR=valToPos(cur,SLIDER_ZONES.workRestSec)*100;
    const initStepWR=getAdaptiveStep(cur,SLIDER_ZONES.workRestSec.stepSchedule);
    cardioEditCtx.temp.adaptiveStep=initStepWR.step;
    const prefixWR=isWork?'work':'rest';
    body.innerHTML=`
      <div class="slider-block">
        <div class="slider-display"><span class="sv" id="wrDisplay">${cur}</span><span class="su">seconds</span></div>
        <div class="slider-wrap" id="wrWrap">
          <div class="slider-track" id="wrTrack">
            <div class="slider-fill" id="wrFill" style="width:${initPctWR}%"></div>
            ${renderMilestoneTicks(SLIDER_ZONES.workRestSec)}
            <div class="slider-breakpoint" style="left:60%"></div>
            <div class="slider-handle" id="wrHandle" style="left:${initPctWR}%"></div>
          </div>
        </div>
        <div class="slider-ticks"><span>0</span><span>30s</span><span>60s</span><span>10m</span></div>
      </div>
      <div class="slider-with-stepper">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--tx3);letter-spacing:.05em;flex:1" id="wrFineLbl">FINE-TUNE · ${initStepWR.label}</span>
        <div class="stepper-mini">
          <button class="sb-mini" onclick="stepWRFine(-1)">−</button>
          <button class="sb-mini" onclick="stepWRFine(1)">+</button>
        </div>
      </div>`;
    setTimeout(()=>bindSlider(prefixWR,'wrWrap','wrTrack','wrFill','wrHandle','wrDisplay',SLIDER_ZONES.workRestSec,v=>String(v),null,'wrFineLbl'),50);
  } else if(field==='strengthRest'){
    title.textContent='Rest between sets';
    sub.textContent='Snaps to common values · drag to set';
    const cur=ex.rest;
    cardioEditCtx.temp.value=cur;
    cardioEditCtx.temp.preset=SLIDER_ZONES.workRestSec;
    const initPctSR=valToPos(cur,SLIDER_ZONES.workRestSec)*100;
    const initStepSR=getAdaptiveStep(cur,SLIDER_ZONES.workRestSec.stepSchedule);
    cardioEditCtx.temp.adaptiveStep=initStepSR.step;
    body.innerHTML=`
      <div class="slider-block">
        <div class="slider-display"><span class="sv" id="wrDisplay">${cur}</span><span class="su">seconds</span></div>
        <div class="slider-wrap" id="wrWrap">
          <div class="slider-track" id="wrTrack">
            <div class="slider-fill" id="wrFill" style="width:${initPctSR}%"></div>
            ${renderMilestoneTicks(SLIDER_ZONES.workRestSec)}
            <div class="slider-breakpoint" style="left:60%"></div>
            <div class="slider-handle" id="wrHandle" style="left:${initPctSR}%"></div>
          </div>
        </div>
        <div class="slider-ticks"><span>0</span><span>30s</span><span>60s</span><span>10m</span></div>
      </div>
      <div class="slider-with-stepper">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--tx3);letter-spacing:.05em;flex:1" id="wrFineLbl">FINE-TUNE · ${initStepSR.label}</span>
        <div class="stepper-mini">
          <button class="sb-mini" onclick="stepWRFine(-1)">−</button>
          <button class="sb-mini" onclick="stepWRFine(1)">+</button>
        </div>
      </div>`;
    setTimeout(()=>bindSlider('rest','wrWrap','wrTrack','wrFill','wrHandle','wrDisplay',SLIDER_ZONES.workRestSec,v=>String(v),null,'wrFineLbl'),50);
  } else if(field==='totalRounds'){
    title.textContent='Total rounds';sub.textContent='Up to 99';
    cardioEditCtx.temp.value=ex.totalRounds||1;
    body.innerHTML=`<div class="stepper" style="margin-bottom:18px"><button class="sb" onclick="stepTotalRounds(-1)">−</button><div class="sm"><span class="sv" id="trVal">${ex.totalRounds||1}</span><span class="su">rounds</span></div><button class="sb" onclick="stepTotalRounds(1)">+</button></div>`;
  }
  document.getElementById('cardioEditModal').classList.add('open');
}
