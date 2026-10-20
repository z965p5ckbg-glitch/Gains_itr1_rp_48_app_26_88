const WS_LOG_MOVE_SAMPLE=4; // record every Nth move event (rest are skipped to keep log readable)
let wsLog=[];
let wsLogStartTime=0;
let wsLogMoveCounter=0;
let wsLogLastMode=null;
let wsLogLastZone=null;
let wsLogLastIdx=null;
let wsLogLastScrollAct=0;
let wsLogLastScrollBank=0;

function wsLogClear(){
  wsLog=[];
  wsLogStartTime=Date.now();
  wsLogMoveCounter=0;
  wsLogLastMode=null;
  wsLogLastZone=null;
  wsLogLastIdx=null;
  wsLogLastScrollAct=0;
  wsLogLastScrollBank=0;
  wsLogErrorCount=0;
  wsLogLastCommit=null;
}

function wsLogPush(type,data){
  if(wsLog.length>=WS_LOG_CAPACITY) wsLog.shift();
  const ev={t:Date.now()-wsLogStartTime,type};
  if(data) Object.assign(ev,data);
  wsLog.push(ev);
  if(type==='error'||type==='unhandled_rejection') wsLogErrorCount++;
  // Update floating button count whenever an event is added
  if(typeof dbgUpdateFloat==='function') dbgUpdateFloat();
}

// Snapshot key state. Called from each interesting moment.
function wsLogSnapshot(){
  if(!wsDragState) return null;
  const ar=document.getElementById('wsActiveRow');
  const br=document.getElementById('wsBankedRow');
  const ds=wsDragState;
  return {
    scrollEngaged:!!ds.scrollEngaged,
    zone:ds.dropZone||null,
    idx:ds.dropIndex==null?null:ds.dropIndex,
    x:Math.round(ds.currentX),
    y:Math.round(ds.currentY),
    edge:ds.dwellEdge||null,
    dwell:ds.dwellStart?(Date.now()-ds.dwellStart):0,
    actSL:ar?Math.round(ar.scrollLeft):null,
    actMax:ar?Math.round(ar.scrollWidth-ar.clientWidth):null,
    bankSL:br?Math.round(br.scrollLeft):null,
    bankMax:br?Math.round(br.scrollWidth-br.clientWidth):null,
    scrollTarget:ds.scrollTargetRow?ds.scrollTargetRow.id:null,
    vel:Math.round(ds.velocityPxPerSec||0),
    order:ds.dragOrder?ds.dragOrder.slice():null,
  };
}

// Detect & record state transitions automatically (mode, zone, idx changes)
let wsLogLastCommit=null;
function wsLogMaybeTransition(){
  if(!wsDragState) return;
  const ds=wsDragState;
  const engaged=!!ds.scrollEngaged;
  const zone=ds.dropZone||null;
  const idx=ds.dropIndex==null?null:ds.dropIndex;
  const lastEng=ds._lastLoggedEngaged;
  const lastZone=ds._lastLoggedZone;
  const lastIdx=ds._lastLoggedIdx;
  if(lastEng!==engaged){
    wsLogPush('scroll_change',{from:lastEng,to:engaged,...wsLogSnapshot()});
    ds._lastLoggedEngaged=engaged;
  }
  if(lastZone!==zone||lastIdx!==idx){
    wsLogPush('zone_change',{zoneTo:zone,idxTo:idx,...wsLogSnapshot()});
    ds._lastLoggedZone=zone;
    ds._lastLoggedIdx=idx;
  }
}

// Detect scroll deltas — if scrollLeft changed since last check, log it
function wsLogMaybeScroll(){
  const ar=document.getElementById('wsActiveRow');
  const br=document.getElementById('wsBankedRow');
  if(ar){
    const cur=ar.scrollLeft;
    if(cur!==wsLogLastScrollAct){
      wsLogPush('scroll_act',{from:wsLogLastScrollAct,to:cur,delta:cur-wsLogLastScrollAct});
      wsLogLastScrollAct=cur;
    }
  }
  if(br){
    const cur=br.scrollLeft;
    if(cur!==wsLogLastScrollBank){
      wsLogPush('scroll_bank',{from:wsLogLastScrollBank,to:cur,delta:cur-wsLogLastScrollBank});
      wsLogLastScrollBank=cur;
    }
  }
}

// Format the log as readable JSON for clipboard
function wsLogFormat(){
  const meta={
    capturedAt:new Date().toISOString(),
    duration:Date.now()-wsLogStartTime,
    eventCount:wsLog.length,
    daysCount:DAYS.length,
    activeCount:wsCountActive(),
    viewport:{w:window.innerWidth,h:window.innerHeight},
    constants:{
      WS_EDGE_ZONE_PX,WS_DWELL_MS,WS_SCROLL_SPEED,
      WS_LONG_PRESS_MS,WS_DRAG_MOVE_THRESHOLD,
    },
  };
  return JSON.stringify({meta,events:wsLog},null,2);
}

// Copy Log button handler
function wsCopyLog(){
  const text=wsLogFormat();
  const btn=document.getElementById('wsCopyLogBtn');
  function showCopied(){
    if(btn){
      btn.classList.add('copied');
      btn.textContent='✓ COPIED';
      setTimeout(()=>{
        if(btn){ btn.classList.remove('copied'); btn.textContent='COPY LOG'; }
      },1400);
    }
  }
  // Try modern clipboard API; fall back to textarea select+copy
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(showCopied).catch(()=>wsCopyLogFallback(text,showCopied));
  } else {
    wsCopyLogFallback(text,showCopied);
  }
}
function wsCopyLogFallback(text,onDone){
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.style.position='fixed'; ta.style.left='-9999px';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  ta.remove();
  if(onDone) onDone();
}

function wsClearLog(){
  wsLogClear();
  wsLogPush('manual_clear');
  const btn=document.getElementById('wsClearLogBtn');
  if(btn){
    btn.classList.add('copied');
    btn.textContent='✓ CLEARED';
    setTimeout(()=>{
      if(btn){ btn.classList.remove('copied'); btn.textContent='CLEAR'; }
    },800);
  }
}

// DEBUG: floating-button helpers — strip with the rest of the recorder for production
let dbgPanelOpen=false;
function dbgUpdateFloat(){
  const f=document.getElementById('dbgFloat');
  const c=document.getElementById('dbgCount');
  if(!f||!c) return;
  c.textContent=wsLog.length;
  if(wsLogErrorCount>0) f.classList.add('has-errors'); else f.classList.remove('has-errors');
  if(dbgPanelOpen) dbgRenderPanel();
}
function dbgRenderPanel(){
  const dur=Math.round((Date.now()-wsLogStartTime)/1000);
  const lastEv=wsLog.length?wsLog[wsLog.length-1]:null;
  const mode=wsDragState?(wsDragState.scrollEngaged?'scroll':'drag'):'—';
  const m=document.getElementById('dbgPanelCount'); if(m) m.textContent=wsLog.length;
  const e=document.getElementById('dbgPanelErrs'); if(e){
    e.textContent=wsLogErrorCount;
    e.classList.toggle('warn',wsLogErrorCount>0);
  }
  const dm=document.getElementById('dbgPanelMode'); if(dm) dm.textContent=mode;
  const dl=document.getElementById('dbgPanelLast'); if(dl) dl.textContent=lastEv?lastEv.type:'—';
  const dd=document.getElementById('dbgPanelDur'); if(dd) dd.textContent=dur+'s';
}
function dbgToggle(){
  dbgPanelOpen=!dbgPanelOpen;
  const p=document.getElementById('dbgPanel');
  if(!p) return;
  p.classList.toggle('visible',dbgPanelOpen);
  if(dbgPanelOpen) dbgRenderPanel();
}
function dbgCopy(){
  // Always show the modal — this is the most reliable export on iOS WebViews.
  // Programmatic clipboard often silently fails in non-HTTPS WebView contexts.
  const text=wsLogFormat();
  dbgShowExportModal(text);
}

// DEBUG: full-screen modal showing log JSON in a selectable textarea
function dbgShowExportModal(text){
  let modal=document.getElementById('dbgExportModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='dbgExportModal';
    modal.innerHTML=
      '<div class="dbg-export-sheet">'+
        '<div class="dbg-export-hdr">'+
          '<div class="dbg-export-title">Session Log</div>'+
          '<div class="dbg-export-subtitle" id="dbgExportSubtitle"></div>'+
        '</div>'+
        '<textarea class="dbg-export-text" id="dbgExportText" readonly></textarea>'+
        '<div class="dbg-export-actions">'+
          '<button class="dbg-export-btn dbg-export-copy" id="dbgExportCopyAll" onclick="dbgCopyAllFromModal()">COPY ALL</button>'+
          '<button class="dbg-export-btn dbg-export-close" onclick="dbgCloseExportModal()">CLOSE</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(modal);
  }
  const ta=modal.querySelector('#dbgExportText');
  ta.value=text;
  const sub=modal.querySelector('#dbgExportSubtitle');
  if(sub) sub.textContent=wsLog.length+' events · '+Math.round((Date.now()-wsLogStartTime)/1000)+'s · '+Math.round(text.length/1024)+'KB';
  modal.classList.add('open');
}

function dbgCloseExportModal(){
  const modal=document.getElementById('dbgExportModal');
  if(modal) modal.classList.remove('open');
}

function dbgCopyAllFromModal(){
  const ta=document.getElementById('dbgExportText');
  const btn=document.getElementById('dbgExportCopyAll');
  if(!ta) return;
  const flash=(label)=>{ if(btn){btn.classList.add('copied');btn.textContent=label;setTimeout(()=>{btn.classList.remove('copied');btn.textContent='COPY ALL';},1500);} };
  // Prefer the async Clipboard API — it does NOT require focusing/selecting the
  // textarea, which is what was triggering iOS's selection callout + zoom.
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(ta.value)
      .then(()=>flash('✓ COPIED'))
      .catch(()=>{
        // Legacy fallback: select + execCommand. Only here do we touch selection.
        try{
          ta.focus(); ta.setSelectionRange(0,ta.value.length);
          document.execCommand('copy');
          flash('✓ COPIED');
          // Drop the selection right away so iOS doesn't keep the zoom/callout up
          ta.blur(); window.getSelection&&window.getSelection().removeAllRanges&&window.getSelection().removeAllRanges();
        }catch(_){ flash('LONG-PRESS TEXT'); }
      });
    return;
  }
  // No async clipboard at all — legacy path
  try{
    ta.focus(); ta.setSelectionRange(0,ta.value.length);
    const ok=document.execCommand('copy');
    ta.blur(); window.getSelection&&window.getSelection().removeAllRanges&&window.getSelection().removeAllRanges();
    flash(ok?'✓ COPIED':'LONG-PRESS TEXT');
  }catch(_){ flash('LONG-PRESS TEXT'); }
}
function dbgClearLog(){
  wsLogClear();
  wsLogPush('manual_clear');
  dbgUpdateFloat();
  dbgRenderPanel();
  const btn=document.getElementById('dbgClearBtn');
  if(btn){
    btn.classList.add('copied');
    btn.textContent='✓ CLEARED';
    setTimeout(()=>{ if(btn){btn.classList.remove('copied'); btn.textContent='CLEAR';} },800);
  }
}

// DEBUG: app-wide error capture — strip with the rest of the recorder for production
window.addEventListener('error',function(e){
  wsLogPush('error',{
    message:e.message||String(e.error||''),
    file:e.filename,
    line:e.lineno,
    col:e.colno,
    stack:e.error&&e.error.stack?String(e.error.stack).split('\n').slice(0,5).join(' | '):null,
  });
});
window.addEventListener('unhandledrejection',function(e){
  wsLogPush('unhandled_rejection',{
    reason:e.reason?String(e.reason):'unknown',
  });
});

// DEBUG: helper to wrap a function so its calls are logged
function dbgWrap(fn,label){
  return function(){
    try{
      wsLogPush(label,{args:Array.from(arguments).slice(0,3).map(a=>{
        if(a==null) return a;
        if(typeof a==='object') return '[obj]';
        if(typeof a==='string'&&a.length>40) return a.slice(0,40)+'…';
        return a;
      })});
    }catch(_){}
    return fn.apply(this,arguments);
  };
}



// Detect which edge (if any) the finger is in; null when in central area.
function wsCurrentEdge(x){
  if(!wsDragState) return null;
  const ws=document.getElementById('workshopOverlay');
  const r=ws?ws.getBoundingClientRect():{left:0,right:window.innerWidth};
  if(x<r.left+WS_EDGE_ZONE_PX) return 'left';
  if(x>r.right-WS_EDGE_ZONE_PX) return 'right';
  return null;
}

// ─── DEBUG HUD ────────────────────────────────────────────────────────
// Temporary: shows live drag state. Remove once drag is dialled in.
function wsUpdateDebugHud(){
  const hud=document.getElementById('wsDebugHud');
  if(!hud) return;
  if(!wsDragState||!wsDragState.isDragging){
    // Keep HUD visible if there's a log worth copying — user can review then dismiss
    if(wsLog.length>0){
      hud.classList.add('visible');
      // Show a static "drag ended" view summarising what was captured
      const lastEv=wsLog[wsLog.length-1];
      hud.innerHTML=
        '<div><span class="lbl">last</span> <span class="val">'+(lastEv.type||'?')+'</span></div>'+
        '<div><span class="lbl">events</span> <span class="val">'+wsLog.length+'</span></div>'+
        '<div><span class="lbl">duration</span> <span class="val">'+(Date.now()-wsLogStartTime)+'ms</span></div>'+
        '<div class="ws-debug-hud-actions"><button class="ws-debug-btn" id="wsCopyLogBtn" onclick="wsCopyLog()">COPY LOG</button><button class="ws-debug-btn" id="wsClearLogBtn" onclick="wsClearLog()">CLEAR</button></div>';
      return;
    }
    hud.classList.remove('visible');
    return;
  }
  hud.classList.add('visible');
  const ds=wsDragState;
  const mode=ds.scrollEngaged?'scroll':'drag';
  const zone=ds.dropZone===null?'(none)':(ds.dropZone||'?');
  const idx=ds.dropIndex===null?'-':(ds.dropIndex===undefined?'?':ds.dropIndex);
  const x=Math.round(ds.currentX||0);
  const y=Math.round(ds.currentY||0);
  const edge=wsCurrentEdge(ds.currentX)||'(none)';
  const dwellMs=ds.dwellStart?(Date.now()-ds.dwellStart):0;
  const orderStr=ds.dragOrder?'['+ds.dragOrder.join(',')+']':'-';
  const vel=Math.round(ds.velocityPxPerSec||0);
  let activeRowId=document.getElementById('wsActiveRow');
  let bankedRowId=document.getElementById('wsBankedRow');
  let arSL=activeRowId?activeRowId.scrollLeft:'-';
  let brSL=bankedRowId?bankedRowId.scrollLeft:'-';
  let arSW=activeRowId?activeRowId.scrollWidth:'-';
  let arCW=activeRowId?activeRowId.clientWidth:'-';
  const modeClass=(mode==='scroll')?'val warn':'val';
  hud.innerHTML=
    '<div><span class="lbl">mode</span> <span class="'+modeClass+'">'+mode+'</span></div>'+
    '<div><span class="lbl">xy</span> <span class="val">'+x+','+y+'</span></div>'+
    '<div><span class="lbl">edge</span> <span class="val">'+edge+'</span></div>'+
    '<div><span class="lbl">dwell</span> <span class="val">'+dwellMs+'ms</span></div>'+
    '<div><span class="lbl">zone</span> <span class="val">'+zone+'</span></div>'+
    '<div><span class="lbl">idx</span> <span class="val">'+idx+'</span></div>'+
    '<div><span class="lbl">order</span> <span class="val">'+orderStr+'</span></div>'+
    '<div><span class="lbl">vel</span> <span class="val">'+vel+'</span></div>'+
    '<div><span class="lbl">act SL</span> <span class="val">'+arSL+'/'+(arSW-arCW>=0?arSW-arCW:0)+'</span></div>'+
    '<div><span class="lbl">bank SL</span> <span class="val">'+brSL+'</span></div>'+
    '<div><span class="lbl">log</span> <span class="val">'+wsLog.length+' ev</span></div>'+
    '<div class="ws-debug-hud-actions"><button class="ws-debug-btn" id="wsCopyLogBtn" onclick="wsCopyLog()">COPY LOG</button><button class="ws-debug-btn" id="wsClearLogBtn" onclick="wsClearLog()">CLEAR</button></div>';
}

// Update the scroll position indicator bar below the active row.
// Called each rAF frame when dragging; shows true position as virtual offset
// + real scrollLeft compose into a total position within scrollWidth.
function wsUpdateScrollBar(){
  const wrap=document.getElementById('wsScrollBar');
  const thumb=document.getElementById('wsScrollBarThumb');
  if(!wrap||!thumb) return;
  const ds=wsDragState;
  const engaged=ds&&ds.scrollEngaged;
  wrap.classList.toggle('visible',!!engaged);
  if(!engaged) return;
  const row=document.getElementById('wsActiveRow');
  if(!row) return;
  const total=row.scrollWidth;
  const visible=row.clientWidth;
  if(total<=visible){ wrap.classList.remove('visible'); return; }
  const virtualPos=(ds.baseScrollLeft||0)+(ds.transformOffset||0);
  const clampedPos=Math.max(0,Math.min(total-visible,virtualPos));
  const thumbWidthPct=visible/total*100;
  const thumbLeftPct=clampedPos/total*100;
  thumb.style.width=thumbWidthPct+'%';
  thumb.style.left=thumbLeftPct+'%';
}

// Update the visual progress indicator on the active edge.
function wsUpdateEdgeIndicator(edge,fillPct,scrolling){
  const left=document.getElementById('wsEdgeDwellLeft');
  const right=document.getElementById('wsEdgeDwellRight');
  const leftFill=document.getElementById('wsEdgeDwellLeftFill');
  const rightFill=document.getElementById('wsEdgeDwellRightFill');
  // Reset both first
  left.classList.remove('visible','scrolling');
  right.classList.remove('visible','scrolling');
  leftFill.style.height='0%';
  rightFill.style.height='0%';
  if(!edge) return;
  const target=edge==='left'?left:right;
  const targetFill=edge==='left'?leftFill:rightFill;
  target.classList.add('visible');
  if(scrolling){
    target.classList.add('scrolling');
  } else {
    targetFill.style.height=Math.round((fillPct||0)*100)+'%';
  }
}
