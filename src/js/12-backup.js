
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
// Download as a real FILE — the only copy that survives a cleared browser.
function wsBackupDownload(){
  try{
    const json=JSON.stringify(wsBuildBackup());
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const d=new Date().toISOString().slice(0,10);
    a.href=url; a.download='gains-backup-'+d+'.json';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },400);
    wsToastMsg('Backup saved to Files');
  }catch(e){ wsToastMsg('Download failed — try Share'); }
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
