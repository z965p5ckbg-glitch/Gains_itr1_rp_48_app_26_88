
// ── PACKET J (core) — PROFILE & BODY TRACKING ─────────────────────────
// Scope limits held deliberately: no goal weights, no BMI, no calorie or deficit
// maths, no body-composition estimates, and NO commentary on weight trajectory.
// The app has no dietary data and must not imply it does.
function wsProfile(){
  try{
    if(typeof settings!=='object'||!settings) return {};
    if(!settings.profile||typeof settings.profile!=='object') settings.profile={};
    return settings.profile;
  }catch(_){ return {}; }
}
function wsBodyLog(){
  try{
    if(typeof settings!=='object'||!settings) return [];
    if(!Array.isArray(settings.bodyLog)) settings.bodyLog=[];
    return settings.bodyLog;
  }catch(_){ return []; }
}
function wsLogWeight(kg, dateStr){
  const v=parseFloat(kg);
  if(!isFinite(v)||v<=0||v>400) return {ok:false,msg:'Enter a weight between 1 and 400 kg'};
  const d=(dateStr&&/^\d{4}-\d{2}-\d{2}$/.test(dateStr))?dateStr:(new Date()).toISOString().slice(0,10);
  const log=wsBodyLog();
  const i=log.findIndex(e=>e&&e.d===d);
  if(i>=0) log[i].kg=Math.round(v*10)/10; else log.push({d, kg:Math.round(v*10)/10});
  log.sort((a,b)=>a.d<b.d?-1:1);
  if(log.length>2000) settings.bodyLog=log.slice(-2000);
  if(typeof wsPersistFlush==='function') wsPersistFlush();
  return {ok:true,msg:'Logged '+(Math.round(v*10)/10)+' kg'};
}
function wsBodyLatest(){
  const log=wsBodyLog();
  return log.length?log[log.length-1]:null;
}
// 7-day rolling average. Raw daily weight swings 1-2 kg on water and food alone;
// a raw line reads as noise pretending to be signal.
function wsBodyAvg(days){
  days=days||7;
  const log=wsBodyLog(); if(!log.length) return null;
  const last=new Date(log[log.length-1].d+'T12:00:00').getTime();
  const cut=last-(days-1)*86400000;
  const win=log.filter(e=>new Date(e.d+'T12:00:00').getTime()>=cut);
  if(!win.length) return null;
  const sum=win.reduce((a,e)=>a+e.kg,0);
  return Math.round((sum/win.length)*10)/10;
}
function wsBodyTrend(){
  // Descriptive only. Never interpreted, never advised on.
  const log=wsBodyLog(); if(log.length<4) return null;
  const a=wsBodyAvg(7);
  const olderCut=new Date(log[log.length-1].d+'T12:00:00').getTime()-27*86400000;
  const older=log.filter(e=>{ const t=new Date(e.d+'T12:00:00').getTime();
    return t>=olderCut && t< (new Date(log[log.length-1].d+'T12:00:00').getTime()-6*86400000); });
  if(!older.length||a==null) return null;
  const b=Math.round((older.reduce((x,e)=>x+e.kg,0)/older.length)*10)/10;
  return {avg7:a, prev:b, delta:Math.round((a-b)*10)/10};
}
function wsProfileAge(){
  const p=wsProfile();
  if(!p.birthYear) return null;
  const y=parseInt(p.birthYear,10);
  if(!y||y<1900||y>new Date().getFullYear()) return null;
  return new Date().getFullYear()-y;
}
// Relative strength: e1RM per kg of bodyweight. Honest, free, and only shown
// where a bodyweight actually exists.
function wsRelStrength(limit){
  const bw=wsBodyLatest();
  if(!bw) return [];
  const B=wsProgBuild('ALL');
  const out=[];
  B.list.forEach(x=>{
    if(x.kind!=='weighted') return;
    if(x.allBest==null||!isFinite(x.allBest)) return;
    out.push({ name:x.name, best:x.allBest, ratio:Math.round((x.allBest/bw.kg)*100)/100 });
  });
  out.sort((a,b)=>b.ratio-a.ratio);
  return out.slice(0, limit||6);
}
