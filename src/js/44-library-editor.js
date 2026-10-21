
function wsLibOpenEditor(exId){
  const entry=EXERCISES.find(e=>e.exId===exId);
  if(!entry) return;
  wsLogPush('lib_open_editor',{exId});
  // Take a deep snapshot for the draft so edits don't touch the live
  // catalog entry until Save. originalSnapshot is kept for Cancel restore
  // (though for an existing entry we never overwrite without Save, so it's
  // mostly informational).
  wsLibEditCtx={
    scope:'library',
    exId,
    isNew:false,
    draft:wsLibCloneEntry(entry),
    originalSnapshot:wsLibCloneEntry(entry),
  };
  wsRenderLibEditor();
  document.getElementById('wsLibEditModal').classList.add('open');
}

function wsLibCreateNew(opts){
  // opts may include { fromDayIdx: number } to indicate the new entry should
  // also be added as an instance to that day on Save.
  opts=opts||{};
  wsLogPush('lib_create_new',{fromDayIdx:opts.fromDayIdx});
  const draft={
    exId:wsNewExId(),
    title:'',
    subtitle:'',
    kind:'weighted',
    defaults:{cue:'',rest:90,sets:[{w:0,r:8},{w:0,r:8},{w:0,r:8}]},
    muscles:[],
    pattern:'',
  };
  wsLibEditCtx={
    scope: opts.fromDayIdx!=null ? 'fromDay' : 'library',
    fromDayIdx: opts.fromDayIdx,
    exId:draft.exId,
    isNew:true,
    draft,
    originalSnapshot:null,
  };
  wsRenderLibEditor();
  document.getElementById('wsLibEditModal').classList.add('open');
  // Auto-focus the title field to get the user typing immediately.
  setTimeout(()=>{const f=document.getElementById('wsLeTitleInput');if(f)f.focus();},80);
}

// Open the editor for a day instance. Reuses the library editor sheet but
// in 'instance' mode: title is locked (changing it would diverge from the
// library group), subtitle and defaults are editable. Save writes back to
// the instance only — the catalog entry is untouched. No archive/duplicate
// (those make no sense for an instance).
function wsLibOpenInstanceEditor(dayIdx,list,origIdx){
  const day=DAYS[dayIdx];
  if(!day) return;
  const arr = list==='exercises' ? day.exercises : day.cardio;
  if(!arr || !arr[origIdx]) return;
  const inst=arr[origIdx];
  // Build a library-editor-shaped draft from the instance. Title and
  // subtitle come from the catalog entry (canonical); other fields come
  // from the instance (its current customized values).
  const cat=inst.exId?EXERCISES.find(e=>e.exId===inst.exId):null;
  const title = cat ? cat.title : (wsLibSplitNameForCatalog(inst.name||'').title || 'Exercise');
  // Subtitle priority: if the instance has its own _subtitle override, use that;
  // else use the catalog's subtitle.
  const subtitle = (inst._subtitle!=null) ? inst._subtitle : (cat ? cat.subtitle : (wsLibSplitNameForCatalog(inst.name||'').subtitle || ''));
  // Determine kind. Strength instances live in exercises[]; cardio
  // instances carry their own .kind field.
  let kind='weighted';
  if(list==='cardio'){
    const k=inst.kind;
    kind = k==='time' ? 'cardio_time'
         : k==='distance' ? 'cardio_distance'
         : k==='intervals' ? 'cardio_intervals'
         : 'cardio_time';
  }
  // Build defaults from the instance's current values.
  let defaults={};
  if(kind==='weighted'){
    defaults={
      cue:inst.cue||'',
      rest:inst.rest!=null?inst.rest:90,
      sets:(inst.sets||[]).map(s=>({w:s.w,r:s.r})),
    };
  } else if(kind==='cardio_time'){
    defaults={cue:inst.cue||'',duration:inst.duration||300,intensity:inst.intensity||'Mod'};
  } else if(kind==='cardio_distance'){
    defaults={cue:inst.cue||'',distance:inst.distance||5,duration:inst.duration||1800};
  } else if(kind==='cardio_intervals'){
    defaults={
      cue:inst.cue||'',
      workSec:inst.workSec||30,
      restSec:inst.restSec||15,
      totalRounds:inst.totalRounds||4,
      simpleMode:inst.simpleMode!==false,
      roundsCustom:(inst.roundsCustom||[]).map(r=>({name:r.name,work:r.work,rest:r.rest})),
    };
  }
  const draft={
    exId:inst.exId||null,
    title,
    subtitle,
    kind,
    defaults,
    muscles:cat ? (cat.muscles||[]).slice() : [],
    pattern:cat ? (cat.pattern||'') : '',
  };
  wsLibEditCtx={
    scope:'instance',
    instanceDayIdx:dayIdx,
    instanceList:list,
    instanceOrigIdx:origIdx,
    exId:draft.exId,
    isNew:false,
    draft,
    originalSnapshot:null,
  };
  wsLogPush('lib_open_instance',{dayIdx,list,origIdx});
  wsRenderLibEditor();
  document.getElementById('wsLibEditModal').classList.add('open');
}

// Deep-clone a catalog entry so the draft can be freely mutated.
function wsLibCloneEntry(e){
  const d=Object.assign({},e);
  d.defaults=Object.assign({},e.defaults||{});
  if(e.defaults&&Array.isArray(e.defaults.sets)){
    d.defaults.sets=e.defaults.sets.map(s=>({w:s.w,r:s.r}));
  }
  if(e.defaults&&Array.isArray(e.defaults.roundsCustom)){
    d.defaults.roundsCustom=e.defaults.roundsCustom.map(r=>({name:r.name,work:r.work,rest:r.rest}));
  }
  d.muscles=Array.isArray(e.muscles)?e.muscles.slice():[];
  d.pattern=e.pattern||'';
  return d;
}

// Find all days that reference this exId (used by usage list + delete safety).
function wsLibFindUsingDays(exId){
  const used=[];
  DAYS.forEach((day,i)=>{
    let hit=false;
    if(Array.isArray(day.items)){
      for(const inst of day.items){ if(inst.exId===exId){hit=true;break;} }
    } else {
      // Defensive fallback for unmigrated days
      for(const inst of (day.exercises||[])){ if(inst.exId===exId){hit=true;break;} }
      if(!hit) for(const inst of (day.cardio||[])){ if(inst.exId===exId){hit=true;break;} }
    }
    if(hit) used.push({day,dayIdx:i});
  });
  return used;
}

// Strip HTML tags + entities from the day's titleHtml for plain display.
function wsLibDayDisplayName(day){
  if(!day) return '';
  if(day.titleHtml){
    const txt=day.titleHtml.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    return txt||day.label||'';
  }
  return day.label||'';
}

// Render the editor body. Always called against the current draft.
function wsRenderLibEditor(){
  if(!wsLibEditCtx) return;
  const d=wsLibEditCtx.draft;
  const isNew=wsLibEditCtx.isNew;
  const scope=wsLibEditCtx.scope||'library';
  const isInstance=scope==='instance';
  const isFromDay=scope==='fromDay';
  const usingDays = isInstance ? [] : wsLibFindUsingDays(d.exId);
  const isUsed=usingDays.length>0;

  // Modal title varies by scope
  document.getElementById('wsLeTitle').textContent =
    isInstance ? 'Edit Exercise · This Day Only'
    : isFromDay ? 'New Exercise'
    : isNew ? 'New Exercise'
    : 'Edit Exercise';

  // Hint banner for instance scope so the user knows the editing context.
  // The day name disambiguates the "only this day" semantic.
  let scopeBanner='';
  if(isInstance && wsLibEditCtx.instanceDayIdx!=null){
    const targetDay=DAYS[wsLibEditCtx.instanceDayIdx];
    const dayName=targetDay ? (wsLibDayDisplayName(targetDay)||targetDay.label||`Day ${wsLibEditCtx.instanceDayIdx+1}`) : 'this day';
    scopeBanner=`<div class="ws-le-scope-banner">
      Editing the copy of this exercise in <strong>${wsLibEscapeHtml(dayName)}</strong>. Changes here won't affect the Library entry or other days.
    </div>`;
  } else if(isFromDay && wsLibEditCtx.fromDayIdx!=null){
    const targetDay=DAYS[wsLibEditCtx.fromDayIdx];
    const dayName=targetDay ? (wsLibDayDisplayName(targetDay)||targetDay.label||`Day ${wsLibEditCtx.fromDayIdx+1}`) : 'this day';
    scopeBanner=`<div class="ws-le-scope-banner">
      New exercise will be added to the Library and to <strong>${wsLibEscapeHtml(dayName)}</strong>.
    </div>`;
  }

  // Title field — locked in instance mode (changing it would diverge from
  // the library group, breaking the title-as-identity contract).
  const titleField = isInstance
    ? `<div class="ws-le-title-locked">${wsLibEscapeHtml(d.title||'(untitled)')}<span class="ws-le-locked-icon" title="Title is locked to the library group">🔒</span></div>
       <div class="ws-le-hint">Title is locked to the Library group. Edit it from the Library if needed.</div>`
    : `<input type="text" class="ws-le-title-input" id="wsLeTitleInput" placeholder="e.g. Bench Press" value="${wsLibEscapeHtml(d.title)}" maxlength="60" oninput="wsLeOnTitleInput(this.value)">
       ${isUsed?`<div class="ws-le-hint">Renaming here won't affect days using this exercise — only future adds.</div>`:''}`;

  let html = scopeBanner + `
    <div class="ws-de-fld">
      <span class="ws-de-fl">Title <span style="color:var(--tx4);font-weight:400;text-transform:none;letter-spacing:.04em;">(group)</span></span>
      ${titleField}
    </div>
    <div class="ws-de-fld">
      <span class="ws-de-fl">Subtitle <span style="color:var(--tx4);font-weight:400;text-transform:none;letter-spacing:.04em;">(variant · optional)</span></span>
      <input type="text" class="ws-de-input" id="wsLeSubtitleInput" placeholder="e.g. Barbell, Ben's way" value="${wsLibEscapeHtml(d.subtitle)}" maxlength="40" oninput="wsLeOnSubtitleInput(this.value)">
    </div>
    ${isInstance?'':`<div class="ws-de-fld">
      <span class="ws-de-fl">Kind</span>
      ${wsLeRenderKindSelector(d.kind)}
    </div>`}
    <div class="ws-de-fld">
      ${wsLeRenderDefaultsBlock(d)}
    </div>
  `;

  // Advanced tags (gated by settings). Hidden in instance scope — they're
  // catalog-level metadata, not instance-level customization.
  if(wsAdvancedTags && !isInstance){
    html+=`<div class="ws-de-fld">${wsLeRenderAdvancedBlock(d)}</div>`;
  }

  // Used-in display (only for existing library entries — not new, not instance)
  if(!isNew && !isInstance){
    const exName=wsLibEscapeHtml(d.title||'This exercise');
    html+=`<div class="ws-de-fld">
      <div class="ws-le-days">
        <div class="ws-le-days-head">
          <span class="ws-le-days-label">${exName} in your days</span>
          <button class="ws-le-days-manage" onclick="wsLeOpenDayPick()">Manage days</button>
        </div>
        ${usingDays.length===0
          ? `<div class="ws-le-usedin-empty">Not in any day yet — tap “Manage days” to add it.</div>`
          : `<div class="ws-le-usedin-list">${usingDays.map(({day,dayIdx})=>{
              const dn=wsLibEscapeHtml(wsLibDayDisplayName(day));
              const lbl=wsLibEscapeHtml(day.label||('Day '+(dayIdx+1)));
              return `<span class="ws-le-usedin-chip">${dn}<em>${lbl}</em></span>`;
            }).join('')}</div>`
        }
      </div>
    </div>`;
  }

  // Secondary actions (Duplicate, Archive). Only shown for existing library
  // entries — not new entries, not instances. Instances can't be duplicated/
  // archived (those are catalog-level actions); new entries don't exist yet.
  if(!isNew && !isInstance){
    html+=`<div class="ws-le-secondary">
      <button class="ws-le-sec-btn" onclick="wsLibDuplicateAsVariant()">+ Duplicate as variant</button>
      <button class="ws-le-sec-btn danger" onclick="wsLibAttemptDelete()">Archive</button>
    </div>`;
  }

  document.getElementById('wsLeBody').innerHTML=html;
  // clear any leftover drag transform from a previous dismiss, then bind the handle drag
  const _sheet=document.querySelector('#wsLibEditModal .ws-de-sheet');
  if(_sheet){ _sheet.style.transform=''; _sheet.style.transition=''; }
  wsLeBindHandleDrag();
}

function wsLeRenderKindSelector(currentKind){
  const opts=['weighted','cardio_time','cardio_distance','cardio_intervals'];
  return `<div class="ws-le-kind-row">${opts.map(k=>{
    return `<div class="ws-le-kind-opt ${k===currentKind?'active':''}" onclick="wsLeSetKind('${k}')">${WS_KIND_LABELS[k]}</div>`;
  }).join('')}</div>`;
}

function wsLeRenderDefaultsBlock(d){
  const kind=d.kind;
  const def=d.defaults||{};
  const scope=(wsLibEditCtx&&wsLibEditCtx.scope)||'library';
  const headerLabel = scope==='instance' ? 'Values' : 'Defaults';
  const headerSub = scope==='instance'
    ? 'Live values for this day. Won\'t affect the Library entry.'
    : 'Used only when adding this exercise to a day.';
  let header=`<span class="ws-le-defaults-label">${headerLabel}<em>${headerSub}</em></span>`;

  if(kind==='weighted'){
    const sets=def.sets||[];
    const setsHtml=sets.map((s,i)=>`
      <div class="ws-le-set-row" data-set-idx="${i}">
        <span class="ws-le-set-num">${i+1}</span>
        <input type="text" class="ws-le-set-input" inputmode="decimal" placeholder="kg" value="${s.w!=null?s.w:''}" oninput="wsLeOnSetField(${i},'w',this.value)">
        <span class="ws-le-set-x">×</span>
        <input type="text" class="ws-le-set-input" inputmode="numeric" placeholder="reps" value="${s.r!=null?s.r:''}" oninput="wsLeOnSetField(${i},'r',this.value)">
        <button class="ws-le-set-del" onclick="wsLeRemoveSet(${i})" aria-label="Remove set">×</button>
      </div>
    `).join('');
    return `<div class="ws-le-defaults">
      ${header}
      <div class="ws-le-sets">
        <div class="ws-le-sets-head"><span style="flex:0 0 22px;text-align:center">#</span><span style="flex:1;text-align:center">Weight</span><span style="flex:1;text-align:center">Reps</span><span style="width:28px"></span></div>
        ${setsHtml}
        <button class="ws-le-set-add" onclick="wsLeAddSet()">+ Add set</button>
      </div>
      <div class="ws-le-row">
        <span class="ws-le-row-label">Rest</span>
        <input type="text" class="ws-de-input" inputmode="numeric" value="${def.rest!=null?def.rest:90}" oninput="wsLeOnDefaultsField('rest',this.value,'int')">
        <span class="ws-le-row-suffix">sec</span>
      </div>
      <div class="ws-le-row" style="align-items:flex-start">
        <span class="ws-le-row-label" style="padding-top:11px">Cue</span>
        <input type="text" class="ws-de-input" placeholder="e.g. Controlled descent" value="${wsLibEscapeHtml(def.cue||'')}" maxlength="120" oninput="wsLeOnDefaultsField('cue',this.value,'str')">
      </div>
    </div>`;
  }

  if(kind==='cardio_time'){
    return `<div class="ws-le-defaults">
      ${header}
      <div class="ws-le-row">
        <span class="ws-le-row-label">Duration</span>
        <input type="text" class="ws-de-input" inputmode="numeric" value="${def.duration!=null?def.duration:300}" oninput="wsLeOnDefaultsField('duration',this.value,'int')">
        <span class="ws-le-row-suffix">sec</span>
      </div>
      <div class="ws-le-row">
        <span class="ws-le-row-label">Intensity</span>
        <input type="text" class="ws-de-input" placeholder="e.g. Low, Mod, High" value="${wsLibEscapeHtml(def.intensity||'Mod')}" maxlength="20" oninput="wsLeOnDefaultsField('intensity',this.value,'str')">
      </div>
      <div class="ws-le-row" style="align-items:flex-start">
        <span class="ws-le-row-label" style="padding-top:11px">Cue</span>
        <input type="text" class="ws-de-input" placeholder="e.g. Steady pace" value="${wsLibEscapeHtml(def.cue||'')}" maxlength="120" oninput="wsLeOnDefaultsField('cue',this.value,'str')">
      </div>
    </div>`;
  }

  if(kind==='cardio_distance'){
    return `<div class="ws-le-defaults">
      ${header}
      <div class="ws-le-row">
        <span class="ws-le-row-label">Distance</span>
        <input type="text" class="ws-de-input" inputmode="decimal" value="${def.distance!=null?def.distance:5}" oninput="wsLeOnDefaultsField('distance',this.value,'num')">
        <span class="ws-le-row-suffix">km</span>
      </div>
      <div class="ws-le-row">
        <span class="ws-le-row-label">Duration</span>
        <input type="text" class="ws-de-input" inputmode="numeric" value="${def.duration!=null?def.duration:1800}" oninput="wsLeOnDefaultsField('duration',this.value,'int')">
        <span class="ws-le-row-suffix">sec</span>
      </div>
      <div class="ws-le-row" style="align-items:flex-start">
        <span class="ws-le-row-label" style="padding-top:11px">Cue</span>
        <input type="text" class="ws-de-input" placeholder="e.g. Zone 2" value="${wsLibEscapeHtml(def.cue||'')}" maxlength="120" oninput="wsLeOnDefaultsField('cue',this.value,'str')">
      </div>
    </div>`;
  }

  if(kind==='cardio_intervals'){
    return `<div class="ws-le-defaults">
      ${header}
      <div class="ws-le-row">
        <span class="ws-le-row-label">Work</span>
        <input type="text" class="ws-de-input" inputmode="numeric" value="${def.workSec!=null?def.workSec:30}" oninput="wsLeOnDefaultsField('workSec',this.value,'int')">
        <span class="ws-le-row-suffix">sec</span>
      </div>
      <div class="ws-le-row">
        <span class="ws-le-row-label">Rest</span>
        <input type="text" class="ws-de-input" inputmode="numeric" value="${def.restSec!=null?def.restSec:15}" oninput="wsLeOnDefaultsField('restSec',this.value,'int')">
        <span class="ws-le-row-suffix">sec</span>
      </div>
      <div class="ws-le-row">
        <span class="ws-le-row-label">Rounds</span>
        <input type="text" class="ws-de-input" inputmode="numeric" value="${def.totalRounds!=null?def.totalRounds:4}" oninput="wsLeOnDefaultsField('totalRounds',this.value,'int')">
        <span class="ws-le-row-suffix">×</span>
      </div>
      <div class="ws-le-row" style="align-items:flex-start">
        <span class="ws-le-row-label" style="padding-top:11px">Cue</span>
        <input type="text" class="ws-de-input" placeholder="e.g. 40 on, 20 off" value="${wsLibEscapeHtml(def.cue||'')}" maxlength="120" oninput="wsLeOnDefaultsField('cue',this.value,'str')">
      </div>
    </div>`;
  }
  return '';
}

function wsLeRenderAdvancedBlock(d){
  const activeMuscles=new Set(d.muscles||[]);
  const activePattern=d.pattern||'';
  const musclesHtml=WS_MUSCLE_OPTIONS.map(m=>{
    return `<button class="ws-le-tag ${activeMuscles.has(m)?'active':''}" onclick="wsLeToggleMuscle('${m}')">${m}</button>`;
  }).join('');
  const patternHtml=WS_PATTERN_OPTIONS.map(p=>{
    return `<button class="ws-le-tag ${activePattern===p?'active':''}" onclick="wsLeSetPattern('${p}')">${p}</button>`;
  }).join('');
  // Prime mover: the single muscle doing most of the work. Chosen from the
  // exercise's tagged muscles (or 'none'). Crimson-accented to distinguish it
  // from the plain primary/secondary muscle tags.
  const pm=d.prime_mover||'';
  const pmOptions=(d.muscles&&d.muscles.length)?d.muscles:[];
  const pmHtml = pmOptions.length
    ? pmOptions.map(m=>`<button class="ws-le-tag pm ${pm===m?'active':''}" onclick="wsLeSetPrimeMover('${m}')">${m}</button>`).join('')
      + `<button class="ws-le-tag pm ${pm===''?'active':''}" onclick="wsLeSetPrimeMover('')">none</button>`
    : `<div class="ws-le-tag-empty">Tag a muscle above first.</div>`;
  // Risk note: a short caution surfaced to the user. Warning-styled.
  const rn=wsLibEscapeHtml(d.risk_note||'');
  return `<div class="ws-le-advanced">
    <div class="ws-le-advanced-label">Muscle &amp; pattern tags</div>
    <div>
      <div class="ws-le-tag-group-label">Muscles · select any</div>
      <div class="ws-le-tags">${musclesHtml}</div>
    </div>
    <div>
      <div class="ws-le-tag-group-label">Movement pattern · pick one</div>
      <div class="ws-le-tags">${patternHtml}</div>
    </div>
    <div>
      <div class="ws-le-tag-group-label pm-label">Prime mover · the muscle doing most of the work</div>
      <div class="ws-le-tags">${pmHtml}</div>
    </div>
    <div>
      <div class="ws-le-tag-group-label">Risk note · optional caution shown to the user</div>
      <div class="ws-le-risk">
        <svg viewBox="0 0 24 24" class="ws-le-risk-icon"><path d="M12 3L2 20h20L12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>
        <input type="text" class="ws-le-risk-input" placeholder="e.g. Hard on the lower back if rounded" value="${rn}" maxlength="120" oninput="wsLeOnRiskNote(this.value)">
      </div>
    </div>
  </div>`;
}
function wsLeSetPrimeMover(m){ if(!wsLibEditCtx) return; wsLibEditCtx.draft.prime_mover=m; wsRenderLibEditor(); }
function wsLeOnRiskNote(v){ if(wsLibEditCtx) wsLibEditCtx.draft.risk_note=v; }

// ─── Editor field input handlers ─────────────────────────────────────
// These update the draft buffer without re-rendering the whole editor, to
// preserve input focus / caret position. wsRenderLibEditor is only called
// when something structural changes (kind switch, set add/remove, tag toggle).

function wsLeOnTitleInput(v){ if(wsLibEditCtx) wsLibEditCtx.draft.title=v; }
function wsLeOnSubtitleInput(v){ if(wsLibEditCtx) wsLibEditCtx.draft.subtitle=v; }

function wsLeOnDefaultsField(field,raw,type){
  if(!wsLibEditCtx) return;
  const d=wsLibEditCtx.draft.defaults;
  if(type==='int' || type==='num'){
    // Store the raw string while the user is editing so a temporarily-empty
    // field doesn't snap back to 0 in the model (and force the input to
    // appear stuck). Save-time normalization coerces to numbers.
    if(raw===''){ d[field]=''; }
    else {
      const n=type==='int' ? parseInt(raw,10) : parseFloat(raw);
      d[field]=isNaN(n)?raw:n;
    }
  } else {
    d[field]=raw;
  }
}

function wsLeOnSetField(idx,field,raw){
  if(!wsLibEditCtx) return;
  const sets=wsLibEditCtx.draft.defaults.sets;
  if(!sets[idx]) return;
  // Same policy as wsLeOnDefaultsField: keep raw while editing,
  // normalize on save.
  if(raw===''){ sets[idx][field]=''; return; }
  const n=parseFloat(raw);
  sets[idx][field]=isNaN(n)?raw:n;
}

// Coerce all numeric draft fields to actual numbers (zero on empty/invalid)
// just before saving. Lives in one place so the edit handlers stay simple.
function wsLeNormalizeDraft(){
  if(!wsLibEditCtx) return;
  const d=wsLibEditCtx.draft;
  const def=d.defaults||(d.defaults={});
  function toInt(v,fallback){
    if(v===''||v==null) return fallback;
    const n=parseInt(v,10);
    return isNaN(n)?fallback:n;
  }
  function toNum(v,fallback){
    if(v===''||v==null) return fallback;
    const n=parseFloat(v);
    return isNaN(n)?fallback:n;
  }
  if(d.kind==='weighted'){
    def.rest=toInt(def.rest,90);
    if(Array.isArray(def.sets)){
      def.sets.forEach(s=>{
        s.w=toNum(s.w,0);
        s.r=toInt(s.r,0);
      });
    }
  } else if(d.kind==='cardio_time'){
    def.duration=toInt(def.duration,300);
  } else if(d.kind==='cardio_distance'){
    def.distance=toNum(def.distance,5);
    def.duration=toInt(def.duration,1800);
  } else if(d.kind==='cardio_intervals'){
    def.workSec=toInt(def.workSec,30);
    def.restSec=toInt(def.restSec,15);
    def.totalRounds=toInt(def.totalRounds,4);
  }
}

function wsLeSetKind(kind){
  if(!wsLibEditCtx) return;
  if(wsLibEditCtx.draft.kind===kind) return;
  wsLibEditCtx.draft.kind=kind;
  // Switching kinds: reset defaults to sensible per-kind values so we don't
  // carry irrelevant fields across. Saves the user from confusing empty inputs.
  if(kind==='weighted'){
    wsLibEditCtx.draft.defaults={cue:wsLibEditCtx.draft.defaults.cue||'',rest:90,sets:[{w:0,r:8},{w:0,r:8},{w:0,r:8}]};
  } else if(kind==='cardio_time'){
    wsLibEditCtx.draft.defaults={cue:wsLibEditCtx.draft.defaults.cue||'',duration:600,intensity:'Mod'};
  } else if(kind==='cardio_distance'){
    wsLibEditCtx.draft.defaults={cue:wsLibEditCtx.draft.defaults.cue||'',distance:5,duration:1800};
  } else if(kind==='cardio_intervals'){
    wsLibEditCtx.draft.defaults={cue:wsLibEditCtx.draft.defaults.cue||'',workSec:30,restSec:15,totalRounds:4,simpleMode:true,roundsCustom:[]};
  }
  wsRenderLibEditor();
}

function wsLeAddSet(){
  if(!wsLibEditCtx) return;
  const sets=wsLibEditCtx.draft.defaults.sets;
  const last=sets[sets.length-1]||{w:0,r:8};
  sets.push({w:last.w,r:last.r});
  wsRenderLibEditor();
}

function wsLeRemoveSet(idx){
  if(!wsLibEditCtx) return;
  const sets=wsLibEditCtx.draft.defaults.sets;
  if(sets.length<=1) return; // never go below 1
  sets.splice(idx,1);
  wsRenderLibEditor();
}

function wsLeToggleMuscle(m){
  if(!wsLibEditCtx) return;
  const arr=wsLibEditCtx.draft.muscles||(wsLibEditCtx.draft.muscles=[]);
  const i=arr.indexOf(m);
  if(i>=0) arr.splice(i,1);
  else arr.push(m);
  wsRenderLibEditor();
}

function wsLeSetPattern(p){
  if(!wsLibEditCtx) return;
  // Tap-twice to clear
  if(wsLibEditCtx.draft.pattern===p) wsLibEditCtx.draft.pattern='';
  else wsLibEditCtx.draft.pattern=p;
  wsRenderLibEditor();
}

// ─── Save / Cancel ────────────────────────────────────────────────────

// Rising save-confirmation: tap Save → slide-up sheet with a roomy slider; × backs out.
function wsLeOpenConfirm(){
  const scrim=document.getElementById('wsLeConfirm');
  if(!scrim) return;
  // reset slider visual state
  const thumb=document.getElementById('wsLeStsThumb'), fill=document.getElementById('wsLeStsFill');
  const track=document.querySelector('#wsLeSlideToSave .sts-track');
  if(thumb) thumb.style.transform='translateX(0)';
  if(fill) fill.style.width='0';
  if(track) track.classList.remove('completed','dragging');
  scrim.classList.add('open');
  setTimeout(()=>bindSlideToSave('wsLeSlideToSave', ()=>{ wsLeCloseConfirm(); saveWsLibEdit(); }), 30);
}
function wsLeCloseConfirm(ev){
  if(ev && ev.type==='click' && ev.target && ev.target.id!=='wsLeConfirm') return; // only scrim taps close
  const scrim=document.getElementById('wsLeConfirm');
  if(scrim) scrim.classList.remove('open');
}

// ── Manage which days this exercise is in (view + edit the same membership) ──
// The picker reads REAL day membership (wsLibFindUsingDays), so it always
// reflects true state and persists naturally. Tapping a day toggles membership
// live with a confirming toast. "Done" closes the SHEET and returns to the
// editor (it does NOT exit the editor — the user controls that).
function wsLeMembershipSet(){
  // map of dayIdx -> the _iid of this exercise's instance in that day (first one)
  const exId=wsLibEditCtx&&wsLibEditCtx.draft&&wsLibEditCtx.draft.exId;
  const m={};
  if(!exId) return m;
  DAYS.forEach((day,idx)=>{
    const items=Array.isArray(day.items)?day.items:[];
    const hit=items.find(it=>it.exId===exId);
    if(hit) m[idx]=hit._iid;
  });
  return m;
}
function wsLeOpenDayPick(){
  if(!wsLibEditCtx) return;
  wsLeRenderDayPick();
  document.getElementById('wsLeDayPick').classList.add('open');
}
function wsLeRenderDayPick(){
  if(!wsLibEditCtx) return;
  const d=wsLibEditCtx.draft;
  const membership=wsLeMembershipSet();
  const inCount=Object.keys(membership).length;
  document.getElementById('wsLeDayPickSub').innerHTML = inCount
    ? `In <b style="color:var(--hiit)">${inCount} ${inCount===1?'day':'days'}</b>. Tap to add or remove.`
    : `Tap a day to add <b style="color:var(--tx)">${wsLibEscapeHtml(d.title||'')}</b> to it.`;
  const list=document.getElementById('wsLeDayPickList');
  const rows=DAYS.map((day,idx)=>{
    const name=wsLibDayDisplayName(day)||('Day '+(idx+1));
    const count=Array.isArray(day.items)?day.items.length:((day.exercises||[]).length+(day.cardio||[]).length);
    const draft=day.published?'':'<span class="ws-daypick-draft">draft</span>';
    const isIn=(idx in membership);
    return `<button class="ws-daypick-row ${isIn?'added':''}" onclick="wsLeToggleDay(${idx})">
      <div class="ws-daypick-row-main"><span class="ws-daypick-name">${wsLibEscapeHtml(name)}</span>${draft}</div>
      ${isIn
        ? `<span class="ws-daypick-added"><svg viewBox="0 0 14 14"><polyline points="2,7 6,11 12,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>In day</span>`
        : `<span class="ws-daypick-count">${count} ${count===1?'item':'items'}</span>`}
    </button>`;
  }).join('');
  list.innerHTML=rows || '<div class="ws-le-tag-empty">No days yet. Create one in the Days tab first.</div>';
}
function wsLeToggleDay(dayIdx){
  if(!wsLibEditCtx) return;
  const day=DAYS[dayIdx];
  if(!day) return;
  const exId=wsLibEditCtx.draft.exId;
  const membership=wsLeMembershipSet();
  const name=wsLibDayDisplayName(day)||('Day '+(dayIdx+1));
  if(dayIdx in membership){
    // remove THIS exercise from the day (all instances of it, so membership is binary+clean)
    wsDayRemoveByExId(day, exId);
    wsLogPush('lib_day_remove',{exId,dayIdx});
    wsLeToast(`Removed from ${name}`);
  } else {
    const cat=EXERCISES.find(e=>e.exId===exId);
    if(!cat) return;
    if(!Array.isArray(day.items)) day.items=[];
    const inst=wsPkBuildInstance(cat);
    day.items.push(inst);
    wsDayItemsSync(day);
    wsLogPush('lib_day_add',{exId,dayIdx});
    wsLeToast(`Added to ${name}`);
  }
  wsPersistSave();
  wsLeRenderDayPick();
}
function wsLeCloseDayPick(){
  const s=document.getElementById('wsLeDayPick');
  if(s) s.classList.remove('open');
  // refresh the editor's "in your days" section to reflect any changes —
  // WITHOUT exiting the editor (user stays to keep editing/reflecting).
  if(wsLibEditCtx) wsRenderLibEditor();
}
function wsLeDayPickDone(){ wsLeCloseDayPick(); }
function wsLeDayPickBackdrop(ev){
  if(ev && ev.target && ev.target.id==='wsLeDayPick') wsLeCloseDayPick();
}
// Lightweight transient toast (minimal + self-contained)
function wsLeToast(msg){
  let t=document.getElementById('wsLeToast');
  if(!t){
    t=document.createElement('div'); t.id='wsLeToast'; t.className='ws-le-toast';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(t._hideT);
  t._hideT=setTimeout(()=>t.classList.remove('show'), 1500);
}

function saveWsLibEdit(){
  if(!wsLibEditCtx) return;
  const d=wsLibEditCtx.draft;
  const scope=wsLibEditCtx.scope||'library';
  // Title is required for library/fromDay; for instance it's locked (not editable).
  if(scope!=='instance'){
    const title=(d.title||'').trim();
    if(!title){
      wsToast('Title is required');
      const f=document.getElementById('wsLeTitleInput');
      if(f) f.focus();
      return;
    }
    d.title=title;
  }
  d.subtitle=(d.subtitle||'').trim();
  // Coerce any temporarily-empty/raw-string numeric fields back to numbers.
  wsLeNormalizeDraft();

  if(scope==='instance'){
    // Write back to the instance only. Catalog entry is untouched.
    wsLeSaveInstance();
  } else if(scope==='fromDay'){
    // Add to catalog AND add an instance to the source day.
    EXERCISES.push(d);
    const dayIdx=wsLibEditCtx.fromDayIdx;
    const day=DAYS[dayIdx];
    if(day){
      const inst=wsPkBuildInstance(d); // already iid-stamped + kind-tagged
      // items[] is the single source of truth: append here, then rebuild the
      // derived exercises[]/cardio[] views from it.
      if(!Array.isArray(day.items)) day.items=[];
      day.items.push(inst);
      wsDayItemsSync(day);
    }
    wsLogPush('lib_save_new_fromday',{exId:d.exId,title:d.title,dayIdx});
    wsToast(`${d.title}${d.subtitle?' · '+d.subtitle:''} added to day`);
  } else if(wsLibEditCtx.isNew){
    EXERCISES.push(d);
    wsLogPush('lib_save_new',{exId:d.exId,title:d.title});
    wsToast(`${d.title}${d.subtitle?' · '+d.subtitle:''} saved`);
  } else {
    // Replace the live entry in EXERCISES with the draft (preserves array order).
    const idx=EXERCISES.findIndex(e=>e.exId===d.exId);
    if(idx>=0) EXERCISES[idx]=d;
    wsLogPush('lib_save_edit',{exId:d.exId,title:d.title});
    wsToast('Saved');
  }

  wsLibEditCtx=null;
  document.getElementById('wsLibEditModal').classList.remove('open');
  // After save, expand the matching title group so any new sibling is visible
  if(scope!=='instance' && d.title){
    const key=(d.title||'').toLowerCase();
    wsLibExpandedGroups.add(key);
  }
  wsRender();
  // If the day editor is open, re-render its exercise list so the change shows up
  if(wsDayEditCtx){
    try{ wsDeRenderExList(); }catch(_){}
  }
  // Re-render the live Today view too (instance-edit, fromDay-add, or any
  // change that touches the current day should be reflected immediately)
  try{ renderAll(false); }catch(_){}
  wsPersistSave();
}

// Write the draft back to a specific day-instance. Title is taken from the
// catalog (not from the draft), since title is locked in instance scope.
// Subtitle is recorded as _subtitle override on the instance so it can drift
// from the catalog's subtitle. The display name is rebuilt from title+subtitle
// so the day list and the instance editor stay in sync.
function wsLeSaveInstance(){
  if(!wsLibEditCtx || wsLibEditCtx.scope!=='instance') return;
  const d=wsLibEditCtx.draft;
  const day=DAYS[wsLibEditCtx.instanceDayIdx];
  if(!day) return;
  const arr = wsLibEditCtx.instanceList==='exercises' ? day.exercises : day.cardio;
  if(!arr) return;
  const inst=arr[wsLibEditCtx.instanceOrigIdx];
  if(!inst) return;
  const cat = inst.exId ? EXERCISES.find(e=>e.exId===inst.exId) : null;
  // Reconstruct display name from canonical title + (possibly customized) subtitle.
  const canonicalTitle = cat ? cat.title : d.title;
  const subtitle = (d.subtitle||'').trim();
  const displayName = subtitle ? `${canonicalTitle} — ${subtitle}` : canonicalTitle;
  inst.name=displayName;
  // Mark subtitle override only if it differs from the catalog's subtitle.
  if(cat && subtitle === (cat.subtitle||'')){
    delete inst._subtitle;
  } else {
    inst._subtitle = subtitle;
  }
  // Write back the defaults to the instance fields.
  const def=d.defaults||{};
  if(d.kind==='weighted'){
    inst.cue=def.cue||'';
    inst.rest=def.rest!=null?def.rest:90;
    inst.rl=inst.rest;
    if(Array.isArray(def.sets)){
      // Preserve any per-set runtime flags (e.g. _logged) by mapping into existing slots when possible.
      const oldSets=inst.sets||[];
      inst.sets=def.sets.map((s,i)=>{
        const old=oldSets[i]||{};
        return Object.assign({},old,{w:s.w,r:s.r});
      });
    }
  } else if(d.kind==='cardio_time'){
    inst.cue=def.cue||'';
    inst.duration=def.duration||300;
    inst.intensity=def.intensity||'Mod';
    inst.rl=inst.duration;
  } else if(d.kind==='cardio_distance'){
    inst.cue=def.cue||'';
    inst.distance=def.distance||5;
    inst.duration=def.duration||1800;
    inst.rl=inst.duration;
  } else if(d.kind==='cardio_intervals'){
    inst.cue=def.cue||'';
    inst.workSec=def.workSec||30;
    inst.restSec=def.restSec||15;
    inst.totalRounds=def.totalRounds||4;
    if(Array.isArray(def.roundsCustom)) inst.roundsCustom=def.roundsCustom.slice();
  }
  wsLogPush('lib_save_instance',{dayIdx:wsLibEditCtx.instanceDayIdx,exId:inst.exId});
  wsToast('Saved for this day');
}

function cancelWsLibEdit(){
  if(!wsLibEditCtx) return;
  wsLogPush('lib_cancel_edit',{isNew:wsLibEditCtx.isNew});
  wsLibEditCtx=null;
  document.getElementById('wsLibEditModal').classList.remove('open');
}

// Tap the dimmed area outside the sheet → dismiss (same as Cancel).
function wsLeBackdropTap(ev){
  if(ev && ev.target && ev.target.id==='wsLibEditModal'){ cancelWsLibEdit(); }
}
// Drag the grabber handle downward to dismiss the editor sheet.
function wsLeBindHandleDrag(){
  const handle=document.getElementById('wsLeHandle');
  const sheet=document.querySelector('#wsLibEditModal .ws-de-sheet');
  if(!handle||!sheet||handle._dragBound) return;
  handle._dragBound=true;
  let startY=0, dy=0, dragging=false;
  const down=(e)=>{
    dragging=true; startY=e.clientY; dy=0;
    sheet.style.transition='none';
    try{ handle.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  };
  const move=(e)=>{
    if(!dragging) return;
    dy=Math.max(0, e.clientY-startY);
    sheet.style.transform=`translateY(${dy}px)`;
  };
  const up=(e)=>{
    if(!dragging) return;
    dragging=false;
    sheet.style.transition='';
    try{ handle.releasePointerCapture(e.pointerId); }catch(_){}
    if(dy>100){ sheet.style.transform=''; cancelWsLibEdit(); }
    else { sheet.style.transform='translateY(0)'; }
  };
  handle.addEventListener('pointerdown',down);
  handle.addEventListener('pointermove',move);
  handle.addEventListener('pointerup',up);
  handle.addEventListener('pointercancel',up);
}

// ─── Duplicate as variant ─────────────────────────────────────────────

function wsLibDuplicateAsVariant(){
  if(!wsLibEditCtx) return;
  const src=wsLibEditCtx.draft;
  const dup=wsLibCloneEntry(src);
  dup.exId=wsNewExId();
  dup.subtitle=''; // user fills in the variant qualifier
  // Replace the editor's context with the new draft. isNew=true so Cancel
  // discards cleanly. Pre-expand the parent title group so when we return
  // to the list, the user sees the new sibling alongside the parent.
  wsLibEditCtx={
    exId:dup.exId,
    isNew:true,
    draft:dup,
    originalSnapshot:null,
  };
  wsRenderLibEditor();
  // Focus subtitle field for immediate typing
  setTimeout(()=>{const f=document.getElementById('wsLeSubtitleInput');if(f){f.focus();f.select();}},80);
}

// ─── Delete ───────────────────────────────────────────────────────────

// ─── Soft-delete (archive) and hard-delete with slide-to-confirm ─────
//
// Two-stage destructive flow:
//   1) From the editor's "Delete" button: archive the exercise. The catalog
//      entry stays (flagged archived:true) so future data history can still
//      resolve the exId. Day-instances ARE removed — the user wanted the
//      exercise out of their program. Visible only in the "Archived" section
//      at the bottom of the library. Reversible via Restore.
//   2) From the Archived section's trash button: permanent hard delete.
//      Catalog entry removed entirely. THIS is the "can't be undone" moment.
//
// Both flows share the slide-to-confirm modal — the copy and visual weight
// differ based on `wsLdState.mode`.

let wsLdState=null; // {mode:'archive'|'hard', exId, draftTitle, draftSubtitle, affectedDays}

// Reset everything: trigger the slide-to-confirm modal in 'reset' mode.
function wsResetAllAttempt(){
  closeSettings();
  // Brief delay so settings dismisses cleanly before the modal layers on top
  setTimeout(()=>{
    wsLdState={
      mode:'reset',
      exId:null,
      draftTitle:'All data',
      draftSubtitle:'',
      affectedDays:[],
    };
    document.getElementById('wsLdName').textContent='Reset all data';
    document.getElementById('wsLdNameSub').textContent='';
    wsLdRender();
    wsLdResetSlider();
    document.getElementById('wsLibDeleteModal').classList.add('open');
    wsLdBindSlider();
    wsLogPush('reset_all_open');
  },180);
}

// Entry point from editor's Delete button → archive flow
function wsLibAttemptDelete(){
  if(!wsLibEditCtx) return;
  const d=wsLibEditCtx.draft;
  wsLdOpen({
    mode:'archive',
    exId:d.exId,
    title:d.title,
    subtitle:d.subtitle,
  });
}

// Entry point from Archived section's trash button → hard delete flow
function wsLibHardDeleteAttempt(exId){
  const e=EXERCISES.find(x=>x.exId===exId);
  if(!e) return;
  wsLdOpen({
    mode:'hard',
    exId,
    title:e.title,
    subtitle:e.subtitle,
  });
}

// Restore from Archived → flip the archived flag, re-render. Day-instances
// stay un-restored (user re-adds manually via picker — simpler, safer).
function wsLibRestoreEntry(exId){
  const e=EXERCISES.find(x=>x.exId===exId);
  if(!e) return;
  delete e.archived;
  delete e.archivedAt;
  wsLogPush('lib_restore',{exId});
  const fullName=e.subtitle?`${e.title} · ${e.subtitle}`:e.title;
  wsToast(`${fullName} restored`);
  // Expand the title group so the user sees it landed back in place
  const key=(e.title||'').toLowerCase();
  wsLibExpandedGroups.add(key);
  wsRender();
  wsPersistSave();
}

// Open the confirmation modal in either mode
function wsLdOpen(opts){
  const affected= opts.mode==='archive' ? wsLibFindUsingDays(opts.exId) : [];
  wsLdState={
    mode:opts.mode,
    exId:opts.exId,
    draftTitle:opts.title,
    draftSubtitle:opts.subtitle,
    affectedDays:affected,
  };
  document.getElementById('wsLdName').textContent=opts.title||'(untitled)';
  document.getElementById('wsLdNameSub').textContent=opts.subtitle||'';
  wsLdRender();
  wsLdResetSlider();
  document.getElementById('wsLibDeleteModal').classList.add('open');
  wsLdBindSlider();
  wsLogPush('lib_delete_open',{mode:opts.mode,exId:opts.exId,affected:affected.length});
}

function wsLdRender(){
  const st=wsLdState;
  if(!st) return;

  // Eyebrow / slider label adapt to mode
  const eyebrowEl=document.querySelector('#wsLibDeleteModal .ws-ld-eyebrow span');
  if(eyebrowEl){
    eyebrowEl.textContent = st.mode==='archive' ? 'Archive exercise'
                          : st.mode==='reset'   ? 'Reset all data'
                          : 'Permanently delete';
  }
  const sliderLabel=document.getElementById('wsLdSliderLabel');
  if(sliderLabel){
    sliderLabel.textContent = st.mode==='archive' ? 'Slide to archive'
                            : st.mode==='reset'   ? 'Slide to reset everything'
                            : 'Slide to permanently delete';
  }

  let html='';
  const fullName=st.draftSubtitle?`${st.draftTitle} · ${st.draftSubtitle}`:st.draftTitle;

  if(st.mode==='archive'){
    // Calm, informational. This is reversible.
    const n=st.affectedDays.length;
    if(n>0){
      html+=`<div class="ws-ld-notice"><strong>${wsLibEscapeHtml(fullName)}</strong> will move to your Archive and be removed from ${n} day${n===1?'':'s'} below. Your historical data is kept, and you can restore it any time.</div>`;
      html+=`<div class="ws-ld-affected-label">Will be removed from</div>`;
      html+=`<div class="ws-ld-affected">${st.affectedDays.map(({day,dayIdx})=>{
        const dn=wsLibEscapeHtml(wsLibDayDisplayName(day)||'(untitled day)');
        const lbl=wsLibEscapeHtml(day.label||('Day '+(dayIdx+1)));
        return `<div class="ws-ld-affected-row"><span class="ws-ld-affected-name">${dn}</span><span class="ws-ld-affected-label-txt">${lbl}</span></div>`;
      }).join('')}</div>`;
    } else {
      html+=`<div class="ws-ld-notice"><strong>${wsLibEscapeHtml(fullName)}</strong> will move to your Archive. Not currently used in any day. Your historical data is kept, and you can restore it any time.</div>`;
    }
  } else if(st.mode==='reset'){
    // Reset all: maximum-weight warning since this wipes the user's whole app state.
    html+=`<div class="ws-ld-danger">
      <div class="ws-ld-danger-head">Everything will be erased</div>
      <div class="ws-ld-danger-body">Your <em>days, exercises, archive, logged sets, and preferences</em> will all be permanently deleted. The app will restart from defaults.</div>
    </div>`;
    html+=`<div class="ws-ld-notice" style="background:transparent;border:none;padding:0;font-size:13px;color:var(--tx3);text-align:center">There's no way to recover data after a reset.</div>`;
  } else {
    // Hard delete: visually heavy danger block, clear language
    html+=`<div class="ws-ld-danger">
      <div class="ws-ld-danger-head">This can't be undone</div>
      <div class="ws-ld-danger-body"><strong>${wsLibEscapeHtml(fullName)}</strong> and all of its historical data will be <em>permanently destroyed</em>.</div>
    </div>`;
    html+=`<div class="ws-ld-notice" style="background:transparent;border:none;padding:0;font-size:13px;color:var(--tx3);text-align:center">If you might want it back later, leave it archived instead.</div>`;
  }
  document.getElementById('wsLdBody').innerHTML=html;
}

function wsLdCancel(){
  wsLdCleanup();
  document.getElementById('wsLibDeleteModal').classList.remove('open');
  wsLogPush('lib_delete_cancel',{mode:wsLdState&&wsLdState.mode});
  wsLdState=null;
}

function wsLdResetSlider(){
  const slider=document.getElementById('wsLdSlider');
  const thumb=document.getElementById('wsLdSliderThumb');
  const fill=document.getElementById('wsLdSliderFill');
  if(!slider) return;
  slider.classList.remove('armed','dragging','confirmed','snapping');
  thumb.style.transform='translateX(0px)';
  fill.style.width='0px';
}

let _wsLdSliderCleanup=null;

function wsLdBindSlider(){
  if(_wsLdSliderCleanup){ _wsLdSliderCleanup(); _wsLdSliderCleanup=null; }
  const slider=document.getElementById('wsLdSlider');
  const thumb=document.getElementById('wsLdSliderThumb');
  const fill=document.getElementById('wsLdSliderFill');
  if(!slider||!thumb) return;

  let dragging=false;
  let startX=0;
  let startOffset=0;
  let currentX=0;
  let trackWidth=0;
  let maxTravel=0;
  let armed=false;

  function measure(){
    trackWidth=slider.clientWidth;
    maxTravel=Math.max(0,trackWidth-48-6);
  }

  function setOffset(px){
    currentX=Math.max(0,Math.min(maxTravel,px));
    thumb.style.transform=`translateX(${currentX}px)`;
    fill.style.width=(currentX+51)+'px';
    const armedNow=currentX>=maxTravel*0.92;
    if(armedNow!==armed){
      armed=armedNow;
      slider.classList.toggle('armed',armed);
      const label=document.getElementById('wsLdSliderLabel');
      if(label){
        const m=wsLdState&&wsLdState.mode;
        const armedTxt = m==='hard'  ? 'Release to delete'
                       : m==='reset' ? 'Release to reset'
                       : 'Release to archive';
        const idleTxt  = m==='hard'  ? 'Slide to permanently delete'
                       : m==='reset' ? 'Slide to reset everything'
                       : 'Slide to archive';
        label.textContent=armed?armedTxt:idleTxt;
      }
    }
  }

  function down(e){
    if(e.cancelable) e.preventDefault();
    const rect=thumb.getBoundingClientRect();
    const pt=e.touches?e.touches[0]:e;
    if(pt.clientX<rect.left-8||pt.clientX>rect.right+8) return;
    measure();
    dragging=true;
    startX=pt.clientX;
    startOffset=currentX;
    slider.classList.add('dragging');
    slider.classList.remove('snapping');
  }

  function move(e){
    if(!dragging) return;
    if(e.cancelable) e.preventDefault();
    const pt=e.touches?e.touches[0]:e;
    setOffset(startOffset+(pt.clientX-startX));
  }

  function up(e){
    if(!dragging) return;
    if(e&&e.cancelable) e.preventDefault();
    dragging=false;
    slider.classList.remove('dragging');
    slider.classList.add('snapping');
    if(armed){
      setOffset(maxTravel);
      slider.classList.add('confirmed');
      setTimeout(()=>{ wsLdPerformDelete(); },180);
    } else {
      setOffset(0);
    }
  }

  slider.addEventListener('pointerdown',down,{passive:false});
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up,{passive:false});
  window.addEventListener('pointercancel',up,{passive:false});
  slider.addEventListener('touchstart',down,{passive:false});
  window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',up,{passive:false});
  window.addEventListener('touchcancel',up,{passive:false});

  _wsLdSliderCleanup=()=>{
    slider.removeEventListener('pointerdown',down);
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);
    window.removeEventListener('pointercancel',up);
    slider.removeEventListener('touchstart',down);
    window.removeEventListener('touchmove',move);
    window.removeEventListener('touchend',up);
    window.removeEventListener('touchcancel',up);
  };
}

function wsLdCleanup(){
  if(_wsLdSliderCleanup){ _wsLdSliderCleanup(); _wsLdSliderCleanup=null; }
}

function wsLdPerformDelete(){
  const st=wsLdState;
  if(!st) return;
  const exId=st.exId;
  const fullName=st.draftSubtitle?`${st.draftTitle} · ${st.draftSubtitle}`:st.draftTitle;

  if(st.mode==='reset'){
    // Reset everything: clear localStorage and reload from defaults.
    wsLogPush('reset_all_commit');
    wsLdCleanup();
    document.getElementById('wsLibDeleteModal').classList.remove('open');
    wsLdState=null;
    // Tiny delay so the modal animation finishes before the reload jerks the page.
    setTimeout(()=>{ wsPersistResetAll(); },220);
    return;
  }

  if(st.mode==='archive'){
    // Soft delete: mark archived, cascade-remove from days, keep catalog entry.
    let removedFromDays=0;
    for(const day of DAYS){
      const removed=wsDayRemoveByExId(day,exId);
      if(removed>0) removedFromDays++;
    }
    const entry=EXERCISES.find(e=>e.exId===exId);
    if(entry){
      entry.archived=true;
      entry.archivedAt=Date.now();
    }
    wsLogPush('lib_archive_commit',{exId,removedFromDays});
    wsLdCleanup();
    document.getElementById('wsLibDeleteModal').classList.remove('open');
    wsLdState=null;
    // Close editor too — the entry is no longer in the active list
    wsLibEditCtx=null;
    document.getElementById('wsLibEditModal').classList.remove('open');
    const msg=removedFromDays>0
      ? `${fullName} archived · removed from ${removedFromDays} day${removedFromDays===1?'':'s'}`
      : `${fullName} archived`;
    wsToast(msg);
  } else {
    // Hard delete: remove from EXERCISES entirely. Day-instances should
    // already be cleared by the prior archive step; check just in case.
    for(const day of DAYS) wsDayRemoveByExId(day,exId);
    const idx=EXERCISES.findIndex(e=>e.exId===exId);
    if(idx>=0) EXERCISES.splice(idx,1);
    wsLogPush('lib_delete_commit',{exId});
    wsLdCleanup();
    document.getElementById('wsLibDeleteModal').classList.remove('open');
    wsLdState=null;
    wsToast(`${fullName} permanently deleted`);
  }
  wsRender();
  wsPersistSave();
}
