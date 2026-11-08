
// ── DATA SAFETY: backup, restore, start-empty ───────────────────────────
// localStorage is not durable storage. iOS can evict it, clearing site data
// wipes it, and a browser reset takes months of training with it. A real
// training log needs an escape hatch that lives OUTSIDE the browser.
const WS_BACKUP_FORMAT=1;
function wsBuildBackup(){
  return {
    _gainsBackup:WS_BACKUP_FORMAT,
    savedAt:new Date().toISOString(),
    appVersion:(document.title||'').replace(/^.*—\s*/,''),
    persistVersion:(typeof WS_PERSIST_VERSION!=='undefined')?WS_PERSIST_VERSION:null,
    history:Array.isArray(HISTORY)?HISTORY:[],
    settings:(typeof settings==='object'&&settings)?settings:{},
    days:(typeof DAYS!=='undefined'&&Array.isArray(DAYS))?DAYS:[],
    exercises:(typeof EXERCISES!=='undefined'&&Array.isArray(EXERCISES))?EXERCISES.filter(e=>e&&e.userAdded):[],
    maxes:(typeof wsMaxes==='object'&&wsMaxes)?wsMaxes:{},
    cal:(typeof WS_CAL==='object'&&WS_CAL)?WS_CAL:{}
  };
}
function wsBackupStats(){
  const b=wsBuildBackup();
  let sets=0;
  for(const r of b.history) for(const e of (r.entries||[])) sets+=((e.sets||[]).length);
  return { sessions:b.history.length, sets,
    first:b.history.length?b.history.map(r=>r.date).sort()[0]:null,
    last:b.history.length?b.history.map(r=>r.date).sort().slice(-1)[0]:null };
}
// Save the backup as a real FILE — the only copy that survives a cleared browser.
// v56: an iPhone home-screen web app silently ignores <a download>, so this
// button did nothing there. iOS (the only platform with navigator.standalone)
// now gets the share sheet with a real file, where Save to Files is one tap.
// Everywhere else it is an ordinary download. The backup date is recorded only
// once the file has actually gone somewhere — not when the sheet was cancelled.
function wsBackupDownload(){
  let json;
  try{ json=JSON.stringify(wsBuildBackup()); }catch(e){ wsToastMsg('Could not build the backup'); return; }
  const name='gains-backup-'+new Date().toISOString().slice(0,10)+'.json';
  try{
    if(('standalone' in navigator) && navigator.share && typeof File!=='undefined'){
      const file=new File([json],name,{type:'application/json'});
      if(!navigator.canShare || navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'Gains backup'})
          .then(()=>{ wsMarkBackedUp(); wsToastMsg('Backup saved'); wsBackupRefreshSheet(); })
          .catch(e=>{ if(!(e&&e.name==='AbortError')) wsToastMsg('Sharing failed — use Copy backup text'); });
        return;
      }
    }
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const a=document.createElement('a');
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },400);
    wsMarkBackedUp(); wsToastMsg('Backup downloaded'); wsBackupRefreshSheet();
  }catch(e){ wsToastMsg('Saving failed — use Copy backup text'); }
}
// Re-render the data sheet (if open) so "Last backup" updates at once.
function wsBackupRefreshSheet(){
  try{
    const el=document.getElementById('wsDataSheet');
    if(el && el.classList.contains('on') && /Your data/.test(el.textContent) && typeof wsOpenData==='function') wsOpenData();
  }catch(_){}
}
function wsBackupShare(){
  const json=JSON.stringify(wsBuildBackup());
  try{
    if(navigator.share){
      const d=new Date().toISOString().slice(0,10);
      const file=(typeof File!=='undefined')?new File([json],'gains-backup-'+d+'.json',{type:'application/json'}):null;
      if(file && navigator.canShare && navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'Gains backup'}).then(()=>wsMarkBackedUp()).catch(()=>{});
        return;
      }
      navigator.share({title:'Gains backup',text:json}).catch(()=>{});
      return;
    }
  }catch(_){}
  wsBackupCopy();
}
function wsMarkBackedUp(){
  try{ if(typeof settings==='object'&&settings){ settings._lastBackupAt=Date.now(); if(typeof wsPersistFlush==='function') wsPersistFlush(); } }catch(_){}
}
function wsBackupAgeDays(){
  try{ const t=settings&&settings._lastBackupAt; if(!t) return null; return Math.floor((Date.now()-t)/86400000); }catch(_){ return null; }
}
function wsBackupCopy(){
  const json=JSON.stringify(wsBuildBackup());
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(json).then(()=>{wsMarkBackedUp();wsToastMsg('Backup copied');}).catch(()=>wsToastMsg('Copy failed'));
  } else wsToastMsg('Copy unavailable here');
}
