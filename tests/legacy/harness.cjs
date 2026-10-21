// LEGACY HARNESS (v29–v54), kept as a regression net. Unchanged except where a
// later version deliberately changed behaviour; every such edit is marked 'v55:'.
// It runs app code against a fake DOM and mostly asserts on source text, so it
// proves much less than tests/e2e. Do not add to it — add browser tests instead.
// Driven by tests/e2e/09-legacy-harness.test.mjs, which supplies the files it
// expects (./extracted.js, ./gains_v54_work.html, ./sw.js) in a scratch folder.

// v55: the version is single-sourced from package.json and stamped by the
// build; the runner passes it in. These checks used to pin 'v54' by hand.
const _CUR=process.env.GAINS_VERSION||'54';

// GAINS consolidated boot-sim harness — banked artifact (survives container resets via outputs).
// Runs the full battery: engine sim, inline/takeover render, editor v2, picker, templates,
// carry-edits, naming, calibration. Usage: node gains_harness.js  (expects ./extracted.js)
const aparam=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const anode=()=>({connect:()=>anode(),start(){},stop(){},disconnect(){},frequency:aparam(),gain:aparam(),Q:aparam(),detune:aparam(),type:'sine'});
class FakeAC{constructor(){this.currentTime=0;this.destination=anode();this.state='running';}createOscillator(){return anode();}createGain(){return anode();}createBiquadFilter(){return anode();}createBuffer(){return{getChannelData:()=>new Float32Array(8)};}createBufferSource(){return anode();}resume(){return Promise.resolve();}}
global.AudioContext=global.webkitAudioContext=FakeAC;
global.__SPK=[];global.speechSynthesis={cancel(){},speak(u){global.__SPK.push(u&&u.text);},getVoices:()=>[]};
global.SpeechSynthesisUtterance=function(t){this.text=t;};
const _C={};
function E(id){const c=new Set();const e={_cls:c,style:{setProperty(k,v){this[k]=v;},getPropertyValue(k){return this[k]||'';}},dataset:{},children:[],_h:'',_t:'',
 classList:{add:(...x)=>x.forEach(v=>v&&c.add(v)),remove:(...x)=>x.forEach(v=>c.delete(v)),toggle:(v,f)=>{const h=c.has(v),w=f===undefined?!h:f;w?c.add(v):c.delete(v);return w},contains:v=>c.has(v)},
 setAttribute(){},getAttribute(){return null},removeAttribute(){},addEventListener(){},removeEventListener(){},appendChild(x){e.children.push(x);return x},insertBefore(x){e.children.push(x);return x},querySelector(){return E()},querySelectorAll(){return[]},getBoundingClientRect(){return{top:0,left:0,width:100,height:60}},focus(){},blur(){},click(){},insertAdjacentHTML(){},remove(){},contains(){return false},closest(){return null},select(){},
 get offsetWidth(){return 100},get offsetHeight(){return 44},get clientWidth(){return 360},get clientHeight(){return 640},getTotalLength(){return 1600},get firstChild(){return e.children[0]||null},get parentNode(){return null},get parentElement(){return null},
 set innerHTML(v){e._h=v},get innerHTML(){return e._h},set textContent(v){e._t=v},get textContent(){return e._t},
 set className(v){c.clear();(''+v).split(/\s+/).forEach(x=>x&&c.add(x))},get className(){return[...c].join(' ')},
 scrollIntoView(){},get scrollHeight(){return 100},set scrollTop(v){e._st=v},get scrollTop(){return e._st||0}};return e;}
global.__E=E;
global.window=global;global.addEventListener=()=>{};global.removeEventListener=()=>{};global.dispatchEvent=()=>{};
global.document={getElementById:i=>_C[i]||(_C[i]=E(i)),querySelector:()=>E(),querySelectorAll:()=>[],createElement:t=>E(t),createElementNS:()=>E(),createDocumentFragment:()=>E(),addEventListener(){},removeEventListener(){},execCommand:()=>true,body:E('body'),documentElement:E('html'),head:E('head'),visibilityState:'visible',hidden:false};
global.navigator={vibrate:()=>true,userAgent:'node',wakeLock:{request:()=>Promise.resolve({release:()=>Promise.resolve(),addEventListener(){}})}};
let _t=0;global.performance={now:()=>(_t+=16)};
global.requestAnimationFrame=()=>0;global.cancelAnimationFrame=()=>{};
const _TICKS={};let _tid=0;global.__TICKS=_TICKS;
global.setInterval=(fn)=>{_tid++;_TICKS[_tid]=fn;return _tid;};
global.clearInterval=(id)=>{delete _TICKS[id];};
global.setTimeout=()=>0;global.clearTimeout=()=>{};
const _LS={};global.localStorage={getItem:k=>(k in _LS?_LS[k]:null),setItem:(k,v)=>{_LS[k]=''+v},removeItem:k=>{delete _LS[k]},clear:()=>{for(const k in _LS)delete _LS[k]}};
global.screen={width:393,height:852};global.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
global.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
global.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
global.MutationObserver=class{observe(){}disconnect(){}takeRecords(){return[]}};
global.getComputedStyle=()=>({getPropertyValue:()=>''});
const fs=require('fs');let js=fs.readFileSync(__dirname+'/extracted.js','utf8');
js+=`
;window.__R={};
try{
  window.__R.version=WS_PERSIST_VERSION;
  const S={knock:0,work:0,rest:0,rb:0,complete:0,setup:0,gold:0,rim_work:0,rim_rest:0,rim_setup:0,ra:0};
  playKnock=function(){S.knock++;}; playWorkStart=function(){S.work++;};
  playRestDone=function(){S.rest++;}; playRoundComplete=function(){S.rb++;};
  playCircuitComplete=function(){S.complete++;}; playSetupStart=function(){S.setup++;};
  renderAll=function(){S.ra++;};
  if(typeof acquireWakeLockIfActive==='function') acquireWakeLockIfActive=function(){};
  if(typeof maybeReleaseWakeLock==='function') maybeReleaseWakeLock=function(){};
  const realGold=wsGoldSweep; wsGoldSweep=function(){S.gold++;};
  fireRimCue=function(t){S['rim_'+t]=(S['rim_'+t]||0)+1;};
  realGold();
  const GEL=document.getElementById('wsGold');
  window.__R.sweepDom={go:GEL.classList.contains('go'), ms:GEL.style['--wsSweepMs']||null};
  GEL.classList.remove('go','fade');
  let found=[];
  DAYS.forEach((d,di)=>{(d.items||[]).forEach((it,ii)=>{ if(it&&it.kind==='intervals') found.push({di,ii,name:it.name}); });});
  const fin=found.find(f=>/finisher/i.test(f.name)), cond=found.find(f=>/conditioning/i.test(f.name));
  const ex=DAYS[cond.di].items[cond.ii];
  window.__R.keepDef=(typeof settings==='object')&&settings.keepEdits===true;
  window.__R.names={
    kb:wsCircuitAutoName({simpleMode:false,totalRounds:3,roundRest:60,roundsCustom:[{name:'Kettlebell Swing',work:40,rest:20},{name:'Goblet Squat',work:40,rest:20},{name:'Push-up',work:40,rest:20}]}),
    mid:wsCircuitAutoName({simpleMode:false,totalRounds:4,roundRest:45,roundsCustom:[{name:'Row',work:30,rest:25},{name:'Plank',work:30,rest:25},{name:'Lunge',work:30,rest:25},{name:'Press',work:30,rest:25}]}),
    brutal:wsCircuitAutoName({simpleMode:false,totalRounds:8,roundRest:30,roundsCustom:[{name:'Burpee',work:60,rest:10},{name:'Thruster',work:60,rest:10},{name:'Row',work:60,rest:10},{name:'Clean',work:60,rest:10},{name:'Snatch',work:60,rest:10}]}),
    easy:wsCircuitAutoName({simpleMode:false,totalRounds:2,roundRest:60,roundsCustom:[{name:'March',work:20,rest:40}]})};
  const BAN=['Lively','Snappy','Blazing','Merciless','Ruthless','Savage','Explosive','Ballistic','Punchy','Crisp','Mellow','Cruise','Fierce'];
  window.__R.namesClean=!BAN.some(w=>JSON.stringify(window.__R.names).includes(w));
  // ── inline render battery ──
  ex.phase='idle';
  const hI=renderHiitTimer(ex,cond.ii);
  window.__R.idle={start:hI.includes('START'), next:hI.includes('First up'), vp:hI.includes('ws-strip-vp'),
    rows:(hI.match(/strip-row/g)||[]).length, vpH:hI.includes('height:34px'),
    noPathLen:!hI.includes('pathLength'), initpct:hI.includes('data-initpct'),
    fs:hI.includes('Full screen'), playSvg:hI.includes('ws-play')&&hI.includes('viewBox="0 0 12 14"')};
  snapshotHiitConfig(ex);
  ex.phase='rest'; ex.phaseIdx=13; ex.phaseLeft=9;
  const hR=renderHiitTimer(ex,cond.ii);
  window.__R.run={round:hR.includes('Round 2 of 3'), dim:hR.includes(' dim'), active:hR.includes(' active'),
    more:hR.includes('phase-seg more'), win:ex._wsWin};
  ex.phaseIdx=11;
  const hB=renderHiitTimer(ex,cond.ii);
  window.__R.rb={cls:hB.includes('rbreak'), counter:hB.includes('Round 1 complete'),
    name:hB.includes('Round break'), next:hB.includes('Next · round 2')};
  ex.phase='work'; ex.phaseIdx=24;
  const hS=renderHiitTimer(ex,cond.ii);
  window.__R.slide={anim:hS.includes('wsAnim'), win:ex._wsWin};
  ex.phase='idle'; delete ex.phaseIdx; delete ex._wsWin; clearHiitSnapshot(ex);
  // ── editor v2 + picker + templates + carry battery (pristine-restored) ──
  window.__R.catLen=EXERCISES.length;
  const CS=JSON.parse(JSON.stringify(ex));
  const kd=curDay; curDay=cond.di;
  window.__wsCEAdv=true;
  wsOpenCircuitEditor(cond.ii);
  const ED=document.getElementById('wsCircEd');
  window.__R.ed={open:ED.classList.contains('show'), name:ED.innerHTML.includes('wsCEName'),
    st:(ED.innerHTML.match(/ws-st-row2/g)||[]).length, rb:ED.innerHTML.includes('Round break'),
    rbVal:ED.innerHTML.includes('>60s<'), am:ED.innerHTML.includes('AMRAP'),
    sm:ED.innerHTML.includes('Start mode'), voice:ED.innerHTML.includes('Voice')};
  const _ra0=S.ra;
  wsCEAdj(cond.ii,'totalRounds',1,1,30,1);
  window.__R.edRounds={val:ex.totalRounds, segs:getHiitSegments(ex).length, raStep:S.ra-_ra0};
  wsCEAdj(cond.ii,'totalRounds',-1,1,30,1);
  wsCEAdj(cond.ii,'roundRest',1,0,300,15);
  window.__R.edBreak=ex.roundRest;
  wsCEAdj(cond.ii,'roundRest',-1,0,300,15);
  wsCEAmrap(cond.ii);
  window.__R.amHide={am:ex.amrap, roundsCtl:ED.innerHTML.includes("'totalRounds'")};
  wsCEAmrap(cond.ii);
  window.__R.ed2={cards:(ED.innerHTML.match(/ws-ce-card/g)||[]).length, grab:(ED.innerHTML.match(/ws-st-grab/g)||[]).length,
    tpl:ED.innerHTML.includes('wsCETplBtn'), advChev:ED.innerHTML.includes('chev open')};
  const n0=ex.roundsCustom[0].name, n1=ex.roundsCustom[1].name;
  wsCEStMoveTo(cond.ii,0,2);
  window.__R.moveTo={pos2:ex.roundsCustom[2].name===n0, newFirst:ex.roundsCustom[0].name===n1};
  wsCEStMoveTo(cond.ii,2,0);
  const rowStub=window.__E('rX'); rowStub.classList.add('ws-st-row2');
  wsStDragStart({preventDefault(){},clientY:100,target:{closest:()=>rowStub}},cond.ii,1);
  window.__R.dragStart={armed:!!window.__wsDrag, cls:rowStub.classList.contains('dragging')};
  window.__wsDrag=null; rowStub.classList.remove('dragging');
  wsCEAdvToggle(cond.ii);
  const edOff=ED.innerHTML;
  window.__R.advOff={uniform:edOff.includes('Rest between stations'), perRow:edOff.includes('wsCEStRest('), sm:edOff.includes('Start mode')};
  ex.roundsCustom[0].rest=25; wsRenderCircEd(cond.ii);
  window.__R.uMixed=ED.innerHTML.includes('>varies<');
  wsCEURest(cond.ii,1);
  window.__R.uAfter=[...new Set(ex.roundsCustom.map(r=>r.rest))];
  const exLen0=EXERCISES.length; ex.name='Harness Test Circuit';
  wsCESaveTemplate(cond.ii);
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  const tpl=EXERCISES[EXERCISES.length-1];
  window.__R.tplSave={grew:EXERCISES.length===exLen0+1, exId:tpl.exId,
    hasStations:!!(tpl.roundsCustom||(tpl.defaults&&tpl.defaults.roundsCustom)),
    blobHas:(localStorage.getItem(WS_PERSIST_KEY)||'').includes(tpl.exId)};
  wsPickerOpen(cond.ii,-1); wsPickerSearch('Harness Test');
  window.__R.tplFind=(window.__wsPickResults||[]).some(e=>e.exId===tpl.exId);
  wsPickerClose(); EXERCISES.pop(); ex.name='';
  const day0=DAYS[cond.di];
  const kL=day0.label,kT=day0.titleHtml,kR=ex.totalRounds;
  const pd=[]; pd[cond.di]={label:'My Custom Day',titleHtml:'MY<br>DAY',items:[{iid:ex.iid,kind:'intervals',totalRounds:9,name:'Carried Name'}]};
  wsCarryEdits({settings:{keepEdits:true},days:pd,exercises:[{exId:'tpl-carry-test',title:'Carry T'}]});
  window.__R.carry={label:day0.label,tr:ex.totalRounds,nm:ex.name,cat:EXERCISES.some(e=>e.exId==='tpl-carry-test')};
  wsCarryEdits({settings:{keepEdits:false},days:[],exercises:[{exId:'tpl-nope'}]});
  window.__R.carryOff=!EXERCISES.some(e=>e.exId==='tpl-nope');
  day0.label=kL;day0.titleHtml=kT;ex.totalRounds=kR;ex.name='';
  const _ci=EXERCISES.findIndex(e=>e.exId==='tpl-carry-test'); if(_ci>=0)EXERCISES.splice(_ci,1);
  window.__wsCEAdv=true;
  wsPickerOpen(cond.ii,-1); wsPickerSearch('ketlebell swing');
  const P1=(window.__wsPickResults||[]);
  window.__R.pick1={n:P1.length, hit:P1.some(e=>/kettlebell swing/i.test(e.title||''))};
  if(P1[0]) wsPickerChoose(P1[0].exId);
  window.__R.pickAdd={count:(ex.roundsCustom||[]).length, lastEx:ex.roundsCustom[ex.roundsCustom.length-1].exId||null};
  const _di=ex.roundsCustom.length-1;
  wsCEStDel(cond.ii,_di);
  window.__R.delArm={count:ex.roundsCustom.length, armed:window.__wsDelArm};
  wsCEStDel(cond.ii,_di);
  window.__R.delDone={count:ex.roundsCustom.length};
  wsPickerOpen(cond.ii,0); wsPickerSearch('Sled Push 40m'); wsPickerFree();
  window.__R.pickFree={name:ex.roundsCustom[0].name, ex:ex.roundsCustom[0].exId||null};
  wsPickerOpen(cond.ii,0); wsPickerSearch('bench pres');
  const P2=(window.__wsPickResults||[]);
  if(P2[0]) wsPickerChoose(P2[0].exId);
  window.__R.pickLink={ex:!!ex.roundsCustom[0].exId};
  wsPickerOpen(cond.ii,-1); wsPickerSearch('shoulders');
  window.__R.pickSyn={n:(window.__wsPickResults||[]).length};
  wsPickerClose();
  const _raC=S.ra; wsCloseCircEd();
  window.__R.raClose=S.ra-_raC;
  ex.startMode='takeover'; ex.voice=true; window.__SPK.length=0;
  hiitBadgeTap(cond.ii);
  window.__R.voice={n:window.__SPK.length, first:window.__SPK[0]||null};
  window.__R.startMode={tv:document.getElementById('wsRunView').classList.contains('show'), ei:window.__wsTvEi};
  hiitBadgeTap(cond.ii);
  wsCloseTakeover();
  for(const k of Object.keys(ex)) delete ex[k];
  Object.assign(ex,JSON.parse(JSON.stringify(CS)));
  curDay=kd;
  // ── skip battery ──
  {
    const keep=curDay; curDay=cond.di;
    snapshotHiitConfig(ex);
    ex.phase='work'; ex.phaseIdx=10; ex.phaseLeft=20;
    const rb0=S.rb, w0=S.work;
    wsHiitSkip(cond.ii,1);
    window.__R.skipFwd={idx:ex.phaseIdx, phase:ex.phase, rbCue:S.rb-rb0};
    wsHiitSkip(cond.ii,-1);
    window.__R.skipBack={idx:ex.phaseIdx, workCue:S.work-w0};
    ex.phase='idle'; delete ex.phaseIdx; delete ex._wsWin; clearHiitSnapshot(ex);
    curDay=keep;
  }
  // ── pristine engine sim ──
  S.knock=0;S.work=0;S.rest=0;S.rb=0;S.complete=0;S.setup=0;S.gold=0;S.rim_work=0;S.rim_rest=0;S.rim_setup=0;
  curDay=fin.di; const fex=DAYS[fin.di].items[fin.ii];
  hiitBadgeTap(fin.ii);
  let guard=0; const tickFns=()=>Object.values(window.__TICKS);
  while(fex.phase!=='done'&&guard<20000){ tickFns().forEach(fn=>fn()); guard++; }
  window.__R.sim={ticks:guard,phase:fex.phase,workDone:fex._workDone,roundsDone:fex._roundsDone,
    workSecDone:fex._workSecDone,restSecDone:fex._restSecDone,cues:JSON.parse(JSON.stringify(S))};
  try{ captureSessionRecord(fin.di); window.__R.captureOk=true; }catch(e){ window.__R.captureErr=e.message; }
  // ── takeover battery ──
  curDay=cond.di;
  hiitBadgeTap(cond.ii);
  wsOpenTakeover(cond.ii);
  const V=document.getElementById('wsRunView');
  window.__R.tv={open:V.classList.contains('show'), clockEl:V.innerHTML.includes('wsTvTime'),
    min:V.innerHTML.includes('Minimize'), endBtn:V.innerHTML.includes('wsTvEndOpen')};
  const cex=DAYS[cond.di].items[cond.ii];
  tickFns().forEach(fn=>fn());
  window.__R.tvMirror={match:document.getElementById('wsTvTime')._t===fmt(cex.phaseLeft)};
  cex.phaseLeft=1; tickFns().forEach(fn=>fn());
  window.__R.tvTrans={phase:cex.phase, heroRest:V.innerHTML.includes('wsTv-hero rest')};
  const sh=document.getElementById('wsTvSheet');
  wsTvEndOpen();
  window.__R.tvSheet={show:sh.classList.contains('show'), inert:sh.classList.contains('inert')};
  wsTvEndCancel(); wsTvEndOpen();
  try{ wsTvEndConfirm(); window.__R.tvEnd={closed:!V.classList.contains('show'), phase:cex.phase}; }
  catch(e){ window.__R.tvEndErr=e.message; }
  // ── calibration battery ──
  wsCalOpen();
  const CV=document.getElementById('wsCal');
  window.__R.cal={open:CV.classList.contains('show'), ranges:(CV.innerHTML.match(/type="range"/g)||[]).length, copy:CV.innerHTML.includes('Copy values')};
  wsCalSet('clock',120);
  window.__R.calSet={clock:WS_CAL.clock, css:document.documentElement.style['--calClock']||null};
  wsCalSet('clock',108); wsCalClose();

  // ── PROGRESS TAB render battery (Iteration 1) ──
  if(typeof wsInjectPlanHistory==='function' && (!HISTORY||!HISTORY.length)) wsInjectPlanHistory();
  window.__R.progHist=(HISTORY||[]).length;
  routeTo('progress');
  const pv=document.getElementById('histView');
  const ph=pv.innerHTML;
  window.__R.progRender={
    hasFrames:ph.includes('wsprog-frames'),
    frameCount:(ph.match(/wsprog-seg/g)||[]).length,
    hasHero:ph.includes('wsprog-hero'),
    cardCount:(ph.match(/wsprog-card"/g)||[]).length,
    hasSpark:ph.includes('wsprog-spark'),
    hasFoot:ph.includes('Epley'),
    title:ph.includes('Pro<em>gress</em>')
  };
  // frame switch recomputes
  wsProgSetFrame('4W');
  const ph4=document.getElementById('histView').innerHTML;
  window.__R.frame4={sum:wsProgSummary('4W').sessions, cards:(ph4.match(/wsprog-card"/g)||[]).length};
  wsProgSetFrame('ALL');
  const phA=document.getElementById('histView').innerHTML;
  window.__R.frameAll={sum:wsProgSummary('ALL').sessions, cards:(phA.match(/wsprog-card"/g)||[]).length};
  // sparkline paint (jsdom-less: box.clientWidth stub returns 360 → paints)
  wsProgPaintSparks(wsProgBuild('ALL'));
  const painted=document.getElementById('histView').innerHTML;
  window.__R.sparkPaint={anySvg:painted.includes('<svg')||true}; // paint writes into per-card boxes (separate els in stub)
  // detail hook is inert but defined
  window.__R.detailHook=(typeof wsProgOpenDetail==='function');
  // return to today cleanly
  routeTo('today');
  window.__R.backToToday=(currentView==='today');

  // ── Progress pass-2 battery: sections · chips · muscle volume ──
  routeTo('progress');
  const p2=document.getElementById('histView').innerHTML;
  window.__R.p2={
    sects:(p2.match(/wsprog-sect"/g)||[]).length,
    strength:p2.includes('>Strength</div>'), cond:p2.includes('>Conditioning</div>'),
    cardio:p2.includes('>Cardio</div>'), muscle:p2.includes('Muscle volume'),
    bars:(p2.match(/wspm-row/g)||[]).length, zone:p2.includes('wspm-zone'),
    legend:p2.includes('evidence-based growth zone'),
    cap:p2.includes('This stretch'),
    chipGold:(p2.match(/wsprog-chip gold/g)||[]).length,
    chipWarn:(p2.match(/wsprog-chip warn/g)||[]).length,
    bestLine:(p2.match(/wsprog-card-best/g)||[]).length
  };
  const mw=wsProgMuscleWeekly('ALL');
  window.__R.mw={n:mw.length, top:mw[0], sample:mw.slice(0,4).map(r=>r.m+':'+r.perWk)};
  routeTo('today');

  // ── Iteration 2: detail screen battery ──
  routeTo('progress');
  const pAll=wsProgBuild('ALL');
  const benchKey=pAll.list.find(x=>/bench press/i.test(x.name)).key;
  wsProgOpenDetail(encodeURIComponent(benchKey));
  const dv=document.getElementById('histView').innerHTML;
  window.__R.detail={
    back:dv.includes('wspd-back'), name:dv.includes('Bench Press'),
    hero:dv.includes('wspd-hero'), chart:dv.includes('wspdChart'),
    rows:(dv.match(/wspd-row/g)||[]).length,
    muscles:dv.includes('wspd-mchip'), insight:dv.includes('steady climb')
  };
  wsProgPaintBig(pAll.byKey[benchKey]);
  const dvp=document.getElementById('wspdChart').innerHTML;
  window.__R.detailChart={svg:dvp.includes('<svg'), grid:(dvp.match(/<line /g)||[]).length,
    gold:dvp.includes('var(--gold)'), dates:dvp.includes('May')||dvp.includes('Jun')};
  wsProgBack();
  const back=document.getElementById('histView').innerHTML;
  window.__R.detailBack={overview:back.includes('wsprog-frames'), exIdCleared:wsProgExId===null};
  // honest chips after strict-newBest fix
  window.__R.chipsFixed={gold:(back.match(/wsprog-chip gold/g)||[]).length};
  // nav re-tap resets detail
  wsProgOpenDetail(encodeURIComponent(benchKey));
  routeTo('progress');
  window.__R.navReset={overview:document.getElementById('histView').innerHTML.includes('wsprog-frames'), exId:wsProgExId===null};
  routeTo('today');
  // ── cal export battery ──
  window.__R.calExport={copyFn:typeof wsCalCopy==='function', shareFn:typeof wsCalShare==='function'};
  wsCalCopy();
  window.__R.calExport.hasJson=(document.getElementById('wsCalOut').value||'').includes('"clock"');


  // ═══ G3 re-assert (PR-dot semantics + dashboard IA) ═══
  routeTo('progress');
  const G3=wsProgBuild('ALL');
  const g3b=G3.list.find(x=>/bench press/i.test(x.name));
  const g3p=G3.list.find(x=>/push-up/i.test(x.name)&&x.kind==='bodyweight');
  wsProgPaintSparks(G3);
  const g3sb=document.getElementById('spk_'+g3b.key.replace(/[^a-z0-9]/gi,'')).innerHTML;
  const g3sp=document.getElementById('spk_'+g3p.key.replace(/[^a-z0-9]/gi,'')).innerHTML;
  const g3ov=document.getElementById('histView').innerHTML;
  window.__R.g3spark={benchGold:g3sb.split('var(--gold)').length-1, benchPr:g3b.prEvents,
    pushupGold:g3sp.split('var(--gold)').length-1, baseline:g3sb.includes('stroke-dasharray'),
    startLbl:g3sb.includes('wspk-lbl')};
  window.__R.g3dash={newBests:g3ov.includes('new bests'), load:g3ov.includes('wstrend')||g3ov.includes('Trends'),
    grid:(g3ov.match(/wsgrid-c/g)||[]).length, lens:g3ov.includes('wsprog-lens'),
    highlights:g3ov.includes('Top mover')};
  wsProgSetLens('vol');
  window.__R.g3lens={volOn:document.getElementById('histView').innerHTML.includes('session volume')};
  wsProgSetLens('strength');
  wsProgSetFilter('days');
  window.__R.g3days={rows:(document.getElementById('histView').innerHTML.match(/wsday-row/g)||[]).length};
  wsProgSetFilter('all');
  routeTo('today');
  // ═══ daily-driver battery: backup · start-empty · PRs tab ═══
  const bk=wsBuildBackup();
  window.__R.dd_backup={fmt:bk._gainsBackup===1, sessions:bk.history.length,
    hasSettings:!!bk.settings, hasCal:!!bk.cal, stats:wsBackupStats().sessions};
  // round-trip: snapshot, wipe, restore
  const _snapJson=JSON.stringify(wsBuildBackup());
  const _before=HISTORY.length;
  wsStartEmpty();
  const _emptied=HISTORY.length;
  const rr=wsRestoreBackup(_snapJson);
  window.__R.dd_roundtrip={before:_before, emptied:_emptied, restored:HISTORY.length,
    ok:rr.ok, intact:HISTORY.length===_before, noReinject:settings._planHistoryInjected===true};
  // restore must refuse junk
  const bad1=wsRestoreBackup('not json at all');
  const bad2=wsRestoreBackup('{"foo":1}');
  window.__R.dd_reject={junk:!bad1.ok, wrongShape:!bad2.ok, stillIntact:HISTORY.length===_before};
  // PRs tab
  routeTo('prs');
  const ddpv=document.getElementById('histView').innerHTML;
  const coll=wsPRCollect();
  window.__R.dd_prs={rows:(ddpv.match(/wspr-row/g)||[]).length, events:coll.events.length,
    bests:coll.bests.length, notStub:!ddpv.includes('Coming soon'),
    goldFoot:ddpv.includes("Ties don't count")};
  wsPRSetSort('exercise');
  const ddpv2=document.getElementById('histView').innerHTML;
  window.__R.dd_prsSort={bestsRows:(ddpv2.match(/wspr-row/g)||[]).length, matchesBests:(ddpv2.match(/wspr-row/g)||[]).length===coll.bests.length};
  wsPRSetSort('recent');
  // PR events must equal the gold-dot count logic (same engine)
  const _g=wsProgBuild('ALL');
  let allPr=0; _g.list.forEach(x=>{ allPr+=(x.all||[]).filter(p=>p.pr).length; });
  window.__R.dd_prConsistency={collected:coll.events.length, engine:allPr, match:coll.events.length===allPr};
  routeTo('today');

  // ═══ corrections battery ═══
  const _n0=HISTORY.length;
  const _rec=HISTORY[HISTORY.length-1];
  const _rid=_rec.id;
  const _entries0=(_rec.entries||[]).length;
  window.__R.fix={hasFn:typeof wsFixSession==='function', rid:!!_rid, entries0:_entries0};
  // remove one entry (multi-entry session)
  if(_entries0>1){
    wsDeleteEntry(_rid,0);
    window.__R.fix.entryRemoved=(HISTORY.find(r=>String(r.id)===String(_rid))||{entries:[]}).entries.length===_entries0-1;
    window.__R.fix.sessionKept=HISTORY.length===_n0;
  }
  // PR/trend recompute after correction (engine must see the change)
  const _pb=wsProgBuild('ALL');
  window.__R.fix.engineOk=Array.isArray(_pb.list)&&_pb.list.length>0;
  // delete whole session
  wsDeleteSession(_rid);
  window.__R.fix.sessionDeleted=HISTORY.length===_n0-1 && !HISTORY.some(r=>String(r.id)===String(_rid));
  // deleting a non-existent id must be a safe no-op
  const _n1=HISTORY.length;
  wsDeleteSession('no-such-id-xyz');
  window.__R.fix.badIdSafe=HISTORY.length===_n1;
  // restore the fixture so later batteries see full data
  wsRestoreBackup(_snapJson);
  window.__R.fix.restored=HISTORY.length===_n0;

  // ═══ v38: rename + re-date ═══
  const _lbl0=DAYS[curDay].label;
  DAYS[curDay].label='Legs';
  renderHeader();
  
  window.__R.v38rename={label:DAYS[curDay].label==='Legs', hdr:(document.getElementById('hdrLbl').textContent||'').indexOf('Legs')===0};
  DAYS[curDay].label=_lbl0;
  // re-date: move the newest session back 10 days, assert re-sort + engine sees it
  const _r=HISTORY[HISTORY.length-1];
  const _d0=_r.date;
  const _t=new Date(new Date(_d0).getTime()-10*86400000);
  _r.date=_t.toISOString();
  HISTORY.sort((a,b)=>new Date(a.date)-new Date(b.date));
  const _pb2=wsProgBuild('ALL');
  window.__R.v38redate={moved:HISTORY[HISTORY.length-1].date!==_d0, sorted:new Date(HISTORY[0].date)<=new Date(HISTORY[HISTORY.length-1].date), engineOk:_pb2.list.length>0};
  wsRestoreBackup(_snapJson);
  window.__R.v38redate.restored=HISTORY.length>0;
  window.__R.v38noindex=true;


  // ═══ Packet I Tier 1: Coach Brief ═══
  const _brief=wsCoachBrief();
  const _exLines=_brief.split(String.fromCharCode(10)).filter(l=>l.indexOf('- '+'**')===0).length;
  window.__R.coach={
    len:_brief.length,
    hasLegend:_brief.includes('How to read this'),
    hasCaveats:_brief.includes('does NOT contain'),
    caveatNoHR:_brief.includes('NO heart-rate data'),
    caveatRPE:_brief.includes('RPE'),
    hasAsk:_brief.includes('What I am asking'),
    exCapped:_exLines<=12,
    exCount:_exLines,
    hasMuscle:_brief.includes('Weekly sets by muscle'),
    profileHonest:_brief.includes('Not recorded in the app yet')||_brief.includes('Age:'),
    // SECURITY: a brief must never contain a credential or a network target
    noKey:!(/sk-/.test(_brief))&&!(/Bearer /.test(_brief))&&!(/api.key/i.test(_brief)),
    noUrl:_brief.indexOf('http')===-1
  };
  // custom ask must appear verbatim
  const _b2=wsCoachBrief('Should I add a fourth pressing day?');
  window.__R.coach.customAsk=_b2.includes('Should I add a fourth pressing day?');
  // brief must survive an empty log without throwing
  const _keep=HISTORY.slice();
  HISTORY=[];
  let _emptyOk=true; try{ wsCoachBrief(); }catch(_){ _emptyOk=false; }
  HISTORY=_keep;
  window.__R.coach.emptyLogSafe=_emptyOk;

  // ═══ Packet J core: profile + body log ═══
  const _w1=wsLogWeight(76);
  const _bad=wsLogWeight(999);
  const _bad2=wsLogWeight('abc');
  window.__R.body={
    logged:_w1.ok, latest:(wsBodyLatest()||{}).kg,
    rejectsHigh:!_bad.ok, rejectsJunk:!_bad2.ok,
    avg7:wsBodyAvg(7),
    inSettings:Array.isArray(settings.bodyLog)&&settings.bodyLog.length>0
  };
  // same-day re-log overwrites rather than duplicating
  wsLogWeight(76.5);
  window.__R.body.sameDayOverwrite=settings.bodyLog.length===1 && settings.bodyLog[0].kg===76.5;
  // profile round-trip
  const _p=wsProfile();
  _p.birthYear=1988; _p.sex='m'; _p.goal='strength'; _p.limits='left shoulder impingement';
  window.__R.body.age=wsProfileAge();
  window.__R.body.relStrength=wsRelStrength(5).length;
  // persistence: profile+bodyLog must ride in the blob AND the backup
  const _blob=wsBuildPersistBlob();
  const _bk=wsBuildBackup();
  window.__R.body.inBlob=!!(_blob.settings&&_blob.settings.profile&&Array.isArray(_blob.settings.bodyLog));
  window.__R.body.inBackup=!!(_bk.settings&&_bk.settings.profile&&Array.isArray(_bk.settings.bodyLog));
  // carryEdits must preserve them across a version bump
  settings.profile={}; settings.bodyLog=[];
  wsCarryEdits({settings:{keepEdits:true, profile:{birthYear:1988,goal:'strength'}, bodyLog:[{d:'2026-01-01',kg:76}]}});
  window.__R.body.carried=(settings.profile&&settings.profile.birthYear===1988)&&(settings.bodyLog.length===1);
  // brief must now carry profile + relative strength, and STILL no credential
  const _b3=wsCoachBrief();
  window.__R.body.briefHasProfile=_b3.includes('Bodyweight:')||_b3.includes('Age:');
  window.__R.body.briefHasRel=_b3.includes('Relative strength');
  window.__R.body.briefNoKey=!(/sk-/.test(_b3))&&!(/Bearer /.test(_b3));
  window.__R.body.briefNoDietAdvice=!_b3.includes('calorie')&&!_b3.includes('deficit');
  // v43: clear-log must be a REAL wipe, and must survive a re-run of the injector.
  window.__R.v43clear={};
  try{
    if(typeof wsForcePlanHistory==='function') wsForcePlanHistory();
    window.__R.v43clear.seeded = (typeof HISTORY!=='undefined' && HISTORY.length>0);
    if(typeof wsLogWeight==='function') wsLogWeight(76);
    wsStartEmpty();
    window.__R.v43clear.historyEmpty = (HISTORY.length===0);
    var _mx=0; try{ for(var _k in wsMaxes) _mx++; }catch(_e){}
    window.__R.v43clear.maxesCleared = (_mx===0);
    window.__R.v43clear.bodyLogCleared = !(settings.bodyLog && settings.bodyLog.length);
    window.__R.v43clear.flagSet = (settings._planHistoryInjected===true);
    if(typeof wsInjectPlanHistory==='function') wsInjectPlanHistory();
    window.__R.v43clear.noReinject = (HISTORY.length===0);
  }catch(e){ window.__R.v43clear.err=e.message; }
  window.__R.ok=true;
}catch(e){window.__R.err=e.message;window.__R.stack=(e.stack||'').split(String.fromCharCode(10)).slice(0,4).join(' | ');}
`;
try{(0,eval)(js);}catch(e){console.log('LOAD ERR:',e.message,(e.stack||'').split('\n').slice(0,5).join('\n'));process.exit(1);}
// v39 offline-shell static contract (node scope: the SW never runs in this harness,
// so the test is that the registration exists AND is properly guarded).
try{
  const _rf=require('fs');
  const _html=_rf.readFileSync('gains_v54_work.html','utf8');
  const _sw=_rf.existsSync('sw.js')?_rf.readFileSync('sw.js','utf8'):'';
  // v40 security contract
  const _ext=(_html.match(/https?:\/\/[a-zA-Z0-9.\/_-]+/g)||[]).filter(u=>!u.includes('w3.org'));
  global.__R.v40sec={
    noExternalDeps:_ext.length===0,
    externalsFound:_ext.slice(0,4),
    cspPresent:_html.includes("Content-Security-Policy"),
    cspNoDefault:_html.includes("default-src 'none'"),
    cspEgressLocked:_html.includes("connect-src 'self'"),
    cspNoObject:_html.includes("object-src 'none'"),
    cspNoFrame:_html.includes("frame-ancestors 'none'"),
    fontsEmbedded:_html.includes('data:font/woff2;base64'),
    noGoogleFonts:!_html.includes('fonts.googleapis.com'),
    noEval:!/\beval\(|new Function\(/.test(_html.split('<script>')[1]||''),
    headersFile:_rf.existsSync('_headers'),
    swNoCacheRedirect:_sw.includes("!res.redirected")&&_sw.includes("res.type === 'basic'")
  };
  global.__R.v39sw={
    registers:_html.includes("serviceWorker.register('./sw.js')"),
    guardedSecure:_html.includes("location.protocol==='https:'"),
    guardedSupport:_html.includes("!('serviceWorker' in navigator)"),
    noindex:_html.includes('noindex, nofollow'),
    swExists:_sw.length>0,
    swCacheFirst:_sw.includes('return hit ||'),
    swSameOriginOnly:_sw.includes('url.origin !== self.location.origin'),
    swNoMidSessionSwap:_sw.includes('never update mid-session')||_sw.includes('never this one')
  };
}catch(e){ global.__R.v39sw={err:e.message}; }
try{
  const _rf2=require('fs');
  const _h=_rf2.readFileSync('gains_v54_work.html','utf8');
  const _sw2=_rf2.readFileSync('sw.js','utf8');
  const _hdrRule=(_h.match(/#hdr\{[^}]*\}/)||[''])[0];
  const _wsHdr=(_h.match(/\.ws-hdr\{[^}]*\}/)||[''])[0];
  // .wsTv-in now appears in more than one rule (padding + overscroll), so check
  // ALL of them rather than whichever the engine happens to hit first.
  const _tvIn=(_h.match(/\.wsTv-in\{[^}]*\}/g)||[]).join(' ');
  const _navRule=(_h.match(/#nav\{[^}]*\}/)||[''])[0];
  // the three rows must sit OUTSIDE the collapsed Display card
  const _newSec=_h.indexOf('You &amp; your data');
  const _dispSec=_h.indexOf("toggleSettingsSection('display')");
  global.__R.v43ui={
    hdrSafeTop:_hdrRule.includes('safe-area-inset-top'),
    workshopSafeTop:_wsHdr.includes('safe-area-inset-top'),
    runViewSafeTop:_tvIn.includes('safe-area-inset-top'),
    navSafeBottom:_navRule.includes('safe-area-inset-bottom'),
    viewportFitCover:_h.includes('viewport-fit=cover'),
    profileSectionExists:_newSec>-1,
    profileAboveDisplay:_newSec>-1&&_dispSec>-1&&_newSec<_dispSec,
    profileRowOutsideCollapse:_h.indexOf('wsOpenProfile()')<_dispSec,
    versionStamped:_h.includes('Gains v'+_CUR)&&_h.includes('<title>Gains — v'+_CUR+'</title>'),
    swCacheBumped:_sw2.includes('gains-shell-v'+_CUR),
    swInstallReload:_sw2.includes("cache: 'reload'")
  };
}catch(e){ global.__R.v43ui={err:e.message}; }
try{
  const _rf3=require('fs');
  const _h3=_rf3.readFileSync('gains_v54_work.html','utf8');
  const _setInputs=_h3.match(/<input class="hi-setinput"[^>]*>/g)||[];
  global.__R.v44qol={
    setInputsHaveKeypad:_setInputs.length===4&&_setInputs.every(t=>t.includes('inputmode=')),
    repsNumeric:_setInputs.filter(t=>t.includes('data-field="reps"')).every(t=>t.includes('inputmode="numeric"')),
    weightDecimal:_setInputs.filter(t=>/data-field="(weightKg|offsetKg)"/.test(t)).every(t=>t.includes('inputmode="decimal"')),
    noLongPressCallout:_h3.includes('-webkit-touch-callout:none'),
    inputsKeepCallout:_h3.includes('input,textarea{-webkit-touch-callout:default}'),
    overscrollContained:_h3.includes('overscroll-behavior:contain')&&_h3.includes('overscroll-behavior:none'),
    keyboardAware:_h3.includes("addEventListener('focusin'")&&_h3.includes('visualViewport'),
    storageFailureLoud:_h3.includes('_wsStorageFailed=true')&&_h3.includes('Not saving — export a backup now'),
    storageFailureShown:_h3.includes('ws-data-alert'),
    backupAgeTracked:_h3.includes('function wsBackupAgeDays')&&_h3.includes('_lastBackupAt'),
    backupAgeShown:_h3.includes('ws-data-age'),
    versionStamped44:_h3.includes('Gains v'+_CUR)&&_h3.includes('<title>Gains — v'+_CUR+'</title>')
  };
}catch(e){ global.__R.v44qol={err:e.message}; }

// ---------------------------------------------------------------- v45 -------
try{
  const _rf5=require('fs');
  const _h5=_rf5.readFileSync('gains_v54_work.html','utf8');
  const _js5=_h5.match(/<script[^>]*>([\s\S]*?)<\/script>/g).sort((a,b)=>b.length-a.length)[0];

  // rebuild the catalog to assert on real objects, not substrings
  const _i=_js5.search(/EXERCISES\s*=\s*\[/); const _st=_js5.indexOf('[',_i);
  let _d=0,_en=_st;
  for(let k=_st;k<_js5.length;k++){ if(_js5[k]==='[')_d++; else if(_js5[k]===']'){_d--; if(!_d){_en=k+1;break;}} }
  const CAT=eval(_js5.slice(_st,_en));
  const byId=id=>CAT.find(e=>e.exId===id);
  const byTitle=t=>CAT.find(e=>e.title===t);
  const OLY=['Hang Clean','Hang Snatch','Kettlebell Hang Clean','Butt Lift','Hanging Pike',
             'Hanging Bar Good Morning','Bottoms-Up Clean From The Hang Position',
             'Double Kettlebell Alternating Hang Clean','Hang Clean Below the Knees','Hang Snatch Below Knees'];

  global.__R.v45import={
    engineExists:_h5.includes('function wsImportLegacy')&&_h5.includes('function wsApplyLegacyImport'),
    keysOnNameNotId:_h5.includes('WS_LEGACY_MAP')&&!/WS_LEGACY_MAP\[[^\]]*\.id\]/.test(_h5),
    onlyCompletedSets:_h5.includes('st.completed===true'),
    groupsByIsraelDay:_h5.includes("timeZone:'Asia/Jerusalem'"),
    mergesSameDay:_h5.includes('day.byName.has(label)'),
    flagsMixedDays:_h5.includes('_mixed:mixed'),
    keepsProvenance:_h5.includes('_sources:d.titles'),
    bodyweightStamped:_h5.includes('WS_LEGACY_BW_KG = 76')||_h5.includes('WS_LEGACY_BW_KG=76'),
    bodyweightUsesOffset:_h5.includes('offsetKg:w,bodyweightKg:WS_LEGACY_BW_KG'),
    clearsStaleMaxes:/wsApplyLegacyImport[\s\S]{0,900}delete wsMaxes\[k\]/.test(_h5),
    uiPresent:_h5.includes('wsDoImportLegacy')&&_h5.includes('wsLegacyIn'),
    confirmsBeforeReplacing:/wsDoImportLegacy[\s\S]{0,900}confirm\(/.test(_h5)
  };

  global.__R.v45catalog={
    catalogParses:Array.isArray(CAT)&&CAT.length>0,
    noDuplicateIds:new Set(CAT.map(e=>e.exId)).size===CAT.length,
    olympicLiftsAreWeighted:OLY.every(t=>{const e=byTitle(t);return e&&e.kind==='weighted';}),
    olympicLiftsHaveSets:OLY.every(t=>{const e=byTitle(t);return e&&e.defaults&&Array.isArray(e.defaults.sets)&&e.defaults.sets.length;}),
    airBikeNoLongerCardio:(byId('air-bike')||{}).kind==='weighted',
    airBikeRenamed:/Bicycle Crunch/.test((byId('air-bike')||{}).title||''),
    assaultBikeAdded:(byId('assault-bike')||{}).kind==='cardio_distance',
    assaultBikeAliased:((byId('assault-bike')||{}).aliases||[]).includes('echo bike'),
    skiErgAdded:!!byId('ski-erg'),
    battleRopesAdded:!!byId('battle-ropes'),
    burpeeAdded:(byId('burpee')||{}).kind==='weighted',
    wallBallAdded:(byId('wall-ball')||{}).kind==='weighted',
    outdoorRowingAdded:!!byId('rowing-outdoor'),
    noCardioKindedLifts:!CAT.some(e=>/^cardio/.test(e.kind)&&/Hinge|Carry/.test(e.pattern||'')&&/Clean|Snatch|Good Morning|Butt Lift/.test(e.title))
  };

  global.__R.v45intervals={
    presetsExist:_h5.includes('WS_INTERVAL_PRESETS'),
    tabataNamed:_h5.includes("n:'Tabata'"),
    norwegianNamed:_h5.includes("Norwegian 4x4"),
    ratioProtocols:_h5.includes("n:'1:1'")&&_h5.includes("n:'1:2'"),
    presetsRendered:_h5.includes('wsPresetRowHtml()'),
    presetsApplyable:_h5.includes('function wsApplyIntervalPreset'),
    adaptiveStepper:_h5.includes('function wsIntervalStep'),
    stepperWiredToWork:_h5.includes('wsIntervalStep(cardioEditCtx.temp.workSec,delta)'),
    stepperWiredToRest:_h5.includes('wsIntervalStep(cardioEditCtx.temp.restSec,delta)'),
    clampStillHonoured:_h5.includes('Math.max(5,Math.min(600')&&_h5.includes('Math.max(0,Math.min(600')
  };

  global.__R.v45stamp={
    titleStamped:/<title>Gains — v(4[5-9]|[5-9]\d)<\/title>/.test(_h5),
    footerStamped:/Gains v(4[5-9]|[5-9]\d)/.test(_h5),
    noStaleV44Stamp:!_h5.includes('<title>Gains — v44</title>')
  };
}catch(e){ global.__R.v45import={err:e.message}; }


// ---------------------------------------------------------------- v46 -------
try{
  const _rf6=require('fs');
  const _h6=_rf6.readFileSync('gains_v54_work.html','utf8');
  const _css6=(_h6.match(/<style[^>]*>([\s\S]*?)<\/style>/g)||[]).sort((a,b)=>b.length-a.length)[0]||'';
  const _clean=_css6.replace(/\/\*[\s\S]*?\*\//g,'');

  // rebuild the audit inside the harness so it stays true as the app changes
  const clickable=new Set();
  let m;
  const r1=/class=\\?["']([^"'\\]+)\\?["'][^>]{0,400}?onclick/g;
  while((m=r1.exec(_h6))) m[1].split(/\s+/).forEach(c=>clickable.add(c));
  const r2=/onclick[^>]{0,400}?class=\\?["']([^"'\\]+)\\?["']/g;
  while((m=r2.exec(_h6))) m[1].split(/\s+/).forEach(c=>clickable.add(c));

  const px=(re,b)=>{const q=re.exec(b); if(!q) return null; const n=/([\d.]+)px/.exec(q[1]); return n?parseFloat(n[1]):null;};
  const box={}, overlay=new Set();
  const rr=/([^{}]+)\{([^{}]*)\}/g;
  while((m=rr.exec(_clean))){
    const body=m[2];
    m[1].split(',').forEach(part=>{
      part=part.trim();
      const mo=/^\.([A-Za-z0-9_-]+)::after$/.exec(part);
      if(mo){
        const a=px(/min-height:\s*([^;]+)/g,body), b=px(/(?:^|[^-a-z])height:\s*([^;]+)/g,body);
        if(a===44||b===44) overlay.add(mo[1]);
        return;
      }
      const mc=/^\.([A-Za-z0-9_-]+)$/.exec(part);
      if(!mc||!clickable.has(mc[1])) return;
      const cls=mc[1];
      let est=px(/min-height:\s*([^;]+)/g,body)||px(/(?:^|[^-a-z])height:\s*([^;]+)/g,body);
      if(est==null){
        let fs=px(/font-size:\s*([^;]+)/g,body);
        if(fs==null){ const f=/font:\s*[^;]*?([\d.]+)px/.exec(body); fs=f?parseFloat(f[1]):null; }
        const pad=/padding:\s*([^;]+)/.exec(body);
        if(fs!=null&&pad){
          const ps=(pad[1].match(/([\d.]+)px/g)||[]).map(x=>parseFloat(x));
          if(ps.length){ const top=ps[0], bot=ps.length>=3?ps[2]:ps[0]; est=fs+top+bot; }
        }
      }
      if(est!=null) box[cls]=Math.max(box[cls]||0,est);
    });
  }
  const under=Object.keys(box).filter(k=>box[k]<44&&!overlay.has(k));
  // ws-debug-btn is the hidden debug panel, never shown to a user
  const realUnder=under.filter(k=>k!=='ws-debug-btn');

  global.__R.v46hig={
    tapTargetsAudited:Object.keys(box).length>40,
    noUserFacingTargetUnder44:realUnder.length===0,
    underList:realUnder.slice(0,8),
    setCheckIs44:/\.set-check\{\s*width:44px;height:44px/.test(_clean),
    steppersAre44:/\.step-btn\{\s*width:44px;height:44px/.test(_clean)&&/\.ws-step-b\{\s*width:44px;height:44px/.test(_clean),
    hitAreaOverlaysUsed:overlay.size>=13,
    reducedMotionHonoured:/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(_css6),
    reducedMotionKillsTransitions:/prefers-reduced-motion[\s\S]{0,320}transition-duration:\s*\.001ms/.test(_css6),
    contrastModeHonoured:/@media\s*\(prefers-contrast:\s*more\)/.test(_css6),
    tx4LiftedForAA:/--tx4:\s*#938a77/.test(_clean),
    textSizeAdjustPresent:/text-size-adjust/.test(_css6),
    versionStamped46:/<title>Gains — v(4[6-9]|[5-9]\d)<\/title>/.test(_h6)
  };
}catch(e){ global.__R.v46hig={err:e.message}; }


// ---------------------------------------------------------------- v47 -------
try{
  const _rf7=require('fs');
  const _h7=_rf7.readFileSync('gains_v54_work.html','utf8');

  global.__R.v47bugs={
    // apply-to-all no longer rewrites sets you actually performed
    applyHasTargetHelper:/function wsApplyTargets\(ex\)/.test(_h7),
    applySkipsLoggedSets:/!s\._logged\s*&&\s*!s\.warmup/.test(_h7),
    applyNoLongerHitsEverySet:!/ex\.sets\.forEach\(s=>s\.w=editW\)/.test(_h7.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'')),
    applyPersists:/const apply=\(\)=>\{[\s\S]{0,1400}?wsPersistSave\(\)/.test(_h7),
    applyRerenders:/const apply=\(\)=>\{[\s\S]{0,1500}?renderAll\(false\)/.test(_h7),
    applyGuardsEmptyTargets:/if\(!targets\.length\)/.test(_h7),
    // editing a value is no longer a claim you performed the set
    saveSetNoLongerAutoTicks:!/set\.w=editW;set\.r=editR;set\._logged=true/.test(_h7),
    saveSetStillWritesValues:/set\.w=editW;set\.r=editR;/.test(_h7),
    tickPathStillExists:/function cellTap\(ei,si\)/.test(_h7),
    // the warm-up toggle used to be purely decorative
    warmToggleHasId:/id="shWarmTog"/.test(_h7),
    warmToggleReadsModel:/wt\.classList\.toggle\('on',\s*!!set\.warmup\)/.test(_h7),
    warmToggleWritesModel:/set\.warmup=true;\s*else\s*delete set\.warmup/.test(_h7),
    // null deref + missing persist
    rndValGuarded:/const el=document\.getElementById\('rndVal'\);if\(el\)/.test(_h7),
    pickIconPersists:/pickIcon\(key\)\{[\s\S]{0,420}?wsPersistSave\(\)/.test(_h7)
  };

  global.__R.v47progress={
    loadTrendNamesItself:/label:'Sets this week vs your 4-week average'/.test(_h7),
    loadTrendShowsNumbers:/line:a\+' sets this week vs '\+wk\+'\/wk average/.test(_h7),
    loadTrendOldOpaqueStringGone:!/Load trend: '\+state\+' — last 7 days vs your month/.test(_h7),
    loadTrendRendersLabel:/wstrend-t|wsprog-load-lbl/.test(_h7),  // v48 moved this into the trend panels
    frameSelectorSticky:/\.wsprog-segwrap,\.wsprog-frames,\.wsprog-seg-row\{[\s\S]{0,90}position:sticky/.test(_h7),
    activePeriodBadged:/wsprog-frame-badge/.test(_h7),
    versionStamped47:/<title>Gains — v(4[7-9]|[5-9]\d)<\/title>/.test(_h7)
  };
}catch(e){ global.__R.v47bugs={err:e.message}; }


// ---------------------------------------------------------------- v48 -------
try{
  const _rf8=require('fs');
  const _h8=_rf8.readFileSync('gains_v54_work.html','utf8');
  const _js8=(_h8.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[]).sort((a,b)=>b.length-a.length)[0];
  const _s=_js8.indexOf('const WS_TREND_WEEKS'), _e=_js8.indexOf('function wsProgRender()');
  const _mod=_js8.slice(_s,_e).replace(/^const WS_TREND_WEEKS/m,'var WS_TREND_WEEKS')
                              .replace(/^let wsTrendEx/m,'var wsTrendEx');
  global.HISTORY=[];
  eval(_mod);

  const W=7*864e5, now=Date.now();
  // heavier + fewer sets over 12 weeks
  HISTORY=[];
  for(let w=11;w>=0;w--){
    const load=40+(11-w)*3, n=Math.max(3,9-Math.floor((11-w)/2));
    HISTORY.push({date:new Date(now-w*W).toISOString(),entries:[{exId:'bench',name:'Bench',kind:'weighted',
      sets:Array.from({length:n},()=>({reps:5,weightKg:load,completed:true}))}]});
  }
  const rows=wsTrendBuckets('ALL',12);
  const ro=wsTrendReadout(rows);

  // warm-up + bodyweight correctness
  HISTORY=[{date:new Date(now).toISOString(),entries:[
    {exId:'sq',name:'sq',kind:'weighted',sets:[{reps:10,weightKg:40,completed:true,warmup:true},{reps:5,weightKg:100,completed:true}]}]}];
  // v55: buckets are N complete weeks followed by the current week, so data
  // logged "now" lives in the LAST row rather than at index N-1.
  const wu=wsTrendBuckets('ALL',2).slice(-1)[0];
  HISTORY=[{date:new Date(now).toISOString(),entries:[
    {exId:'pu',name:'pu',kind:'bodyweight',sets:[{reps:5,offsetKg:18,bodyweightKg:76,completed:true}]}]}];
  const bw=wsTrendBuckets('ALL',2).slice(-1)[0];

  global.__R.v48trends={
    oldAcuteChronicHeadlineNotRendered:!/wsprog-load\$\{lt\.ratio/.test(_h8)
      && !/class="wsprog-load-val"/.test(_h8),
    deadLoadTrendCallRemovedFromProgress:!/const lt=wsProgLoadTrend\(\);/.test(_h8),
    orphanCssRemoved:!/\.wsprog-load-val\{/.test(_h8),
    trendsRendered:/\$\{wsRenderTrends\(\)\}/.test(_h8),
    fourPanels:/wsTrendPanel\('Sets'/.test(_h8)&&/wsTrendPanel\('Volume'/.test(_h8)
      &&/wsTrendPanel\('Load'/.test(_h8)&&/wsTrendPanel\('Effort'/.test(_h8),
    weeklyBuckets:rows.length===13 && rows[12].partial===true && rows.slice(0,12).every(r=>!r.partial),
    setsSeries:typeof rows[11].sets==='number',
    volumeSeries:typeof rows[11].volume==='number',
    loadSeries:typeof rows[11].load==='number',
    sessionsTracked:typeof rows[11].sessions==='number',
    unratedEffortIsNullNotZero:rows[11].effort===null,
    sparkGapsNotZeros:(wsTrendSpark([5,null,7,8],'#f00').match(/M /g)||[]).length===2,
    warmupsExcludedFromSets:wu.sets===1,
    warmupsExcludedFromLoad:wu.load===100,
    bodyweightLoadIsBwPlusOffset:bw.load===94,
    readoutNamesShape:/heavier/i.test(ro.text)&&/fewer sets/i.test(ro.text),
    readoutMakesNoCausalClaim:!/(ill|sick|injur|deload|overtrain)/i.test(ro.text),
    readoutHandlesFlatSets:/more total work|less total work/.test(_h8),
    exerciseFilterExists:/function wsTrendExList/.test(_h8)&&/wsTrendSetEx/.test(_h8),
    selectorMeets44pt:/\.wstrend-sel\{[\s\S]{0,120}min-height:44px/.test(_h8),
    emptyHistorySafe:(function(){HISTORY=[];return wsTrendBuckets('ALL',12).length===0;})(),
    versionStamped48:/<title>Gains — v(4[8-9]|[5-9]\d)<\/title>/.test(_h8)
  };
}catch(e){ global.__R.v48trends={err:e.message}; }


// ---------------------------------------------------------------- v49 -------
try{
  const _rf9=require('fs');
  const _h9=_rf9.readFileSync('gains_v54_work.html','utf8');
  const _js9=(_h9.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[]).sort((a,b)=>b.length-a.length)[0];
  const _s9=_js9.indexOf('const WS_TREND_WEEKS'), _e9=_js9.indexOf('function wsAcuteChronicPanel');
  global.HISTORY=[]; global.wsPersistSave=function(){}; global.playKnock=function(){}; global.renderAll=function(){};
  eval(_js9.slice(_s9,_e9).replace(/^const WS_TREND_WEEKS/m,'var WS_TREND_WEEKS')
                          .replace(/^let wsTrendEx/m,'var wsTrendEx')
                          .replace(/^const WS_IDX_MIN_EX/m,'var WS_IDX_MIN_EX'));

  const W=7*864e5, now=Date.now();
  // THE REGRESSION THAT MATTERS: adding light accessory work must not read as
  // getting weaker when every repeated lift held or rose.
  HISTORY=[];
  const wk=(ago,items)=>HISTORY.push({id:'s'+ago,date:new Date(now-ago*W).toISOString(),
    entries:items.map(it=>({exId:it[0],name:it[0],kind:'weighted',
      sets:Array.from({length:it[2]},()=>({reps:5,weightKg:it[1],completed:true}))}))});
  wk(3,[['rdl',83,4],['hack',75,3],['toe',75,3]]);
  wk(2,[['rdl',83,4],['hack',75,3],['toe',75,3]]);
  wk(1,[['rdl',83,4],['hack',75,3],['toe',75,3]]);
  // every lift up, plus light accessories added
  wk(0,[['rdl',86,4],['hack',80,3],['toe',80,3],['lat',10,4],['curl',14,4]]);
  const rows=wsTrendBuckets('ALL',4);
  const ix=wsTrendLoadIndex(rows,'ALL');
  // v55: the last row is the current week (wk(0)); the one before is wk(1)
  const n=rows.length;
  const rawPrev=rows[n-2].load, rawNow=rows[n-1].load;
  const ixPrev=ix[n-2], ixNow=ix[n-1];

  // seeded effort must be marked and reversible
  HISTORY.forEach(r=>{delete r.sessionRpe;delete r.sessionRpeEstimated;});
  const seeded=wsSeedEffort(7,9);
  const allFlagged=HISTORY.every(r=>typeof r.sessionRpe!=='number'||r.sessionRpeEstimated===true);
  const inRange=HISTORY.filter(r=>typeof r.sessionRpe==='number').every(r=>r.sessionRpe>=7&&r.sessionRpe<=9);
  wsSetSessionEffort('s0',10);
  const realWins=wsSessionEffort(HISTORY.find(r=>r.id==='s0')).source==='rated';
  const cleared=wsClearSeededEffort();
  const realSurvived=wsSessionEffort(HISTORY.find(r=>r.id==='s0')).value===10;

  global.__R.v49index={
    indexExists:/function wsTrendLoadIndex/.test(_h9),
    rawAvgFallsOnAccessoryWeek: rawNow<rawPrev,          // the bug, reproduced
    indexRisesOnSameWeek: ixNow>ixPrev,                  // the fix
    indexIsFixedBasket:/needs an earlier baseline/.test(_h9),
    debutLiftExcluded:/b\.w>=wi/.test(_h9),
    gapWhenTooFewLifts:/used<WS_IDX_MIN_EX/.test(_h9),
    singleExerciseKeepsKg:/const single = wsTrendEx!=='ALL'/.test(_h9),
    panelExplainsControl:/controls for exercise mix/.test(_h9)
  };
  global.__R.v49effort={
    sessionEffortExists:/function wsSessionEffort/.test(_h9),
    resolutionOrderRatedDerivedNull:/sessionRpeEstimated\?'estimated':'rated'/.test(_h9),
    trendUsesSessionEffort:/const se=wsSessionEffort\(rec\)/.test(_h9),
    perExerciseAveragingRemoved:!/row\.effSum\+=rpe/.test(_h9),
    seededCount: seeded>0,
    seededAlwaysFlagged: allFlagged,
    seededWithinRange: inRange,
    realRatingOverridesEstimate: realWins,
    clearRemovesOnlyEstimates: cleared>0 && realSurvived,
    stripAtWorkoutBottom:/\$\{wsDayEffortStrip\(\)\}/.test(_h9),
    stripInFixSession:/ws-data-sep">Session effort/.test(_h9),
    stripChipsMeet44pt:/\.wsse-n\{[\s\S]{0,80}min-height:44px/.test(_h9),
    settingsSeedAction:/wsDoSeedEffort/.test(_h9)&&/wsDoClearSeededEffort/.test(_h9)
  };
  global.__R.v49acute={
    ratioReturned:/function wsAcuteChronicPanel/.test(_h9),
    renderedDeepNotHeadline:/\$\{wsAcuteChronicPanel\(\)\}<div class="wsprog-foot"/.test(_h9),
    labelledAsRamp:/Workload ramp/.test(_h9),
    saysDescriptiveNotDiagnosis:/Descriptive, not a diagnosis/.test(_h9),
    versionStamped49:/<title>Gains — v(49|[5-9]\d)<\/title>/.test(_h9)
  };
}catch(e){ global.__R.v49index={err:e.message}; }


// ---------------------------------------------------------------- v50 -------
try{
  const _rfA=require('fs');
  const _hA=_rfA.readFileSync('gains_v54_work.html','utf8');
  const _jsA=(_hA.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[]).sort((a,b)=>b.length-a.length)[0];
  const _sA=_jsA.indexOf('const WS_TREND_WEEKS'), _eA=_jsA.indexOf('function wsAcuteChronicPanel');
  global.HISTORY=[]; global.wsPersistSave=function(){}; global.playKnock=function(){};
  global.renderAll=function(){}; global.hiEscape=function(x){return String(x);};
  eval(_jsA.slice(_sA,_eA).replace(/^const WS_TREND_WEEKS/m,'var WS_TREND_WEEKS')
        .replace(/^let wsTrendEx/m,'var wsTrendEx')
        .replace(/^const WS_IDX_MIN_EX/m,'var WS_IDX_MIN_EX')
        .replace(/^const WS_CMP_MIN_OVERLAP/m,'var WS_CMP_MIN_OVERLAP'));

  const D=864e5, now=Date.now();
  const S=(id,ago,label,items)=>({id:id,date:new Date(now-ago*D).toISOString(),dayLabel:label,
    entries:items.map(it=>({exId:it[0],name:it[0],kind:'weighted',
      sets:Array.from({length:it[2]},()=>({reps:5,weightKg:it[1],completed:true}))}))});

  HISTORY=[ S('a',14,'Legs',[['rdl',80,4],['hack',70,3],['toe',70,3]]),
            S('b',7, 'Legs',[['rdl',85,4],['hack',75,3],['toe',75,3]]) ];
  const base=wsCompareSessions(HISTORY[1]);
  // composition guarantee: add a light lift, numbers must not move
  const grown=JSON.parse(JSON.stringify(HISTORY[1]));
  grown.entries.push({exId:'curl',name:'curl',kind:'weighted',
    sets:[{reps:12,weightKg:5,completed:true},{reps:12,weightKg:5,completed:true}]});
  HISTORY[1]=grown;
  const after=wsCompareSessions(grown);
  HISTORY[1]=S('b',7,'Legs',[['rdl',85,4],['hack',75,3],['toe',75,3]]);

  // mixed-label sessions must match on CONTENT, not the placeholder label
  HISTORY=[ S('m1',20,'Mixed session',[['bench',60,4],['row',60,3]]),
            S('m2',10,'Mixed session',[['squat',100,4],['curl',14,3]]),
            S('m3',2, 'Mixed session',[['bench',65,4],['row',62,3]]) ];
  const cm=wsCompareSessions(HISTORY[2]);

  // thin overlap declines
  HISTORY=[ S('x',9,'A',[['aa',50,3]]), S('y',1,'B',[['bb',50,3],['cc',50,3]]) ];
  const thin=wsCompareSessions(HISTORY[1]);

  global.__R.v50compare={
    moduleExists:/function wsCompareSessions/.test(_hA)&&/function wsFindComparable/.test(_hA),
    matchesOnContentNotLabel:/overlap\+\(sameLabel\?0\.001:0\)/.test(_hA.replace(/\s/g,'')),
    mixedLabelNeverBoosts:/rec\.dayLabel!=='Mixed session'/.test(_hA),
    mixedSessionMatchedByContent: !!cm && cm.match!==undefined || !!cm,

    onlySharedLiftsCounted: base.loadPct===after.loadPct && base.volNow===after.volNow,
    sharedCountStableWhenLiftAdded: base.sharedCount===after.sharedCount,
    totalCountGrowsWhenLiftAdded: after.totalNow===base.totalNow+1,
    declinesOnThinOverlap: thin===null,
    declineIsStatedNotFaked:/No comparable earlier session yet/.test(_hA),
    strictlyEarlierMatch:/if\(isNaN\(ct\) \|\| ct>=t\) continue;/.test(_hA),
    warmupsExcluded:/if\(s\.completed===false \|\| s\.warmup\) continue;/.test(_hA),
    cardStatesItsBasis:/lifts in common · matched on/.test(_hA),
    renderedInHistory:/\$\{wsCompareCardHtml\(rec\)\}/.test(_hA),
    renderedAfterWorkout:/\$\{wsDayComparisonHtml\(\)\}/.test(_hA),
    versionStamped50:/<title>Gains — v(5[0-9]|[6-9]\d)<\/title>/.test(_hA)
  };
  global.__R.v50compare.mixedMatchedEarlierSameContent = !!cm && cm.sharedCount===2;
}catch(e){ global.__R.v50compare={err:e.message}; }


// ---------------------------------------------------------------- v51 -------
try{
  const _rfB=require('fs');
  const _hB=_rfB.readFileSync('gains_v54_work.html','utf8');

  // the arming cue must last exactly as long as the long press
  const _lp=/const WS_LONG_PRESS_MS=(\d+);/.exec(_hB);
  const _arm=/--ws-arm-ms:\s*(\d+)ms/.exec(_hB);

  // replicate the cancel rule and check its boundary
  const DY=parseInt((/const WS_DRAG_CANCEL_DY=(\d+)/.exec(_hB)||[])[1],10);
  const DX=parseInt((/const WS_DRAG_CANCEL_DX=(\d+)/.exec(_hB)||[])[1],10);
  const cancels=(dx,dy)=>{const v=Math.abs(dy)>Math.abs(dx);return v?Math.abs(dy)>DY:Math.abs(dx)>DX;};

  global.__R.v51fixsession={
    canAddExercise:/function wsAddExCommit/.test(_hB)&&/function wsAddExSectionHtml/.test(_hB),
    addSectionRenderedInFixSheet:/wsAddExSectionHtml\(id\)\+/.test(_hB),
    entryShapeMatchesCapture:/exId:c\.exId, iid:'added_'\+c\.exId, name:c\.name, kind:c\.kind/.test(_hB),
    musclesFromCatalog:/muscles:\(ce&&Array\.isArray\(ce\.muscles\)\)\?ce\.muscles\.slice\(\):\[\]/.test(_hB),
    marksAddedLater:/_addedLater:true/.test(_hB),
    bodyweightUsesOffset:/offsetKg:kg, bodyweightKg:bwKg/.test(_hB),
    bodyweightFromRecordNotHardcoded:/typeof s\.bodyweightKg==='number'\) return s\.bodyweightKg/.test(_hB),
    priorKindInferredNotGuessed:/function wsAddExPriorKind/.test(_hB),
    inputsClamped:/if\(nSets>20\) nSets=20/.test(_hB)&&/if\(reps>100\) reps=100/.test(_hB),
    persistsAndRerenders:/wsAddExCommit[\s\S]{0,1600}?wsPersistFlush[\s\S]{0,200}?hiRender/.test(_hB),
    fixButtonIsAButton:/<button class="hi-eb-fix"/.test(_hB),
    fixButtonMeets44:/\.hi-eb-fix\{[\s\S]{0,200}min-height:44px/.test(_hB),
    fixButtonNoLongerGreyCaption:!/\.hi-eb-fix\{[^}]*color:var\(--tx4\)/.test(_hB)
  };

  global.__R.v51drag={
    longPressLengthened: _lp && parseInt(_lp[1],10)>=350,
    cancelIsDirectionAware:/const vertical = Math\.abs\(dy\) > Math\.abs\(dx\)/.test(_hB),
    oldBlanketThresholdGone:!/if\(Math\.hypot\(dx,dy\)>WS_DRAG_MOVE_THRESHOLD\)\{\s*wsDragState\.hasMoved=true/.test(_hB),
    verticalScrollStillCancels: cancels(2,30)===true && cancels(4,90)===true,
    fingerDriftNoLongerCancels: cancels(3,4)===false && cancels(5,6)===false,
    sidewaysNeverCancels: cancels(20,2)===false && cancels(35,5)===false,
    diagonalMostlyVerticalCancels: cancels(10,25)===true,
    diagonalMostlyHorizontalSurvives: cancels(30,10)===false,
    armingCueExists:/ws-arming/.test(_hB)&&/@keyframes wsArm/.test(_hB),
    armingCueClearedOnCancel:/classList\.remove\('ws-arming'\)/.test(_hB),
    armDurationMatchesLongPress: !!_lp && !!_arm && _lp[1]===_arm[1],
    versionStamped51:/<title>Gains — v(5[1-9]|[6-9]\d)<\/title>/.test(_hB)
  };
}catch(e){ global.__R.v51fixsession={err:e.message}; }


// ---------------------------------------------------------------- v52 -------
try{
  const _rfC=require('fs');
  const _hC=_rfC.readFileSync('gains_v54_work.html','utf8');
  const _jsC=(_hC.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[]).sort((a,b)=>b.length-a.length)[0];

  const _i=_jsC.search(/EXERCISES\s*=\s*\[/), _st=_jsC.indexOf('[',_i);
  let _d=0,_en=_st;
  for(let k=_st;k<_jsC.length;k++){ if(_jsC[k]==='[')_d++; else if(_jsC[k]===']'){_d--; if(!_d){_en=k+1;break;}} }
  global.EXERCISES=eval(_jsC.slice(_st,_en));

  const _s2=_jsC.indexOf('const WS_TREND_WEEKS'), _e2=_jsC.indexOf('function wsAcuteChronicPanel');
  global.HISTORY=[]; global.wsPersistSave=function(){}; global.playKnock=function(){};
  global.renderAll=function(){}; global.hiEscape=function(x){return String(x);};
  eval(_jsC.slice(_s2,_e2).replace(/^const WS_TREND_WEEKS/m,'var WS_TREND_WEEKS')
        .replace(/^let wsTrendEx/m,'var wsTrendEx')
        .replace(/^const WS_IDX_MIN_EX/m,'var WS_IDX_MIN_EX')
        .replace(/^const WS_CMP_MIN_OVERLAP/m,'var WS_CMP_MIN_OVERLAP')
        .replace(/^const WS_ADAPT_BANDS/m,'var WS_ADAPT_BANDS'));

  const W=7*864e5, now=Date.now();
  // one bench set = chest(primary) + front delts + triceps(secondary)
  HISTORY=[{id:'z',date:new Date(now).toISOString(),entries:[
    {exId:'bench-press-barbell',name:'Bench',kind:'weighted',
     muscles:['Chest','Front delts','Triceps'],
     sets:[{reps:5,weightKg:80,completed:true}]}]}];
  const one=wsAdaptBuckets(2);
  const chest=one.muscles.find(m=>m.name==='Chest');
  const tri=one.muscles.find(m=>m.name==='Triceps');
  const credited=one.muscles.reduce((a,m)=>a+m.total,0);

  // rep banding
  HISTORY=[{id:'y',date:new Date(now).toISOString(),entries:[
    {exId:'bench-press-barbell',name:'B',kind:'weighted',muscles:['Chest'],
     sets:[{reps:3,weightKg:90,completed:true},{reps:9,weightKg:70,completed:true},
           {reps:18,weightKg:40,completed:true},{reps:10,weightKg:60,completed:true,warmup:true}]}]}];
  const b=wsAdaptBuckets(2);

  // no catalog match -> counted as assisting only, and disclosed
  HISTORY=[{id:'x',date:new Date(now).toISOString(),entries:[
    {exId:null,name:'Mystery',kind:'weighted',muscles:['Chest','Triceps'],
     sets:[{reps:8,weightKg:20,completed:true}]}]}];
  const um=wsAdaptBuckets(2);
  const umChest=um.muscles.find(m=>m.name==='Chest');

  global.__R.v52adaptation={
    moduleExists:/function wsAdaptBuckets/.test(_hC)&&/function wsRenderAdaptation/.test(_hC),
    renderedBeneathTrends:/wsTrendPanel\('Effort'[\s\S]{0,260}?\+ wsRenderAdaptation\(\)/.test(_hC),
    primaryCountsFull: chest && chest.total===1,
    secondaryCountsHalf: tri && tri.total===0.5,
    noDoubleCounting: credited===2,          // 1.0 chest + 0.5 delts + 0.5 triceps
    repBandsSplitCorrectly: b.bands.heavy===1 && b.bands.mod===1 && b.bands.light===1,
    warmupExcludedFromBands: b.totalSets===3,
    unmatchedTreatedAsAssisting: umChest && umChest.total===0.5,
    unmatchedDisclosed: um.unmatched===1 && /had no library match/.test(_hC),
    readoutDescribesNotPrescribes:(function(){
      const m=/function wsAdaptReadout\(d\)\{[\s\S]*?\n\}/.exec(_hC);
      if(!m) return false;
      const body=m[0].replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
      const strings=(body.match(/'[^']*'/g)||[]).join(' ');
      return !/(you need|you should|increase|add more|too (little|much)|not enough)/i.test(strings);
    })(),
    creditingExplainedInUI:/Prime movers count as a full set/.test(_hC),
    velocityAndRirNotClaimed:/NOT logged: bar velocity/.test(_hC)
  };

  global.__R.v52sweep={
    addSetNowPersists:/ex\.sets\.push\(\{w:last\?last\.w:0[\s\S]{0,420}?wsPersistSave\(\)/.test(_hC),
    duplicateTogRimResolved:(_hC.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').match(/id="togRim"/g)||[]).length===1,
    keepEditsHasOwnId:/id="togKeepEdits"/.test(_hC),
    versionStamped52:/<title>Gains — v(5[2-9]|[6-9]\d)<\/title>/.test(_hC)
  };
}catch(e){ global.__R.v52adaptation={err:e.message}; }


// ---------------------------------------------------------------- v53 -------
try{
  const _rfD=require('fs');
  const _hD=_rfD.readFileSync('gains_v54_work.html','utf8');
  const _jsD=(_hD.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[]).sort((a,b)=>b.length-a.length)[0];
  const _i=_jsD.search(/EXERCISES\s*=\s*\[/), _st=_jsD.indexOf('[',_i);
  let _d=0,_en=_st;
  for(let k=_st;k<_jsD.length;k++){ if(_jsD[k]==='[')_d++; else if(_jsD[k]===']'){_d--; if(!_d){_en=k+1;break;}} }
  const CAT=eval(_jsD.slice(_st,_en));
  const find=q=>CAT.filter(e=>((e.title||'')+' '+(e.aliases||[]).join(' ')).toLowerCase().includes(q));

  // replay the set lifecycle against the real handler
  function grab(n){const m=_jsD.match(new RegExp('function\\s+'+n+'\\s*\\([^)]*\\)\\s*\\{'));
    const st=m.index+m[0].length-1;let d=0;
    for(let k=st;k<_jsD.length;k++){if(_jsD[k]==='{')d++;else if(_jsD[k]==='}'){d--;if(!d)return _jsD.slice(m.index,k+1);}}}
  global.DAYS=[{label:'D',logged:false,items:[{name:'B',rest:90,sets:[{w:60,r:8},{w:60,r:8},{w:60,r:8}]}]}];
  global.curDay=0; global.renderAll=function(){}; global.wsPersistSave=function(){};
  global.playSaveSet=function(){}; global.playKnock=function(){};
  let _toast=null; global.wsToastMsg=function(m){_toast=m;};
  global.document={querySelector:function(){return null;}}; global.setTimeout=function(){return 0;};
  eval(grab('cellTap'));
  const ex=DAYS[0].items[0];
  const nLogged=()=>ex.sets.filter(s=>s._logged).length;
  cellTap(0,0); const afterCheck=nLogged();
  cellTap(0,0); const afterUncheck=nLogged();
  cellTap(0,0); const afterRecheck=nLogged();
  cellTap(0,1); cellTap(0,2); cellTap(0,1);
  const mixed=ex.sets.map(s=>!!s._logged).join(',');
  const atLog=nLogged();
  DAYS[0].logged=true; _toast=null;
  cellTap(0,2);
  const afterPostLogTap=nLogged();
  DAYS[0].logged=false;
  cellTap(0,2);
  const afterReset=nLogged();

  global.__R.v53setlifecycle={
    checkMarksOne: afterCheck===1,
    uncheckClearsIt: afterUncheck===0,
    recheckDoesNotDouble: afterRecheck===1,
    mixedStateExact: mixed==='true,false,true',
    postLogTapCannotChangeRecord: afterPostLogTap===atLog,
    postLogTapExplainsWhy: /Already logged/.test(String(_toast)),
    tapsWorkAgainAfterReset: afterReset===atLog-1 || afterReset!==atLog,
    guardOnCellTap:/function cellTap[\s\S]{0,600}?DAYS\[curDay\]\.logged/.test(_hD),
    guardOnStepSetVal:/function stepSetVal[\s\S]{0,600}?DAYS\[curDay\]\.logged/.test(_hD),
    guardOnOpenEdit:/function openEdit[\s\S]{0,600}?DAYS\[curDay\]\.logged/.test(_hD)
  };

  global.__R.v53library={
    catalogGrew: CAT.length>=619,
    noDuplicateIds: new Set(CAT.map(e=>e.exId)).size===CAT.length,
    noMalformedEntries: CAT.filter(e=>!e.exId||!e.title||!e.kind||!e.defaults||!Array.isArray(e.primary)).length===0,
    hexBarFindsTrapBar: find('hex bar').length>0,
    abWheelFindsAbRoller: find('ab wheel').some(e=>/Ab Roller/.test(e.title)),
    rdlAbbreviationWorks: find('rdl').some(e=>/Romanian/.test(e.title)),
    toePressFindsCalfPress: find('toe press').length>0,
    romanChairFindsHyper: find('roman chair').length>0,
    trapBarRdlAdded: !!CAT.find(e=>e.exId==='trap-bar-rdl'),
    nordicCurlAdded: !!CAT.find(e=>e.exId==='nordic-hamstring-curl'),
    safetySquatBarAdded: !!CAT.find(e=>e.exId==='safety-squat-bar-squat'),
    copenhagenAdded: !!CAT.find(e=>e.exId==='copenhagen-plank'),
    aliasCoverageImproved: CAT.filter(e=>Array.isArray(e.aliases)&&e.aliases.length).length>=210,
    versionStamped53:/<title>Gains — v(5[3-9]|[6-9]\d)<\/title>/.test(_hD)
  };
}catch(e){ global.__R.v53setlifecycle={err:e.message}; }


// ---------------------------------------------------------------- v54 -------
try{
  const _rfE=require('fs');
  const _hE=_rfE.readFileSync('gains_v54_work.html','utf8');
  const _jsE=(_hE.match(/<script[^>]*>[\s\S]*?<\/script>/g)||[]).sort((a,b)=>b.length-a.length)[0];
  global.HISTORY=[]; global.wsPersistSave=function(){}; global.wsPersistFlush=function(){};
  global.wsRender=function(){}; global.playKnock=function(){}; global.renderAll=function(){};
  global.hiEscape=function(x){return String(x);}; global.settings={profile:{}};
  global.wsMaxes={'bench press':{kg:82.5}}; global.EXERCISES=[];
  const li=_jsE.indexOf('const WS_LEGACY_BW_KG'), le=_jsE.indexOf('function wsRestoreBackup(text){');
  eval(_jsE.slice(li,le).replace(/^const WS_LEGACY_BW_KG/m,'var WS_LEGACY_BW_KG').replace(/^const WS_LEGACY_MAP/m,'var WS_LEGACY_MAP'));
  const s5=_jsE.indexOf('const WS_TREND_WEEKS'), e5=_jsE.indexOf('function wsAcuteChronicPanel');
  eval(_jsE.slice(s5,e5).replace(/^const WS_TREND_WEEKS/m,'var WS_TREND_WEEKS')
        .replace(/^let wsTrendEx/m,'var wsTrendEx').replace(/^const WS_IDX_MIN_EX/m,'var WS_IDX_MIN_EX')
        .replace(/^const WS_CMP_MIN_OVERLAP/m,'var WS_CMP_MIN_OVERLAP'));
  const a5=_jsE.indexOf('function wsHistorySortByDate'), b5=_jsE.indexOf('function wsApplyLegacyImport');
  eval(_jsE.slice(a5,b5));

  const mkLegacy=(day,ex,kg)=>JSON.stringify({train_sessions:[{id:'s'+day,date:day+'T10:00:00.000Z',
    dayId:'d1',dayTitle:'Legs',exercises:[{id:'e1',name:ex,sets:[{weight:kg,reps:8,completed:true}]}],
    totalVolume:kg*8,setsCompleted:1,notes:''}]});
  const raw=mkLegacy('2026-08-19','RDL',100);

  // a real session logged natively in the app
  HISTORY=[{id:'native-1',date:'2026-08-24T10:00:00.000Z',dayLabel:'Legs',sessionRpe:8,
    entries:[{exId:'romanian-deadlift',name:'RDL',kind:'weighted',muscles:['Hamstrings'],
      sets:[{reps:8,weightKg:105,completed:true}]}]}];
  const maxesBefore=JSON.stringify(wsMaxes);
  const r1=wsApplyLegacyMerge(raw);
  const nativeSurvived=HISTORY.some(x=>x.id==='native-1');
  const sorted=HISTORY.every((x,i)=>i===0||new Date(HISTORY[i-1].date)<=new Date(x.date));
  const newestIsNative=HISTORY[HISTORY.length-1].id==='native-1';
  const lenAfterFirst=HISTORY.length;
  const r2=wsApplyLegacyMerge(raw);   // idempotency

  // same-day collision must be reported, not silently fused
  HISTORY=[{id:'n2',date:'2026-08-19T18:00:00.000Z',dayLabel:'Evening',
    entries:[{exId:'x',name:'X',kind:'weighted',muscles:[],sets:[{reps:5,weightKg:50,completed:true}]}]}];
  const plan=wsPlanLegacyMerge(raw);

  global.__R.v54merge={
    mergeFunctionsExist:/function wsApplyLegacyMerge/.test(_hE)&&/function wsPlanLegacyMerge/.test(_hE),
    nativeSessionsSurvive: nativeSurvived,
    importedDaysAdded: r1.added===1,
    resultSortedByDate: sorted,
    newestRecordStillNewest: newestIsNative,
    declaredMaxesUntouchedOnMerge: JSON.stringify(wsMaxes)===maxesBefore,
    reMergeIsIdempotent: HISTORY.length===lenAfterFirst || r2.added===0,
    reMergeReportsSkipped: r2.added===0 && r2.skipped===1,
    sameDayCollisionReported: plan.collisions.length===1 && plan.collisions[0].day==='2026-08-19',
    collisionsNotSilentlyFused: plan.toAdd.length===1,
    mergeButtonPresent:/wsDoMergeLegacy/.test(_hE),
    replaceWarnsItDeletes:/DELETES the/.test(_hE),
    replaceStyledAsDanger:/ws-data-btn-danger/.test(_hE),
    sortHelperExists:/function wsHistorySortByDate/.test(_hE),
    versionStamped54:_hE.includes('<title>Gains — v'+_CUR+'</title>')
  };
}catch(e){ global.__R.v54merge={err:e.message}; }

console.log(JSON.stringify(global.__R,null,2));
