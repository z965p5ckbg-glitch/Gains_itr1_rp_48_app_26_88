
/* ════════════════════════════════════════════════════════════════════════════
   v61 — BACKUP REMINDERS AND UPDATES
   ────────────────────────────────────────────────────────────────────────────
   Your log lives only on this phone, so a backup file is the real safety net.
   The reminder appears in the one calm moment there is: the summary after you
   log a session. It is quiet, it can be put off, and it can be switched off.
   "Check for updates" says which version you have and whether a newer one is
   waiting, so you never have to guess whether the phone picked it up.
   Only function declarations here (they hoist across the joined script).
   ════════════════════════════════════════════════════════════════════════════ */

// Due when there is something worth saving: never backed up and 3+ sessions,
// or a week since the last backup with at least one new session since. Not
// while put off ("Later": 3 days), and never when switched off.
function wsBackupRemindOn(){ try{ return settings.backupRemind!==false; }catch(_){ return true; } }
function wsBackupDue(){
  try{
    if(!wsBackupRemindOn()) return null;
    const now=Date.now();
    if(settings._backupSnoozeUntil && settings._backupSnoozeUntil>now) return null;
    const hist=Array.isArray(HISTORY)?HISTORY:[];
    const last=settings._lastBackupAt||0;
    const fresh=hist.filter(r=>{ const t=new Date(r&&r.date).getTime(); return !isNaN(t) && t>last; }).length;
    const age=wsBackupAgeDays();
    if(age===null) return hist.length>=3 ? {age:null, fresh:fresh} : null;
    if(age>=7 && fresh>=1) return {age:age, fresh:fresh};
    return null;
  }catch(_){ return null; }
}
function wsBackupAgeText(age){
  if(age===null) return 'Never backed up';
  if(age===0) return 'Backed up today';
  return 'Last backup '+age+(age===1?' day':' days')+' ago';
}
function wsBackupReminderHtml(){
  const due=wsBackupDue(); if(!due) return '';
  const what=due.age===null
    ? 'Never backed up. Your log lives only on this phone.'
    : wsBackupAgeText(due.age)+' · '+due.fresh+' new session'+(due.fresh===1?'':'s')+' since.';
  return `<div class="fkb" id="fkBackup" role="region" aria-label="Backup reminder">
    <div class="fkb-t">${what}</div>
    <div class="fkb-row">
      <button class="fkb-go" onclick="wsBackupNow()">Back up now</button>
      <button class="fkb-later" onclick="wsBackupLater()">Later</button>
    </div>
  </div>`;
}
function wsBackupNow(){
  wsBackupDownload();
  // the date is recorded only once the file has gone somewhere; refresh then
  setTimeout(()=>{ try{ if(!wsBackupDue()){ const b=document.getElementById('fkBackup'); if(b) b.remove(); } }catch(_){} },1500);
}
function wsBackupLater(){
  try{ settings._backupSnoozeUntil=Date.now()+3*864e5; wsPersistSave(); }catch(_){}
  const b=document.getElementById('fkBackup'); if(b) b.remove();
}
function wsSetBackupRemind(on){
  try{ settings.backupRemind=!!on; wsPersistSave(); }catch(_){}
  const t=document.getElementById('togBackupRemind'); if(t) t.classList.toggle('on',!!on);
}
// Settings: the data row says how old the last backup is.
function wsSettingsBackupSync(){
  try{
    const sub=document.getElementById('dataRowSub'); if(!sub) return;
    const age=wsBackupAgeDays(), n=(Array.isArray(HISTORY)?HISTORY:[]).length;
    const stale=(age===null&&n>0)||(age!==null&&age>=7);
    sub.textContent=wsBackupAgeText(age)+(n?' · '+n+' session'+(n===1?'':'s')+' on this phone':'');
    sub.classList.toggle('stale',stale);
    const t=document.getElementById('togBackupRemind'); if(t) t.classList.toggle('on',wsBackupRemindOn());
  }catch(_){}
}

// ── updates ──────────────────────────────────────────────────────────────────
// Reads the version from the live index.html (bypassing the offline cache via
// the ?gains-check marker the service worker lets through), and if it is newer,
// asks the service worker to fetch it now so it opens next time.
function wsParseVersion(html){ const m=String(html||'').match(/const GAINS_VERSION='(\d+)'/); return m?m[1]:null; }
function wsUpdateSub(html){ const s=document.getElementById('appVerSub'); if(s) s.innerHTML=html; }
async function wsCheckUpdate(){
  const btn=document.getElementById('appVerBtn');
  if(btn) btn.disabled=true;
  wsUpdateSub('Gains v'+GAINS_VERSION+' · checking…');
  try{
    const res=await fetch('./index.html?gains-check='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('http '+res.status);
    const latest=wsParseVersion(await res.text());
    if(!latest) throw new Error('no version');
    if(+latest<=+GAINS_VERSION){ wsUpdateSub('Gains v'+GAINS_VERSION+' · up to date'); return 'current'; }
    try{
      const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();
      if(reg){ await reg.update(); await wsWaitForWorker(reg,15000); }
    }catch(_){}
    const busy=!!(DAYS[curDay]&&!DAYS[curDay].logged&&wsDayHasWorkSafe());
    wsUpdateSub('v'+wsEscape(latest)+' is ready · it opens next time you open the app'+
      `<button class="ws-upd-restart" onclick="wsRestartForUpdate()">${busy?'Restart now (your ticked sets are kept)':'Restart now'}</button>`);
    return 'ready';
  }catch(e){
    wsUpdateSub('Gains v'+GAINS_VERSION+' · couldn’t check'+(navigator.onLine===false?' (offline)':''));
    return 'error';
  }finally{ if(btn) btn.disabled=false; }
}
function wsWaitForWorker(reg,ms){
  return new Promise(res=>{
    const w=reg.installing||reg.waiting;
    if(!w){ res(); return; }
    const done=()=>{ if(w.state==='activated'||w.state==='redundant') res(); };
    w.addEventListener('statechange',done); done();
    setTimeout(res,ms);
  });
}
function wsRestartForUpdate(){
  try{ wsPersistFlush(); }catch(_){}
  location.reload();
}
