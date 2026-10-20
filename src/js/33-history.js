
// ─── History module ─────────────────────────────────────────────────
//
// Reads exclusively from HISTORY (immutable SessionRecords). Derives every
// number at read time (volume, work time, pace, effort/intensity). Never
// fabricates absent data. Three views: list (default) / calendar / detail.

let hiMode='list';          // 'list' | 'calendar'
let hiDetailId=null;        // session id when in detail view, else null
let hiDetailOrigin='list';  // where detail was opened from, for back nav
let hiEditing=false;        // detail edit mode
let hiCalAnchor=null;       // Date: first (older) month of the visible pair
let hiExpandedId=null;      // which list row is expanded inline
// Whether the user has enabled the Intensity Score (RPE) layer. Persisted in
// settings; default off so the minimalist never sees RPE UI.
function hiScoreEnabled(){ try{ return !!settings.showIntensityScore; }catch(_){ return false; } }

const HI_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HI_DOWS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Derivation helpers (read-time only) ──
function hiFmtKg(v){ return Math.round(v).toLocaleString(); }
function hiFmtMS(sec){
  if(sec==null) return null;
  const m=Math.floor(sec/60), s=Math.round(sec%60);
  if(m>=60){ const h=Math.floor(m/60); return h+'h '+(m%60)+'m'; }
  return m+':'+(s<10?'0':'')+s;
}
function hiFmtDist(m){
  if(m==null) return null;
  if(m<1000) return Math.round(m)+' m';
  return (m/1000).toFixed((m/1000)>=10?1:2)+' km';
}
// One set's volume-load. Bodyweight: total = bodyweight + offset (offset signed).
function hiSetVolume(s){
  let load;
  if(typeof s.weightKg==='number') load=s.weightKg;
  else load=(s.bodyweightKg||0)+(s.offsetKg||0);
  return Math.max(0,load)*(s.reps||0);
}
function hiEntryVolume(e){
  if(!Array.isArray(e.sets)) return 0;
  return e.sets.reduce((sum,s)=> s.completed!==false ? sum+hiSetVolume(s) : sum, 0);
}
function hiEntrySetCount(e){
  if(!Array.isArray(e.sets)) return 0;
  return e.sets.filter(s=>s.completed!==false).length;
}
function hiEntryReps(e){
  if(!Array.isArray(e.sets)) return 0;
  return e.sets.reduce((n,s)=> s.completed!==false ? n+(s.reps||0) : n, 0);
}
function hiEntryTopLoad(e){
  if(!Array.isArray(e.sets)) return 0;
  return e.sets.reduce((m,s)=>{
    const l = (typeof s.weightKg==='number') ? s.weightKg : ((s.bodyweightKg||0)+(s.offsetKg||0));
    return l>m?l:m;
  },0);
}
// Top reps in a single completed set (used for bodyweight display).
function hiEntryTopReps(e){
  if(!Array.isArray(e.sets)) return 0;
  return e.sets.reduce((m,s)=> (s.completed!==false && (s.reps||0)>m) ? s.reps : m, 0);
}
// Max added load (offset) across sets — for weighted-bodyweight like weighted pull-ups.
function hiEntryTopOffset(e){
  if(!Array.isArray(e.sets)) return 0;
  return e.sets.reduce((m,s)=> (typeof s.offsetKg==='number' && s.offsetKg>m) ? s.offsetKg : m, 0);
}
function hiPace(durationSec,distanceM){
  if(!durationSec||!distanceM) return null;
  const perKm=durationSec/(distanceM/1000);
  const m=Math.floor(perKm/60), s=Math.round(perKm%60);
  return m+':'+(s<10?'0':'')+s;
}
// Effort Score for one entry: RPE × work-minutes. Requires RPE AND that work
// actually happened (>=1 logged set for strength). Returns null if absent.
function hiEntryRpe(e){
  if(e.kind==='hiit'){
    if(e.hiit && typeof e.hiit.peakRpe==='number') return e.hiit.peakRpe;
  }
  if(typeof e.rpe==='number') return e.rpe;
  return null;
}
function hiEntryWorkSec(e){
  if(e.kind==='weighted'||e.kind==='bodyweight'){
    // No reliable per-set time; approximate work as reps×~3s only if needed.
    // For Effort Score we use a nominal work-minute proxy: total reps × 3s.
    // (Honest enough for a relative score; documented as approximate.)
    return hiEntryReps(e)*3;
  }
  if(e.kind==='cardio'){
    return e.cardio ? (e.cardio.durationSec||0) : 0;
  }
  if(e.kind==='hiit'){
    return e.hiit ? (e.hiit.workSecTotal||0) : 0;
  }
  return 0;
}
function hiEntryEffort(e){
  const rpe=hiEntryRpe(e);
  if(rpe==null) return null;
  // Effort requires actual work: at least one logged set (strength) or >0 work time.
  if((e.kind==='weighted'||e.kind==='bodyweight') && hiEntrySetCount(e)===0) return null;
  const workMin=hiEntryWorkSec(e)/60;
  if(workMin<=0) return null;
  return Math.round(rpe*workMin*10); // ×10 keeps it a readable 2-3 digit score
}
// Session-level: total intensity = sum of effort scores, but ONLY if every
// ratable entry has RPE. Returns {total, ratable, rated} so the UI can decide.
function hiSessionIntensity(rec){
  let total=0, ratable=0, rated=0, rpeSum=0, rpeN=0;
  for(const e of (rec.entries||[])){
    // An entry is "ratable" if it represents real work.
    const isWork = (e.kind==='weighted'||e.kind==='bodyweight') ? hiEntrySetCount(e)>0
                 : (e.kind==='cardio') ? (e.cardio && (e.cardio.durationSec||0)>0)
                 : (e.kind==='hiit') ? (e.hiit && (e.hiit.workSecTotal||0)>0)
                 : false;
    if(!isWork) continue;
    ratable++;
    const eff=hiEntryEffort(e);
    if(eff!=null){ rated++; total+=eff; }
    const r=hiEntryRpe(e);
    if(r!=null){ rpeSum+=r; rpeN++; }
  }
  // avg = mean of the 1-10 ratings themselves (legible, same scale as input).
  // total (the composite load sum) is kept internally for future trend views
  // but is no longer displayed as a naked number.
  const avg = rpeN>0 ? Math.round((rpeSum/rpeN)*10)/10 : null;
  return {total,ratable,rated,avg};
}

// Session-level rollups
function hiSessionVolume(rec){
  return (rec.entries||[]).reduce((s,e)=> s+hiEntryVolume(e), 0);
}
function hiSessionSets(rec){
  return (rec.entries||[]).reduce((n,e)=> n+hiEntrySetCount(e), 0);
}
// "Work time" = summed timed work we actually know: cardio durations + HIIT work.
// Strength has no reliable timing, so it's excluded (honest).
function hiSessionWorkSec(rec){
  let sec=0;
  for(const e of (rec.entries||[])){
    if(e.kind==='cardio' && e.cardio) sec+=e.cardio.durationSec||0;
    if(e.kind==='hiit' && e.hiit) sec+=e.hiit.workSecTotal||0;
  }
  return sec;
}
function hiSessionMods(rec){
  const set=new Set();
  for(const e of (rec.entries||[])){
    if(e.kind==='weighted'||e.kind==='bodyweight') set.add('s');
    else if(e.kind==='cardio') set.add('c');
    else if(e.kind==='hiit') set.add('h');
  }
  return set;
}

// Date helpers
function hiNow(){ return new Date(); }
function hiStartOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function hiDaysBetween(a,b){ return Math.round((hiStartOfDay(a)-hiStartOfDay(b))/86400000); }
function hiRelDate(iso){
  const d=new Date(iso); const diff=hiDaysBetween(hiNow(),d);
  if(diff===0) return 'Today';
  if(diff===1) return 'Yesterday';
  return HI_DOWS[d.getDay()]+' '+d.getDate()+' '+HI_MONTHS[d.getMonth()];
}
function hiAbsDate(iso){
  const d=new Date(iso);
  return HI_DOWS[d.getDay()]+' '+d.getDate()+' '+HI_MONTHS[d.getMonth()];
}
function hiTimeStr(iso){
  const d=new Date(iso); let h=d.getHours(), m=d.getMinutes();
  const ap=h>=12?'PM':'AM'; h=h%12; if(h===0)h=12;
  return h+':'+(m<10?'0':'')+m+' '+ap;
}
function hiWeekStart(d){ const x=new Date(d); x.setDate(x.getDate()-x.getDay()); x.setHours(0,0,0,0); return x; }
function hiWeekLabel(d){
  const s=hiWeekStart(d); const e=new Date(s); e.setDate(e.getDate()+6);
  if(s.getMonth()===e.getMonth()) return `Week of ${HI_MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
  return `Week of ${HI_MONTHS[s.getMonth()]} ${s.getDate()} – ${HI_MONTHS[e.getMonth()]} ${e.getDate()}`;
}
// Day name from a session record (the frozen dayLabel, plus titleHtml if we can find the day)
function hiSessionTitleHtml(rec){
  // Prefer the live day's titleHtml if dayExId resolves; else fall back to dayLabel text.
  if(rec.dayExId){
    const d=DAYS.find(x=>(x.dayExId||x.label)===rec.dayExId);
    if(d&&d.titleHtml) return d.titleHtml.replace('<br>',' ');
  }
  return rec.dayLabel||'Session';
}
function hiSessionName(rec){ return rec.dayLabel || hiSessionTitleHtml(rec) || 'Session'; }

// Sorted copy of HISTORY, newest first.
function hiSorted(){
  return (Array.isArray(HISTORY)?HISTORY.slice():[]).sort((a,b)=> new Date(b.date)-new Date(a.date));
}

// ── Top-level render ──
function hiRender(){
  const root=document.getElementById('histView');
  if(!root) return;
  if(hiDetailId){ hiRenderDetail(root); return; }
  if(hiMode==='calendar'){ hiRenderCalendar(root); }
  else { hiRenderList(root); }
}

function hiHeaderHtml(sub){
  return `<div class="hi-hdr">
    <div class="hi-hdr-main">
      <div class="hi-hdr-title">His<em>tory</em></div>
      <div style="display:flex;align-items:flex-end;gap:10px">
        <div class="hi-hdr-sub">${sub}</div>
        <div class="hi-hdr-gear" onclick="openSettings()" aria-label="Settings"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="3.2"/><path d="M11 2.8v2.4M11 16.8v2.4M2.8 11h2.4M16.8 11h2.4M5.2 5.2l1.7 1.7M15.1 15.1l1.7 1.7M16.8 5.2l-1.7 1.7M6.9 15.1l-1.7 1.7"/></svg></div>
      </div>
    </div>
    <div class="hi-mode-toggle">
      <div class="hi-mode-opt ${hiMode==='list'?'active':''}" onclick="hiSetMode('list')">List</div>
      <div class="hi-mode-opt ${hiMode==='calendar'?'active':''}" onclick="hiSetMode('calendar')">Calendar</div>
    </div>
  </div>`;
}

function hiSetMode(mode){
  if(hiMode===mode) return;
  hiMode=mode;
  hiExpandedId=null;
  hiRender();
}

// ── Empty state ──
function hiEmptyHtml(){
  return `<div class="hi-empty">
    <div class="hi-empty-icon"><svg viewBox="0 0 24 24"><polyline points="20 11 15 11 12 18 10 4 8 11 2 11"/></svg></div>
    <div class="hi-empty-title">No sessions yet</div>
    <div class="hi-empty-sub">Log a workout from Today and it'll appear here — every session, kept and searchable.</div>
  </div>`;
}

// ── LIST view ──
function hiRenderList(root){
  const recs=hiSorted();
  const sub=recs.length+' session'+(recs.length===1?'':'s')+' · v'+GAINS_VERSION;
  let body='';
  if(recs.length===0){
    body=hiEmptyHtml();
  } else {
    let lastWk=null;
    recs.forEach(rec=>{
      const wk=hiWeekStart(rec.date).getTime();
      if(wk!==lastWk){
        const n=recs.filter(r=>hiWeekStart(r.date).getTime()===wk).length;
        body+=`<div class="hi-week-sep"><span>${hiWeekLabel(rec.date)}</span><span class="wk-n">${n} session${n===1?'':'s'}</span></div>`;
        lastWk=wk;
      }
      body+=hiListItemHtml(rec);
    });
  }
  root.innerHTML=hiHeaderHtml(sub)+`<div class="hi-scroll">${body}</div>`;
}

function hiListItemHtml(rec){
  const mods=hiSessionMods(rec);
  const pips=['s','c','h'].map(m=>`<span class="hi-pip ${mods.has(m)?m:''}"></span>`).join('');
  const expanded=(rec.id===hiExpandedId);
  // Primary metrics depend on what the session contains.
  const hasStrength=mods.has('s');
  const hasCardio=mods.has('c');
  const hasHiit=mods.has('h');
  let m1='',m2='';
  if(hasStrength){
    // Panel resolution: lead with SETS, not volume-load. Bodyweight folds full
    // bodyweight into volume (73kg×reps), inflating calisthenics-heavy sessions
    // into illegible, cross-modality-incomparable totals. Sets are the honest,
    // legible programming currency. Secondary = work/total time.
    const sets=hiSessionSets(rec), ws=hiSessionWorkSec(rec);
    m1=`<div class="hi-metric ${sets>0?'':'empty'}"><span class="hi-metric-v">${sets>0?sets:'—'}</span><span class="hi-metric-l">${sets===1?'set':'sets'}</span></div>`;
    m2 = ws>0
      ? `<div class="hi-metric"><span class="hi-metric-v">${hiFmtMS(ws)}</span><span class="hi-metric-l">time</span></div>`
      : '';
  } else if(hasCardio && !hasHiit){
    // cardio-only: lead with time
    const ws=hiSessionWorkSec(rec);
    m1=`<div class="hi-metric"><span class="hi-metric-v dist">${hiFmtMS(ws)||'—'}</span><span class="hi-metric-l">time</span></div>`;
    m2='';
  } else if(hasHiit){
    // intervals present (and no strength): work time + effort (or —)
    const ws=hiSessionWorkSec(rec);
    m1=`<div class="hi-metric"><span class="hi-metric-v sage">${hiFmtMS(ws)||'—'}</span><span class="hi-metric-l">work time</span></div>`;
    m2='';
  }
  let expandBody='';
  if(expanded){ expandBody=hiExpandBodyHtml(rec); }
  return `<div class="hi-item ${expanded?'expanded':''}" data-sid="${rec.id}">
    <div class="hi-row" onclick="hiToggleExpand('${rec.id}')">
      <div class="hi-pips">${pips}</div>
      <div class="hi-datename">
        <div class="hi-date">${hiAbsDate(rec.date)}</div>
        <div class="hi-name">${hiEscape(hiSessionName(rec))}</div>
      </div>
      <div class="hi-metrics">${m1}${m2}</div>
      <div class="hi-chev">›</div>
    </div>
    <div class="hi-expand">${expandBody}</div>
  </div>`;
}

function hiToggleExpand(sid){
  hiExpandedId = (hiExpandedId===sid) ? null : sid;
  hiRender();
}

// Inline breakdown body (summary, not per-set). "Full detail" button drills deeper.
function hiExpandBodyHtml(rec){
  const sets=hiSessionSets(rec), ws=hiSessionWorkSec(rec);
  const mods=hiSessionMods(rec);
  // Session rollup strip: SETS (lead) + work time. Volume is intentionally NOT
  // shown at the session level — hiSessionVolume folds full bodyweight into
  // calisthenics (73kg×reps) and sums dimensionally-incomparable tonnage across
  // lifts, producing an illegible, dishonest headline (a push-up day would read
  // as "more volume" than a heavy bench day). Sets are the honest programming
  // currency. Loaded-lift volume returns per-exercise in the rows below. This
  // now matches renderPostSession and the collapsed card headline.
  let stats=`<div class="hi-eb-stat"><div class="hi-eb-stat-v acc">${sets>0?sets:'—'}</div><div class="hi-eb-stat-l">${sets===1?'set':'sets'}</div></div>`;
  stats+=`<div class="hi-eb-stat"><div class="hi-eb-stat-v">${hiFmtMS(ws)||'—'}</div><div class="hi-eb-stat-l">work time</div></div>`;
  let exHtml='';
  for(const e of (rec.entries||[])){
    exHtml+=hiExpandExRow(e);
  }
  return `<div class="hi-expand-inner">
    <div class="hi-eb-stats">${stats}</div>
    ${exHtml}
    ${wsCompareCardHtml(rec)}
    <button class="hi-eb-full" onclick="hiOpenDetail('${rec.id}','list')">
      <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5"/><line x1="7" y1="4.5" x2="7" y2="7.5"/></svg>
      Full detail &amp; per-set view →
    </button>
    <button class="hi-eb-fix" onclick="wsFixSession('${rec.id}')"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9.2 2.6a2.6 2.6 0 0 0 3.3 3.3l-6 6-2.4.7.7-2.4z" stroke-linejoin="round"/></svg> Fix this session</button>
  </div>`;
}

function hiExpandExRow(e){
  const kindCls = (e.kind==='weighted'||e.kind==='bodyweight')?'strength' : e.kind==='cardio'?'cardio':'hiit';
  const kindLbl = e.kind==='weighted'?'Weighted' : e.kind==='bodyweight'?'Bodyweight' : e.kind==='cardio'?(e.cardio&&e.cardio.cardioKind==='distance'?'Distance':'Time') : 'Intervals';
  let metrics='';
  if(e.kind==='weighted'||e.kind==='bodyweight'){
    const sets=hiEntrySetCount(e), top=hiEntryTopLoad(e);
    if(e.kind==='weighted'){
      // Loaded lift: volume-load is meaningful here. Lead with sets, then volume.
      const vol=hiEntryVolume(e);
      metrics=`<div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v acc">${sets}</span><span class="hi-eb-ex-metric-l">${sets===1?'set':'sets'}</span></div>
               <div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v">${top} kg</span><span class="hi-eb-ex-metric-l">top set</span></div>`;
    } else {
      // Bodyweight: volume folds in bodyweight (inflated/illegible) — show sets +
      // top reps instead. Added load (offset) shown when present.
      const topReps=hiEntryTopReps?hiEntryTopReps(e):null;
      const off=hiEntryTopOffset?hiEntryTopOffset(e):0;
      const second = off>0 ? `+${off} kg` : (topReps?`${topReps} reps`:'bodyweight');
      metrics=`<div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v acc">${sets}</span><span class="hi-eb-ex-metric-l">${sets===1?'set':'sets'}</span></div>
               <div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v">${second}</span><span class="hi-eb-ex-metric-l">${off>0?'added':'load'}</span></div>`;
    }
  } else if(e.kind==='cardio'){
    const c=e.cardio||{};
    const dur=hiFmtMS(c.durationSec), dist=hiFmtDist(c.distanceM);
    metrics=`<div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v dist">${dur||'—'}</span><span class="hi-eb-ex-metric-l">duration</span></div>`;
    if(dist) metrics+=`<div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v">${dist}</span><span class="hi-eb-ex-metric-l">distance</span></div>`;
    else if(c.intensityTag) metrics+=`<div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v">${c.intensityTag}</span><span class="hi-eb-ex-metric-l">intensity</span></div>`;
  } else if(e.kind==='hiit'){
    const h=e.hiit||{};
    metrics=`<div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v sage">${h.roundsDone||0}/${h.roundsPlanned||0}</span><span class="hi-eb-ex-metric-l">rounds</span></div>
             <div class="hi-eb-ex-metric"><span class="hi-eb-ex-metric-v">${hiFmtMS(h.workSecTotal)||'—'}</span><span class="hi-eb-ex-metric-l">work time</span></div>`;
  }
  // Effort score chip if score enabled and this entry has it
  let effortChip='';
  if(hiScoreEnabled()){
    const r=hiEntryRpe(e);
    if(r!=null) effortChip=`<span class="hi-eb-ex-effort">Effort ${r}/10</span>`;
  }
  return `<div class="hi-eb-ex ${kindCls}">
    <div class="hi-eb-ex-top"><span class="hi-eb-ex-namewrap">${(()=>{const p=wsExDisplayParts(e);return `<span class="hi-eb-ex-name">${hiEscape(p.title)}</span>${p.subtitle?`<span class="hi-eb-ex-sub">${hiEscape(p.subtitle)}</span>`:''}`;})()}</span><span class="hi-eb-ex-kind">${kindLbl}</span></div>
    <div class="hi-eb-ex-metrics">${metrics}${effortChip}</div>
  </div>`;
}

// ── CALENDAR view ──
function hiCalInit(){
  // Anchor = the OLDER of the two visible months. Default: previous month so
  // the current month is the second (lower) of the pair, matching "recent at
  // bottom, scroll up for older" expectation. We show [anchor, anchor+1].
  if(!hiCalAnchor){
    const n=hiNow();
    hiCalAnchor=new Date(n.getFullYear(), n.getMonth()-1, 1);
  }
}
function hiRenderCalendar(root){
  hiCalInit();
  const a=hiCalAnchor;                       // older month
  const b=new Date(a.getFullYear(), a.getMonth()+1, 1); // newer month
  // Range label, handling year spans
  let rangeLabel;
  if(a.getFullYear()===b.getFullYear()){
    rangeLabel=`${HI_MONTHS[a.getMonth()]} – ${HI_MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  } else {
    rangeLabel=`${HI_MONTHS[a.getMonth()]} ${a.getFullYear()} – ${HI_MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  // Forward arrow disabled if newer month is the current month or later.
  const n=hiNow();
  const curMonthStart=new Date(n.getFullYear(), n.getMonth(), 1);
  const fwdDisabled = b.getTime() >= curMonthStart.getTime();
  // Back arrow disabled if there's no history older than the older month.
  const recs=hiSorted();
  let oldestTime=Infinity;
  recs.forEach(r=>{ const t=new Date(r.date).getTime(); if(t<oldestTime) oldestTime=t; });
  const olderMonthEnd=new Date(a.getFullYear(), a.getMonth(), 1).getTime();
  const backDisabled = recs.length===0 || oldestTime>=olderMonthEnd;
  // "Jump to today" hidden when current month already visible.
  const todayVisible = fwdDisabled; // if forward disabled, newer month is current
  const sub=rangeLabel;
  const navHtml=`<div class="hi-cal-nav">
    <div class="hi-cal-arrow ${backDisabled?'disabled':''}" onclick="hiCalPage(-1)"><svg viewBox="0 0 16 16"><polyline points="10 3 5 8 10 13"/></svg></div>
    <div class="hi-cal-mid">
      <div class="hi-cal-range">${rangeLabel}</div>
      <span class="hi-cal-today ${todayVisible?'hidden':''}" onclick="hiCalJumpToday()">‹ Jump to today</span>
    </div>
    <div class="hi-cal-arrow ${fwdDisabled?'disabled':''}" onclick="hiCalPage(1)"><svg viewBox="0 0 16 16"><polyline points="6 3 11 8 6 13"/></svg></div>
  </div>`;
  const body = recs.length===0
    ? hiEmptyHtml()
    : navHtml + hiCalMonthHtml(b) + hiCalMonthHtml(a) + hiCalLegendHtml();
  root.innerHTML=hiHeaderHtml(sub)+`<div class="hi-scroll">${body}</div>`;
}

function hiCalMonthHtml(monthDate){
  const yr=monthDate.getFullYear(), mo=monthDate.getMonth();
  const recs=hiSorted();
  // Index sessions by day within this month
  const byDay={};
  recs.forEach(r=>{
    const d=new Date(r.date);
    if(d.getFullYear()===yr && d.getMonth()===mo){
      const k=d.getDate();
      if(!byDay[k]) byDay[k]=[];
      byDay[k].push(r);
    }
  });
  const n=hiNow();
  const startDow=new Date(yr,mo,1).getDay();
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  let cells='';
  HI_DOWS.forEach(dn=>{ cells+=`<div class="hi-cal-dow">${dn[0]}</div>`; });
  for(let i=0;i<startDow;i++) cells+=`<div class="hi-cal-cell empty"></div>`;
  for(let day=1;day<=daysInMonth;day++){
    const isToday = (yr===n.getFullYear() && mo===n.getMonth() && day===n.getDate());
    const future = new Date(yr,mo,day) > hiStartOfDay(n);
    const dayRecs=byDay[day];
    if(dayRecs && dayRecs.length){
      // Aggregate modalities across all sessions that day
      const mset=new Set();
      dayRecs.forEach(r=>{ hiSessionMods(r).forEach(m=>mset.add(m)); });
      const dots=['s','c','h'].filter(m=>mset.has(m)).map(m=>`<span class="hi-cal-dot ${m}"></span>`).join('');
      // Tapping jumps straight to that day's session detail (first session if multiple)
      const sid=dayRecs[0].id;
      cells+=`<div class="hi-cal-cell logged ${isToday?'today':''}" onclick="hiOpenDetail('${sid}','calendar')">
        <span class="hi-cal-daynum">${day}</span><div class="hi-cal-dots">${dots}</div></div>`;
    } else if(future){
      cells+=`<div class="hi-cal-cell empty"></div>`;
    } else {
      cells+=`<div class="hi-cal-cell rest ${isToday?'today':''}"><span class="hi-cal-daynum">${day}</span></div>`;
    }
  }
  const sessCount=Object.values(byDay).reduce((s,arr)=>s+arr.length,0);
  return `<div class="hi-cal-month">
    <div class="hi-cal-mlabel"><span>${HI_MONTHS[mo]} ${yr}</span><span class="cm-n"><b>${sessCount}</b> session${sessCount===1?'':'s'}</span></div>
    <div class="hi-cal-grid">${cells}</div>
  </div>`;
}
function hiCalLegendHtml(){
  return `<div class="hi-cal-legend">
    <div class="hi-cal-legend-item"><span class="hi-cal-legend-dot" style="background:var(--acc)"></span>Strength</div>
    <div class="hi-cal-legend-item"><span class="hi-cal-legend-dot" style="background:var(--dist)"></span>Cardio</div>
    <div class="hi-cal-legend-item"><span class="hi-cal-legend-dot" style="background:var(--hiit)"></span>Intervals</div>
  </div>`;
}
function hiCalPage(dir){
  hiCalInit();
  hiCalAnchor=new Date(hiCalAnchor.getFullYear(), hiCalAnchor.getMonth()+dir, 1);
  hiRender();
}
function hiCalJumpToday(){
  const n=hiNow();
  hiCalAnchor=new Date(n.getFullYear(), n.getMonth()-1, 1);
  hiRender();
}

// ── DETAIL view ──
function hiOpenDetail(sid,origin){
  hiDetailId=sid;
  hiDetailOrigin=origin||'list';
  hiEditing=false;
  hiRender();
}
function hiCloseDetail(){
  hiDetailId=null;
  hiEditing=false;
  // Return to the view we came from
  if(hiDetailOrigin==='calendar') hiMode='calendar';
  else hiMode='list';
  hiRender();
}
function hiToggleEdit(){
  if(hiEditing){
    // Save: commit edits from inputs back into the record, then exit edit mode.
    hiCommitEdits();
    hiEditing=false;
    hiRender();
    hiShowSaveToast();
  } else {
    hiEditing=true;
    hiRender();
  }
}

function hiFindRec(sid){ return (HISTORY||[]).find(r=>r.id===sid); }

function hiRenderDetail(root){
  const rec=hiFindRec(hiDetailId);
  if(!rec){ hiCloseDetail(); return; }
  const vol=hiSessionVolume(rec), sets=hiSessionSets(rec), ws=hiSessionWorkSec(rec);

  // Date lead: relative if recent, absolute otherwise (handled by hiRelDate)
  const rel=hiRelDate(rec.date);
  const isRecent = (rel==='Today'||rel==='Yesterday');
  const dateLead = isRecent
    ? `${hiAbsDate(rec.date)} · <span class="rel">${rel}</span>`
    : `<span class="rel">${hiAbsDate(rec.date)}</span> · ${hiTimeStr(rec.date)}`;
  // Stat strip
  // Strip keeps volume + sets + work time. Session-level effort retired —
  // per-exercise Effort N/10 lives on each exercise block below.
  let stats=`<div class="hi-dt-stat"><div class="hi-dt-stat-v acc">${vol>0?hiFmtKg(vol):'—'}</div><div class="hi-dt-stat-l">kg volume</div></div>`;
  stats+=`<div class="hi-dt-stat"><div class="hi-dt-stat-v">${sets>0?sets:'—'}</div><div class="hi-dt-stat-l">sets</div></div>`;
  stats+=`<div class="hi-dt-stat"><div class="hi-dt-stat-v">${hiFmtMS(ws)||'—'}</div><div class="hi-dt-stat-l">work time</div></div>`;
  // Session-level effort explainer retired with the metric itself.
  let explain='';
  let exHtml='';
  (rec.entries||[]).forEach((e,ei)=>{ exHtml+=hiDetailExBlock(e,ei); });

  const editLabel = hiEditing ? 'Save' : 'Edit';
  const editIcon = hiEditing
    ? `<svg viewBox="0 0 14 14"><polyline points="2 7 6 11 12 3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 14 14"><path d="M9 2l3 3-7 7-3.5.5.5-3.5z"/></svg>`;

  root.innerHTML=`
    <div class="hi-detail-hdr">
      <div class="hi-dt-back">
        <div class="hi-dt-back-left" onclick="hiCloseDetail()"><svg viewBox="0 0 16 16"><polyline points="10 3 5 8 10 13"/></svg><span>${hiDetailOrigin==='calendar'?'Calendar':'History'}</span></div>
        <div class="hi-dt-edit ${hiEditing?'editing':''}" onclick="hiToggleEdit()">${editIcon}${editLabel}</div>
      </div>
      <div class="hi-dt-datelead">${dateLead}</div>
      <div class="hi-dt-titlerow"><div class="hi-dt-day">${hiEscape(hiSessionName(rec))}</div></div>
    </div>
    <div class="hi-dt-stats">${stats}</div>
    <div class="hi-dt-scroll">${explain}${exHtml}</div>
  `;
}

function hiDetailExBlock(e,ei){
  const kindCls = (e.kind==='weighted'||e.kind==='bodyweight')?'strength' : e.kind==='cardio'?'cardio':'hiit';
  const kindLbl = e.kind==='weighted'?'Weighted' : e.kind==='bodyweight'?'Bodyweight' : e.kind==='cardio'?(e.cardio&&e.cardio.cardioKind==='distance'?'Distance':'Time') : 'Intervals';
  let bodyHtml='';
  if(e.kind==='weighted'||e.kind==='bodyweight'){
    bodyHtml=hiDetailStrengthBody(e,ei);
  } else if(e.kind==='cardio'){
    bodyHtml=hiDetailCardioBody(e,ei);
  } else if(e.kind==='hiit'){
    bodyHtml=hiDetailHiitBody(e,ei);
  }
  return `<div class="hi-exblock">
    <div class="hi-exhead ${kindCls}"><span class="hi-exname">${hiEscape(e.name||'')}</span><span class="hi-exkind">${kindLbl}</span></div>
    ${bodyHtml}
  </div>`;
}

function hiDetailStrengthBody(e,ei){
  const isBw=(e.kind==='bodyweight');
  let rows='';
  (e.sets||[]).forEach((s,si)=>{
    if(s.completed===false) return;
    const vol=hiSetVolume(s);
    let line;
    if(isBw){
      const off=(typeof s.offsetKg==='number')?s.offsetKg:0;
      const bw=(typeof s.bodyweightKg==='number')?s.bodyweightKg:0;
      const total=Math.max(0,bw+off);
      const offTag = off>0 ? `<span class="hi-setoff added">+${off}</span>`
                   : off<0 ? `<span class="hi-setoff assisted">${off}</span>`
                   : `<span class="hi-setoff neutral">BW</span>`;
      if(hiEditing){
        line=`<span class="hi-setnum">${si+1}</span><input class="hi-setinput" inputmode="decimal" data-ei="${ei}" data-si="${si}" data-field="offsetKg" value="${off}"><span class="x">→</span><input class="hi-setinput" inputmode="numeric" data-ei="${ei}" data-si="${si}" data-field="reps" value="${s.reps||0}"><span class="hi-setvol">${hiFmtKg(vol)} kg</span>`;
      } else {
        line=`<span class="hi-setnum">${si+1}</span><span class="hi-setwr">${total}<span class="u">kg</span><span class="x">×</span>${s.reps||0}<span class="u">reps</span></span>${offTag}<span class="hi-setvol">${hiFmtKg(vol)} kg</span>`;
      }
    } else {
      const w=(typeof s.weightKg==='number')?s.weightKg:0;
      if(hiEditing){
        line=`<span class="hi-setnum">${si+1}</span><input class="hi-setinput" inputmode="decimal" data-ei="${ei}" data-si="${si}" data-field="weightKg" value="${w}"><span class="x">×</span><input class="hi-setinput" inputmode="numeric" data-ei="${ei}" data-si="${si}" data-field="reps" value="${s.reps||0}"><span class="hi-setvol">${hiFmtKg(vol)} kg</span>`;
      } else {
        line=`<span class="hi-setnum">${si+1}</span><span class="hi-setwr">${w}<span class="u">kg</span><span class="x">×</span>${s.reps||0}<span class="u">reps</span></span><span class="hi-setvol">${hiFmtKg(vol)} kg</span>`;
      }
    }
    rows+=`<div class="hi-setline">${line}</div>`;
  });
  const vol=hiEntryVolume(e), top=hiEntryTopLoad(e), reps=hiEntryReps(e);
  let foot=`<span>vol <span class="ef-v acc">${hiFmtKg(vol)} kg</span></span>`;
  foot+= isBw ? `<span>BW <span class="ef-v">${e.sets&&e.sets[0]&&e.sets[0].bodyweightKg?e.sets[0].bodyweightKg:'—'} kg</span></span>`
              : `<span>top <span class="ef-v">${top} kg</span></span>`;
  foot+=`<span><span class="ef-v">${reps}</span> total reps</span>`;
  // Effort score / RPE pill in footer when score enabled
  if(hiScoreEnabled()){
    const r=hiEntryRpe(e);
    if(r!=null) foot+=`<span class="ef-effort">Effort ${r}/10</span>`;
    else if(hiEntrySetCount(e)>0 && !hiEditing) foot+=`<span class="hi-rpe-pill" onclick="hiRatePrompt(${ei})"><svg viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/></svg>Rate RPE</span>`;
  }
  let rpeEditRow='';
  if(hiEditing){
    const rpe=hiEntryRpe(e);
    rpeEditRow=`<div class="hi-rpe-row"><span class="hi-rpe-label">RPE</span><input class="hi-rpe-input" data-ei="${ei}" data-field="rpe" value="${rpe!=null?rpe:''}" placeholder="–"><span class="hi-rpe-hint">how hard did it feel? · 1–10</span></div>
      <div class="hi-note-row"><textarea class="hi-note-input" data-ei="${ei}" data-field="note" rows="1" placeholder="Note (optional)">${hiEscape(e.note||'')}</textarea></div>`;
  }
  return `<div class="hi-settable">${rows}</div><div class="hi-exfoot">${foot}</div>${rpeEditRow}`;
}

function hiDetailCardioBody(e,ei){
  const c=e.cardio||{};
  const dur=hiFmtMS(c.durationSec), dist=hiFmtDist(c.distanceM), pc=hiPace(c.durationSec,c.distanceM);
  let cells='';
  if(dur) cells+=`<div class="hi-cardio-cell"><div class="hi-cardio-v">${dur}</div><div class="hi-cardio-l">Duration</div></div>`;
  if(dist) cells+=`<div class="hi-cardio-cell"><div class="hi-cardio-v dist">${dist}</div><div class="hi-cardio-l">Distance</div></div>`;
  if(pc) cells+=`<div class="hi-cardio-cell"><div class="hi-cardio-v">${pc}</div><div class="hi-cardio-l">min/km</div></div>`;
  if(c.intensityTag) cells+=`<div class="hi-cardio-cell"><div class="hi-cardio-v" style="font-size:18px">${c.intensityTag}</div><div class="hi-cardio-l">Intensity</div></div>`;
  let extra='';
  if(hiScoreEnabled()){
    const r=hiEntryRpe(e);
    if(r!=null) extra=`<div style="padding:10px 14px"><span class="hi-effort-chip">Effort ${r}/10</span></div>`;
    else if(!hiEditing) extra=`<div style="padding:10px 14px"><span class="hi-rpe-pill" onclick="hiRatePrompt(${ei})"><svg viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/></svg>Rate RPE</span></div>`;
  }
  let rpeEditRow='';
  if(hiEditing){
    const rpe=hiEntryRpe(e);
    rpeEditRow=`<div class="hi-rpe-row"><span class="hi-rpe-label">RPE</span><input class="hi-rpe-input" data-ei="${ei}" data-field="rpe" value="${rpe!=null?rpe:''}" placeholder="–"><span class="hi-rpe-hint">1–10</span></div>`;
  }
  return `<div class="hi-cardio-body">${cells}</div>${extra}${rpeEditRow}`;
}

function hiDetailHiitBody(e,ei){
  const h=e.hiit||{};
  // Build the segment bar from the circuit definition, colored by phase.
  // We reconstruct planned segments: optional setup, then per round work/rest.
  const segs=[];
  if(h.setupSec) segs.push({type:'setup'});
  const exs=Array.isArray(h.exercises)&&h.exercises.length?h.exercises:[{workSec:0,restSec:0}];
  const cycles=h.cycles||1;
  const exCount=exs.length;
  const totalRoundsPlanned=h.roundsPlanned||(exCount*cycles);
  for(let i=0;i<totalRoundsPlanned;i++){
    const def=exs[i%exCount];
    segs.push({type:'work'});
    if((def.restSec||0)>0 && i<totalRoundsPlanned-1) segs.push({type:'rest'});
  }
  const roundsDone=h.roundsDone||0;
  // Mark done: count work segments up to roundsDone as done (colored), rest follow.
  let workSeen=0;
  const segHtml=segs.map(sg=>{
    if(sg.type==='setup') return `<div class="hi-hiit-seg setup"></div>`;
    if(sg.type==='work'){
      workSeen++;
      const done=workSeen<=roundsDone;
      return `<div class="hi-hiit-seg ${done?'work':'undone'}"></div>`;
    }
    // rest
    const done=workSeen<roundsDone || (workSeen<=roundsDone && workSeen>0);
    return `<div class="hi-hiit-seg ${done?'rest':'undone'}"></div>`;
  }).join('');
  // Circuit definition line: work time in ember
  const circuit=(exs||[]).map(x=>`<span class="ce">${hiEscape(x.name||'')}</span> <span class="cw">${x.workSec||0}s</span>/${x.restSec||0}s`).join(' · ');
  let chip='';
  if(hiScoreEnabled()){
    const r=hiEntryRpe(e);
    if(r!=null) chip=`<span class="hi-effort-chip">Effort ${r}/10</span>`;
    else if(!hiEditing) chip=`<span class="hi-rpe-pill" style="margin-left:0" onclick="hiRatePrompt(${ei})"><svg viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/></svg>Rate RPE</span>`;
  }
  let rpeEditRow='';
  if(hiEditing){
    const rpe=hiEntryRpe(e);
    rpeEditRow=`<div class="hi-rpe-row" style="margin-top:10px;border-radius:8px"><span class="hi-rpe-label">RPE</span><input class="hi-rpe-input" data-ei="${ei}" data-field="rpe" value="${rpe!=null?rpe:''}" placeholder="–"><span class="hi-rpe-hint">peak effort · 1–10</span></div>`;
  }
  return `<div class="hi-hiit-body">
    <div class="hi-hiit-bar">${segHtml}</div>
    <div class="hi-hiit-stats">
      <span><span class="hv">${roundsDone}/${h.roundsPlanned||0}</span> rounds</span>
      <span><span class="hv">${hiFmtMS(h.workSecTotal)||'—'}</span> work time</span>
      ${h.restSecTotal?`<span><span class="hv">${hiFmtMS(h.restSecTotal)}</span> rest</span>`:''}
    </div>
    <div class="hi-hiit-circuit">${circuit}</div>
    ${chip?`<div style="margin-top:2px">${chip}</div>`:''}
    ${rpeEditRow}
  </div>`;
}

// Lightweight rate prompt: when not in edit mode, tapping a "Rate RPE" pill
// drops the user into edit mode (where the RPE field is available) rather
// than spawning a separate widget — one editor, multiple doorways.
function hiRatePrompt(ei){
  hiEditing=true;
  hiRender();
  // Focus the RPE input for that entry after render
  setTimeout(()=>{
    const inp=document.querySelector(`.hi-rpe-input[data-ei="${ei}"]`);
    if(inp) inp.focus();
  },60);
}

// Commit edits from the DOM inputs back into the record (performed data +
// RPE/notes). Mutates the SessionRecord in place; performed data is editable
// for corrections per the schema.
function hiCommitEdits(){
  const rec=hiFindRec(hiDetailId);
  if(!rec) return;
  // Set value inputs
  document.querySelectorAll('.hi-setinput').forEach(inp=>{
    const ei=parseInt(inp.dataset.ei,10), si=parseInt(inp.dataset.si,10), field=inp.dataset.field;
    const e=rec.entries[ei]; if(!e||!e.sets||!e.sets[si]) return;
    const raw=inp.value.trim();
    const num=field==='reps'?parseInt(raw,10):parseFloat(raw);
    // Clamp to non-negative — the live editor never allows below 0, and a
    // negative weight/rep count in HISTORY would silently corrupt every
    // derived metric (volume, est-1RM) that reads it.
    if(!isNaN(num)&&num>=0) e.sets[si][field]=num;
  });
  // RPE + note inputs
  document.querySelectorAll('.hi-rpe-input').forEach(inp=>{
    const ei=parseInt(inp.dataset.ei,10);
    const e=rec.entries[ei]; if(!e) return;
    const raw=inp.value.trim();
    if(raw===''){ // clearing RPE
      if(e.kind==='hiit'&&e.hiit) delete e.hiit.peakRpe; else delete e.rpe;
    } else {
      const n=parseInt(raw,10);
      if(!isNaN(n)&&n>=1&&n<=10){
        if(e.kind==='hiit'){ if(!e.hiit)e.hiit={}; e.hiit.peakRpe=n; }
        else e.rpe=n;
      }
    }
  });
  document.querySelectorAll('.hi-note-input').forEach(inp=>{
    const ei=parseInt(inp.dataset.ei,10);
    const e=rec.entries[ei]; if(!e) return;
    const v=inp.value.trim();
    if(v) e.note=v; else delete e.note;
  });
  rec.edited=true;
  wsPersistSave();
}

function hiShowSaveToast(){
  const root=document.getElementById('histView');
  if(!root) return;
  let toast=document.getElementById('hiSaveToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='hiSaveToast';
    toast.className='hi-save-toast';
    toast.textContent='✓ Saved';
    document.getElementById('app').appendChild(toast);
  }
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),1600);
}
