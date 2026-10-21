
// ── CORRECTIONS. Real logging means real mistakes: a session tapped complete
//    by accident, a weight typed wrong, an exercise you never actually did.
//    Without a way to fix them, wrong data is permanent — and wrong data
//    poisons PRs, trends and every insight built on top of them.
function wsFindRec(id){
  const i=(HISTORY||[]).findIndex(r=>String(r.id)===String(id));
  return {i, rec:i>=0?HISTORY[i]:null};
}
function wsDeleteSession(id){
  const {i,rec}=wsFindRec(id); if(!rec) return false;
  HISTORY.splice(i,1);
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  if(typeof hiRender==='function') hiRender();
  try{ if(typeof currentView!=='undefined'&&currentView==='progress') wsProgRender(); }catch(_){}
  wsToastMsg('Session deleted');
  return true;
}
function wsDeleteEntry(id, idx){
  const {rec}=wsFindRec(id); if(!rec||!Array.isArray(rec.entries)) return false;
  if(idx<0||idx>=rec.entries.length) return false;
  rec.entries.splice(idx,1);
  if(!rec.entries.length){ return wsDeleteSession(id); }
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  if(typeof hiRender==='function') hiRender();
  try{ if(typeof currentView!=='undefined'&&currentView==='progress') wsProgRender(); }catch(_){}
  wsToastMsg('Exercise removed');
  return true;
}
