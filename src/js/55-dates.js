
/* ════════════════════════════════════════════════════════════════════════════
   v58 — DATES, TIME ZONES AND CLOCK CHANGES
   ────────────────────────────────────────────────────────────────────────────
   Rules, so the app always agrees with the phone:
   - A moment is stored as an absolute instant (ISO with Z). Never shifted.
   - A DAY is the phone's local calendar day, read through Date's local
     getters. Never toISOString().slice(0,10): that is the UTC day, so a
     session at 00:30 local time filed under the day before.
   - Stepping by days or weeks uses the calendar (setDate), never ×86400000:
     a local day is 23 or 25 hours long on the day the clocks change.
   - Durations (rest timer, minutes elapsed) are differences of instants,
     which clock changes cannot affect.
   - The time zone is the phone's own (Intl), never a fixed one. If you travel,
     days follow the phone, exactly as the Clock and Calendar apps do.
   ════════════════════════════════════════════════════════════════════════════ */
function wsLocalDayKey(t){
  const d=(t instanceof Date)?t:new Date(t==null?Date.now():t);
  if(isNaN(d.getTime())) return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function wsLocalMidnight(t){
  const d=new Date(t==null?Date.now():t); d.setHours(0,0,0,0); return d.getTime();
}
function wsAddDays(t,n){
  const d=new Date(t); d.setDate(d.getDate()+n); return d.getTime();
}
function wsDeviceTimeZone(){
  try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(_){ return ''; }
}

// v59: a working set is a completed set that is not a warm-up. Every count of
// sets, volume, reps and records uses this one rule.
function wsIsWorkSet(s){ return !!s && s.completed!==false && !s.warmup; }
// v59: the calendar day a record belongs to: its own stored day if it has one
// (v59+), otherwise the phone's local day of its timestamp.
function wsRecordDayKey(rec){ return (rec&&rec.localDate)||wsLocalDayKey(rec&&rec.date); }
