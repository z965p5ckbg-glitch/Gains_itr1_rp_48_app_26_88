
// ─── Library tab ────────────────────────────────────────────────────
//
// Renders the catalog as a searchable, groupable list. Each row is tappable
// (opens the editor in the next step). The visible cluster styling for
// title-grouped siblings is purely presentational — every entry has a
// distinct exId and tracks independently.

// Count how many day-instances reference a given exId.
function wsCountUsage(exId){
  let c=0;
  for(const day of DAYS){
    if(Array.isArray(day.items)){
      for(const inst of day.items){ if(inst.exId===exId) c++; }
    } else {
      // Defensive fallback for any day that hasn't had items built yet
      for(const ex of (day.exercises||[])){ if(ex.exId===exId) c++; }
      for(const ex of (day.cardio||[])){ if(ex.exId===exId) c++; }
    }
  }
  return c;
}

// Filter catalog by current search query. Case-insensitive substring match
// against title + subtitle.
// ── Library search engine: token-set (order-independent) + fuzzy (typo-tolerant)
// + ranked name(3) > alias(2) > muscle-synonym(1). Runs on structured fields, so
// it's independent of the cosmetic title/subtitle display. (Validated separately.)
const WS_MSYN={
  'pecs':'Chest','pec':'Chest','chest':'Chest','lats':'Lats','lat':'Lats',
  'traps':'Upper back','trapezius':'Upper back','rhomboids':'Upper back','upper back':'Upper back','mid back':'Upper back','middle back':'Upper back',
  'shoulders':'Front delts|Side delts|Rear delts','delts':'Front delts|Side delts|Rear delts','deltoids':'Front delts|Side delts|Rear delts','shoulder':'Front delts|Side delts|Rear delts',
  'front delts':'Front delts','side delts':'Side delts','rear delts':'Rear delts','medial delts':'Side delts',
  'biceps':'Biceps','bis':'Biceps','guns':'Biceps','brachialis':'Biceps',
  'triceps':'Triceps','tris':'Triceps','tri':'Triceps',
  'forearms':'Forearms','forearm':'Forearms','grip':'Forearms','wrist':'Forearms','brachioradialis':'Forearms',
  'abs':'Abs/Core','core':'Abs/Core','sixpack':'Abs/Core','obliques':'Abs/Core','ab':'Abs/Core','oblique':'Abs/Core',
  'lower back':'Lower back','erectors':'Lower back','spinal erectors':'Lower back',
  'back':'Lats|Upper back|Lower back',
  'glutes':'Glutes','glute':'Glutes','butt':'Glutes','booty':'Glutes','gluteus':'Glutes',
  'quads':'Quads','quad':'Quads','thighs':'Quads','quadriceps':'Quads',
  'legs':'Quads|Hamstrings|Glutes|Calves',
  'hamstrings':'Hamstrings','hams':'Hamstrings','hammies':'Hamstrings','hamstring':'Hamstrings',
  'calves':'Calves','calf':'Calves','soleus':'Calves','gastroc':'Calves',
  'hip flexors':'Hip flexors','hip flexor':'Hip flexors','iliopsoas':'Hip flexors','psoas':'Hip flexors',
  'adductors':'Adductors','adductor':'Adductors','inner thigh':'Adductors','groin':'Adductors',
  'neck':'Neck','cardio':'__cardio','conditioning':'__cardio','engine':'__cardio','hiit':'__cardio'
};
function wsTokenize(s){return String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);}
function wsLev(a,b,max){
  const m=a.length,n=b.length;
  if(Math.abs(m-n)>max) return max+1;
  let prev=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){
    let cur=[i],best=i;
    for(let j=1;j<=n;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      const v=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
      cur[j]=v; if(v<best)best=v;
    }
    if(best>max) return max+1;
    prev=cur;
  }
  return prev[n];
}
function wsFuzzyHit(qt,tokens){
  // exact or prefix is a strong hit — but ignore trivially-short tokens (e.g. the
  // "s" from "Farmer's") which would strong-match any query starting with that letter.
  for(const t of tokens){
    if(t.length<2) continue;
    if(t===qt || t.startsWith(qt) || (qt.startsWith(t) && t.length>=3)) return 2;
  }
  // typo rescue only: short queries get edit-distance 1, longer get 2, and the
  // candidate token must be a similar LENGTH (avoids short queries fuzzily
  // hitting unrelated words).
  if(qt.length<3) return 0;
  const max=qt.length<=5?1:2;
  for(const t of tokens){
    if(t.length<3) continue;
    if(Math.abs(t.length-qt.length)>max) continue;
    if(wsLev(qt,t,max)<=max) return 1;
  }
  return 0;
}
function wsBag(e){
  if(e.__bag) return e.__bag;
  let t=[];
  t=t.concat(wsTokenize(e.title)).concat(wsTokenize(e.subtitle));
  (e.aliases||[]).forEach(a=>t=t.concat(wsTokenize(a)));
  (e.primary||[]).concat(e.secondary||[]).forEach(m=>t=t.concat(wsTokenize(m)));
  t=t.concat(wsTokenize(e.equipment));
  (e.patterns||[]).forEach(p=>t=t.concat(wsTokenize(p)));
  e.__bag=Array.from(new Set(t));
  return e.__bag;
}
function wsBoundaryMatch(hay,needle){
  let i=hay.indexOf(needle);
  while(i!==-1){
    const before=i===0?'':hay[i-1];
    if(!/[a-z0-9]/.test(before)) return true; // standalone or word-prefix
    i=hay.indexOf(needle,i+1);
  }
  return false;
}
function wsScoreEntry(e,raw){
  const t=raw.toLowerCase().trim();
  if(!t) return 1;
  const full=(e.title+' '+(e.subtitle||'')).toLowerCase();
  if(wsBoundaryMatch(full,t)) return 100;
  for(const a of (e.aliases||[])){ if(wsBoundaryMatch(a.toLowerCase(),t)) return 80; }
  // muscle-synonym match — scored ABOVE pure-fuzzy noise but BELOW real
  // name-token matches, so an exercise whose NAME matches ("Lateral Raise" for
  // "lat raise") outranks one merely tagged with that muscle ("Lats" for "lat").
  let syn=0;
  for(const k in WS_MSYN){
    if(k===t||t.includes(k)||k.includes(t)){
      const tg=WS_MSYN[k].split('|');
      if(tg.includes('__cardio') && (e.patterns||[]).includes('Conditioning')) syn=Math.max(syn,30);
      if(tg.some(m=>(e.primary||[]).includes(m))) syn=Math.max(syn,30);
      if(tg.some(m=>(e.secondary||[]).includes(m))) syn=Math.max(syn,22);
    }
  }
  const qtok=wsTokenize(t), bag=wsBag(e);
  const nameTok=wsTokenize(e.title+' '+(e.subtitle||'')), aliasTok=[].concat(...(e.aliases||[]).map(wsTokenize));
  const strongPrefix=(toks,qt)=> toks.some(x=> x===qt || (x.startsWith(qt)&&qt.length>=2) || (qt.startsWith(x)&&x.length>=3) );
  let allHit=true, score=0, anyStrong=false, fuzzyOnly=0;
  for(const qt of qtok){
    const inName=strongPrefix(nameTok,qt);
    const inAlias=strongPrefix(aliasTok,qt);
    const fz=wsFuzzyHit(qt,bag); // 0 none, 1 typo, 2 exact/prefix
    if(inName){score+=3;anyStrong=true;}
    else if(inAlias){score+=2;anyStrong=true;}
    else if(fz===2){score+=1;anyStrong=true;}
    else if(fz===1){fuzzyOnly++;}
    else { allHit=false; }
  }
  if(!allHit) return Math.max(syn,0);
  // All query tokens matched something. But if the ONLY thing carrying the match
  // is fuzzy-typo hits (no strong/exact token anywhere), score it low so typo
  // rescue doesn't flood the tail with loosely-similar junk.
  let tokenScore;
  if(anyStrong) tokenScore = 40 + score - (fuzzyOnly>0?2:0);
  else tokenScore = 8; // purely-fuzzy match: keep it, but well below real matches
  return Math.max(syn,tokenScore);
}
function wsLibFilter(entries){
  const q=(wsLibSearchQuery||'').trim();
  let list = q
    ? entries.map(e=>({e,sc:wsScoreEntry(e,q)})).filter(o=>o.sc>0)
        .sort((a,b)=> b.sc-a.sc
          || (a.e.title||'').length-(b.e.title||'').length
          || (a.e.title||'').localeCompare(b.e.title||'')).map(o=>o.e)
    : entries.slice();
  // apply active lens filters (combine with search; AND across lenses)
  list = list.filter(e=>wsLibPassesLens(e));
  return list;
}

// ── Lens filter system (Muscle / Equipment / Pattern) ──
const WS_LENS_MUSCLES={
  upper:['Chest','Lats','Upper back','Front delts','Side delts','Rear delts','Biceps','Triceps','Forearms','Neck'],
  lower:['Abs/Core','Lower back','Glutes','Quads','Hamstrings','Calves','Hip flexors','Adductors']
};
const WS_LENS_EQUIP=['Barbell','Dumbbell','Machine','Cable','Kettlebell','Bodyweight','Band','Other'];
const WS_LENS_PATTERNS=['Squat','Hinge','Lunge','Push','Pull','Carry','Core','Conditioning','Isolation'];
// active selections (null = no filter on that lens)
let wsLensSel={muscle:null,equip:null,pattern:null};
let wsLensOpen=null; // which tray is expanded: 'muscle'|'equip'|'pattern'|null

function wsLibPassesLens(e){
  if(wsLensSel.muscle && !((e.primary||[]).includes(wsLensSel.muscle)||(e.secondary||[]).includes(wsLensSel.muscle))) return false;
  if(wsLensSel.equip && (e.equipment||'Other')!==wsLensSel.equip) return false;
  if(wsLensSel.pattern && !((e.patterns||[]).includes(wsLensSel.pattern))) return false;
  return true;
}
// live count for a chip: how many active (non-archived) entries match this value,
// respecting the OTHER active lenses + current search (so counts guide real narrowing)
function wsLensCount(lens,val){
  const q=(wsLibSearchQuery||'').trim();
  let base=EXERCISES.filter(e=>!e.archived);
  if(q) base=base.filter(e=>wsScoreEntry(e,q)>0);
  return base.filter(e=>{
    if(lens!=='muscle' && wsLensSel.muscle && !((e.primary||[]).includes(wsLensSel.muscle)||(e.secondary||[]).includes(wsLensSel.muscle))) return false;
    if(lens!=='equip' && wsLensSel.equip && (e.equipment||'Other')!==wsLensSel.equip) return false;
    if(lens!=='pattern' && wsLensSel.pattern && !((e.patterns||[]).includes(wsLensSel.pattern))) return false;
    if(lens==='muscle') return (e.primary||[]).includes(val)||(e.secondary||[]).includes(val);
    if(lens==='equip') return (e.equipment||'Other')===val;
    if(lens==='pattern') return (e.patterns||[]).includes(val);
    return true;
  }).length;
}
function wsLensToggleTray(l){ wsLensOpen = wsLensOpen===l ? null : l; wsRender(); }
function wsLensPick(l,v){ wsLensSel[l] = wsLensSel[l]===v ? null : v; wsLensOpen=null; wsRender(); }
function wsLensClear(l,ev){ if(ev){ev.stopPropagation();} wsLensSel[l]=null; wsRender(); }

// Group entries for display. Returns an array of {header, entries}.
// Headers null for the 'none' group-by.
function wsLibGroup(entries){
  const mode=wsLibGroupBy;
  if(mode==='none'){
    // Single flat group, alphabetical by title+subtitle.
    const sorted=entries.slice().sort(wsLibSort);
    return [{header:null,entries:sorted}];
  }
  if(mode==='title'){
    // Group by title, sorted alphabetically; within group sort by subtitle.
    const map=new Map();
    for(const e of entries){
      const k=(e.title||'').toLowerCase();
      if(!map.has(k)) map.set(k,[]);
      map.get(k).push(e);
    }
    const keys=Array.from(map.keys()).sort();
    return keys.map(k=>{
      const list=map.get(k).sort((a,b)=>(a.subtitle||'').localeCompare(b.subtitle||''));
      return {header:list[0].title,entries:list,clusterable:list.length>1};
    });
  }
  if(mode==='muscle'){
    // Group by primary muscle (first in array). Entries with no muscles → 'Untagged'.
    const map=new Map();
    for(const e of entries){
      const m=(e.muscles&&e.muscles[0])||'Untagged';
      if(!map.has(m)) map.set(m,[]);
      map.get(m).push(e);
    }
    const keys=Array.from(map.keys()).sort((a,b)=>{
      if(a==='Untagged') return 1;
      if(b==='Untagged') return -1;
      return a.localeCompare(b);
    });
    return keys.map(k=>({header:k,entries:map.get(k).sort(wsLibSort)}));
  }
  if(mode==='pattern'){
    const map=new Map();
    for(const e of entries){
      const p=e.pattern||'Untagged';
      if(!map.has(p)) map.set(p,[]);
      map.get(p).push(e);
    }
    const keys=Array.from(map.keys()).sort((a,b)=>{
      if(a==='Untagged') return 1;
      if(b==='Untagged') return -1;
      return a.localeCompare(b);
    });
    return keys.map(k=>({header:k,entries:map.get(k).sort(wsLibSort)}));
  }
  return [{header:null,entries:entries.slice().sort(wsLibSort)}];
}

function wsLibSort(a,b){
  const t=(a.title||'').localeCompare(b.title||'');
  if(t!==0) return t;
  return (a.subtitle||'').localeCompare(b.subtitle||'');
}

function wsLibEscapeHtml(s){
  return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// Build a lens toggle button (shows active selection + clear-×, or the label)
function wsLensBtn(l,label){
  const v=wsLensSel[l];
  const open=wsLensOpen===l;
  const cls='ws-lens-btn'+(open?' open':'')+(v?' set':'');
  const inner = v
    ? `${wsLibEscapeHtml(v)} <span class="ws-lens-x" onclick="wsLensClear('${l}',event)">×</span>`
    : label;
  return `<button class="${cls}" onclick="wsLensToggleTray('${l}')">${inner}</button>`;
}
// Build the expandable tray of filter chips for the open lens
function wsLensTrayHtml(){
  if(!wsLensOpen) return '<div class="ws-lens-tray"></div>';
  const chip=(l,v)=>{
    const c=wsLensCount(l,v);
    const on=wsLensSel[l]===v;
    return `<button class="ws-lens-chip${on?' on':''}${c===0?' empty':''}" onclick="wsLensPick('${l}','${wsLibEscapeHtml(v)}')">${wsLibEscapeHtml(v)}<span class="n">${c}</span></button>`;
  };
  let inner='';
  if(wsLensOpen==='muscle'){
    inner=`<div class="ws-lens-sec">Upper body</div><div class="ws-lens-grid">${WS_LENS_MUSCLES.upper.map(m=>chip('muscle',m)).join('')}</div>`
        + `<div class="ws-lens-sec">Lower body</div><div class="ws-lens-grid">${WS_LENS_MUSCLES.lower.map(m=>chip('muscle',m)).join('')}</div>`;
  } else if(wsLensOpen==='equip'){
    inner=`<div class="ws-lens-grid">${WS_LENS_EQUIP.map(e=>chip('equip',e)).join('')}</div>`;
  } else {
    inner=`<div class="ws-lens-grid">${WS_LENS_PATTERNS.map(p=>chip('pattern',p)).join('')}</div>`;
  }
  return `<div class="ws-lens-tray open">${inner}</div>`;
}

function wsRenderLibrary(){
  // Main library list excludes archived entries — those live in the
  // collapsible "Archived" section at the bottom.
  const active=EXERCISES.filter(e=>!e.archived);
  const archived=EXERCISES.filter(e=>e.archived);
  const filtered=wsLibFilter(active);
  const groups=wsLibGroup(filtered);
  const isSearching=!!(wsLibSearchQuery||'').trim();
  // Empty-browse = no search AND no lens active. ONLY then do favorites float to
  // the top (search/lens always return to pure relevance/filter ranking).
  const lensActive=!!(wsLensSel.muscle||wsLensSel.equip||wsLensSel.pattern);
  const isBrowsingEmpty = !isSearching && !lensActive;
  const favEntries = isBrowsingEmpty
    ? active.filter(e=>wsFavorites.has(e.exId)).sort(wsLibSort)
    : [];
  const hasFavs = favEntries.length>0;

  // Search bar + group-by control (sticky to the top of the scrollable body)
  const toolbarHtml=`
    <div class="ws-lib-toolbar">
      <div class="ws-lib-search">
        <svg viewBox="0 0 18 18"><circle cx="8" cy="8" r="5"/><line x1="12" y1="12" x2="16" y2="16"/></svg>
        <input id="wsLibSearchInput" type="search" placeholder="Search exercises" value="${wsLibEscapeHtml(wsLibSearchQuery)}" oninput="wsLibOnSearchInput(this.value)" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="ws-lib-search-clear ${wsLibSearchQuery?'visible':''}" onclick="wsLibClearSearch()" aria-label="Clear search">×</button>
      </div>
      <div class="ws-lens-row">
        ${wsLensBtn('muscle','Muscle')}
        ${wsLensBtn('equip','Equipment')}
        ${wsLensBtn('pattern','Pattern')}
      </div>
      ${wsLensTrayHtml()}
    </div>
  `;

  // Build the list / empty-state markup. We DON'T early-return when the
  // active list is empty, because the archived section may still have
  // search-matching entries that the user should see.
  let listHtml='';
  if(!filtered.length){
    const msg=isSearching
      ? `No exercises match "${wsLibEscapeHtml(wsLibSearchQuery)}"`
      : `Your library is empty. Tap + New exercise below.`;
    listHtml=`<div class="ws-lib-empty">${msg}</div>`;
  } else {
    listHtml='<div class="ws-lib-list">';

    // Favorites float — only in empty-browse, only if there are any. Rendered as
    // flat plain rows under a faint "Favorites" subheading so the reorder reads
    // as intentional. The full library follows below under its normal grouping.
    if(hasFavs){
      listHtml+=`<div class="ws-lib-section-title fav"><span>★ Favorites</span><span class="count">${favEntries.length}</span></div>`;
      for(const e of favEntries){ listHtml+=wsLibRenderPlainRow(e); }
      listHtml+=`<div class="ws-lib-section-title"><span>All exercises</span><span class="count">${filtered.length}</span></div>`;
    }

    if(wsLibGroupBy==='title'){
      // Each group is either a multi-variant collapsible cluster or a singleton plain row.
      for(const grp of groups){
        if(grp.entries.length===1){
          // Singleton — render as plain row, no header.
          listHtml+=wsLibRenderPlainRow(grp.entries[0]);
        } else {
          // Multi-variant — collapsible group header with variants nested.
          const key=(grp.header||'').toLowerCase();
          // Auto-expand on active search (so matches are visible).
          // Otherwise honor user's expand state, default collapsed.
          const isExpanded=isSearching || wsLibExpandedGroups.has(key);
          const totalUsage=grp.entries.reduce((s,e)=>s+wsCountUsage(e.exId),0);
          listHtml+=wsLibRenderGroup(grp,isExpanded,totalUsage);
        }
      }
    } else {
      // Other group-by modes: simple section title + flat rows beneath.
      for(const grp of groups){
        if(grp.header){
          listHtml+=`<div class="ws-lib-section-title"><span>${wsLibEscapeHtml(grp.header)}</span><span class="count">${grp.entries.length}</span></div>`;
        }
        for(const e of grp.entries){
          listHtml+=wsLibRenderPlainRow(e);
        }
      }
    }
    listHtml+='</div>';
  }

  // Archived section — collapsible, sits below the +New button.
  // When searching, we filter the archived list the same way as the active
  // list AND auto-expand the section so matches are immediately visible.
  // This makes archived entries implicitly discoverable through normal
  // search without needing a separate UI to find them.
  let archivedHtml='';
  const archivedDisplayed = isSearching ? wsLibFilter(archived) : archived;
  if(archivedDisplayed.length>0){
    // Auto-expand on active search; otherwise honor user toggle.
    const isExp = isSearching || wsLibExpandedGroups.has('__archived__');
    const rowsHtml=archivedDisplayed
      .slice()
      .sort(wsLibSort)
      .map(e=>wsLibRenderArchivedRow(e))
      .join('');
    const subText = isSearching
      ? `${archivedDisplayed.length} match${archivedDisplayed.length===1?'':'es'} in archive`
      : `${archivedDisplayed.length} exercise${archivedDisplayed.length===1?'':'s'} · safe to restore or remove`;
    archivedHtml=`
      <div class="ws-lib-archive-section">
        <div class="ws-lib-archive-header ${isExp?'expanded':''}" onclick="wsLibToggleGroup('__archived__')">
          <div class="ws-lib-chev"><svg viewBox="0 0 10 10"><polyline points="3,2 7,5 3,8"/></svg></div>
          <div class="ws-lib-group-info">
            <div class="ws-lib-archive-title">Archived</div>
            <div class="ws-lib-group-sub">${subText}</div>
          </div>
        </div>
        <div class="ws-lib-variants ws-lib-archived-list ${isExp?'expanded':''}">${rowsHtml}</div>
      </div>
    `;
  }

  return toolbarHtml + listHtml +
    `<button class="ws-lib-add-btn" onclick="wsLibCreateNew()"><span class="ws-lib-add-btn-plus">+</span><span>New exercise</span></button>` +
    archivedHtml;
}

// Render an archived entry row with Restore + Delete-permanently actions.
function wsLibRenderArchivedRow(e){
  const exId=wsLibEscapeHtml(e.exId);
  const title=wsLibEscapeHtml(e.title||'(untitled)');
  const subtitle=wsLibEscapeHtml(e.subtitle||'');
  return `<div class="ws-lib-archived-row" data-ex-id="${exId}">
    <div class="ws-lib-text">
      <div class="ws-lib-title">${title}</div>
      <div class="ws-lib-subtitle">${subtitle}</div>
    </div>
    <div class="ws-lib-archived-actions">
      <button class="ws-lib-arch-btn ws-lib-arch-restore" onclick="wsLibRestoreEntry('${exId}')">Restore</button>
      <button class="ws-lib-arch-btn ws-lib-arch-delete" onclick="wsLibHardDeleteAttempt('${exId}')" aria-label="Delete permanently">
        <svg viewBox="0 0 18 18" width="14" height="14"><path d="M3 5h12M6 5V3h6v2M5 5l1 10h6l1-10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>`;
}

// Render a single library entry as a plain (non-grouped) row.
function wsLibRenderPlainRow(e){
  const usage=wsCountUsage(e.exId);
  const metaHtml=usage>0
    ? `<span class="used">in ${usage} day${usage===1?'':'s'}</span>`
    : `<span class="unused">unused</span>`;
  const fav=wsFavorites.has(e.exId);
  return `<div class="ws-lib-row" data-ex-id="${wsLibEscapeHtml(e.exId)}" onclick="wsLibOpenEditor('${wsLibEscapeHtml(e.exId)}')">
    <button class="ws-lib-star ${fav?'on':''}" onclick="wsLibToggleFav('${wsLibEscapeHtml(e.exId)}',event)" aria-label="${fav?'Unfavorite':'Favorite'}">
      <svg viewBox="0 0 20 20"><path d="M10 1.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" stroke="currentColor" stroke-width="1.6" fill="${fav?'currentColor':'none'}" stroke-linejoin="round"/></svg>
    </button>
    <div class="ws-lib-text">
      <div class="ws-lib-title">${wsLibEscapeHtml(e.title||'(untitled)')}</div>
      <div class="ws-lib-subtitle">${wsLibEscapeHtml(e.subtitle||'')}</div>
    </div>
    <div class="ws-lib-meta">${metaHtml}</div>
  </div>`;
}
// Toggle a favorite (star). Writes to the store + persists immediately.
// stopPropagation so tapping the star doesn't also open the editor.
function wsLibToggleFav(exId,ev){
  if(ev){ ev.stopPropagation(); }
  if(wsFavorites.has(exId)) wsFavorites.delete(exId);
  else wsFavorites.add(exId);
  wsPersistSave();
  wsRender();
}

// Render a multi-variant group as a header row that toggles a nested variants panel.
function wsLibRenderGroup(grp,isExpanded,totalUsage){
  const key=(grp.header||'').toLowerCase();
  const usedDays=new Set();
  for(const e of grp.entries){
    for(const day of DAYS){
      if(Array.isArray(day.items)){
        for(const inst of day.items){ if(inst.exId===e.exId) usedDays.add(day); }
      } else {
        // Defensive fallback (shouldn't happen post-migration)
        for(const inst of (day.exercises||[])){ if(inst.exId===e.exId) usedDays.add(day); }
        for(const inst of (day.cardio||[])){ if(inst.exId===e.exId) usedDays.add(day); }
      }
    }
  }
  const dayCount=usedDays.size;
  const subParts=[`${grp.entries.length} variants`];
  if(dayCount>0) subParts.push(`in ${dayCount} day${dayCount===1?'':'s'}`);
  const subText=subParts.join(' · ');

  const variantsHtml=grp.entries.map(e=>wsLibRenderPlainRow(e)).join('');

  return `
    <div class="ws-lib-group-header ${isExpanded?'expanded':''}" data-group-key="${wsLibEscapeHtml(key)}" onclick="wsLibToggleGroup('${wsLibEscapeHtml(key)}')">
      <div class="ws-lib-chev"><svg viewBox="0 0 10 10"><polyline points="3,2 7,5 3,8"/></svg></div>
      <div class="ws-lib-group-info">
        <div class="ws-lib-group-title">${wsLibEscapeHtml(grp.header)}</div>
        <div class="ws-lib-group-sub">${subText}</div>
      </div>
    </div>
    <div class="ws-lib-variants ${isExpanded?'expanded':''}" data-group-key="${wsLibEscapeHtml(key)}">${variantsHtml}</div>
  `;
}

// Handlers for library interactions
function wsLibOnSearchInput(v){
  wsLibSearchQuery=v;
  const input=document.getElementById('wsLibSearchInput');
  const caret=input?input.selectionStart:null;
  wsRender();
  const newInput=document.getElementById('wsLibSearchInput');
  if(newInput){
    newInput.focus();
    if(caret!=null){try{newInput.setSelectionRange(caret,caret);}catch(_){}}
  }
}

function wsLibClearSearch(){
  wsLibSearchQuery='';
  wsRender();
}

function wsLibSetGroupBy(mode){
  wsLibGroupBy=mode;
  wsRender();
  wsPersistSave();
}

// Toggle a group's expanded state. Uses CSS transitions for smooth expand;
// we re-render to update the chevron + class state, but the variants panel
// itself just gains/loses the .expanded class so the transition runs.
function wsLibToggleGroup(key){
  if(wsLibExpandedGroups.has(key)) wsLibExpandedGroups.delete(key);
  else wsLibExpandedGroups.add(key);
  wsRender();
  wsPersistSave();
}

// ─── Library editor ─────────────────────────────────────────────────
//
// Tap a row → open the editor. Edits stay in a pending buffer
// (wsLibEditCtx.draft) until Save is tapped. Cancel discards pending
// changes (and removes the entry if it was freshly created in this
// session). Delete is gated on usage. Duplicate creates a sibling.

const WS_MUSCLE_OPTIONS=['Chest','Back','Shoulders','Triceps','Biceps','Quads','Hamstrings','Glutes','Calves','Core','Legs','Full Body'];
const WS_PATTERN_OPTIONS=['Horizontal Press','Vertical Press','Horizontal Pull','Vertical Pull','Squat','Hinge','Lunge','Isolation','Cardio','Other'];
const WS_KIND_LABELS={
  weighted:'Weighted',
  cardio_time:'Cardio · Time',
  cardio_distance:'Cardio · Distance',
  cardio_intervals:'Intervals',
};
