
const ICONS={
  rowing:{name:'Row',svg:'<path d="M3 13.5c1.2-1 2.4-1 3.6 0s2.4 1 3.6 0 2.4-1 3.6 0 2.4 1 3.6 0 2.4-1 3.6 0M5 9 L9 11 L11 9 L13 11 L15 9 L17 11 L19 9 L20 5 L17 6 L15 9"/>'},
  run:{name:'Run',svg:'<circle cx="14.5" cy="4" r="2"/><path d="M11 11 L13 9 L16 9 L17 12 L17 16 L19 19 L17 21 L15 18 L15 14 L13 14 L13 17 L9 22 L7 21 L11 16 L11 11 L9 9 L6 11 L5 14 L3 13 L5 9 Z"/>'},
  bike:{name:'Bike',svg:'<circle cx="5" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="14" cy="5" r="1.5"/><path d="M5 17 L11 9 L16 13 L19 17 M11 9 L13 7 L16 9 L14 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'},
  swim:{name:'Swim',svg:'<circle cx="6" cy="6" r="2"/><path d="M3 10 L9 12 L13 8 L18 10 L21 8M2 16c2-1.2 3 .8 5 0s3-.8 5 0 3 .8 5 0 3-.8 5 0M2 20c2-1.2 3 .8 5 0s3-.8 5 0 3 .8 5 0 3-.8 5 0"/>'},
  jump:{name:'Jump',svg:'<circle cx="12" cy="3" r="1.8"/><path d="M9 8 L12 6 L15 8 L18 11 L17 13 L15 12 L14 15 L17 21 L15 22 L12 18 L9 22 L7 21 L10 15 L9 12 L7 13 L6 11 Z"/>'},
  kettlebell:{name:'KB',svg:'<path d="M9 5 Q9 3 12 3 Q15 3 15 5 L15 6.5 Q19 8 19 14 Q19 21 12 21 Q5 21 5 14 Q5 8 9 6.5 Z M10 5.5 Q10 4.5 12 4.5 Q14 4.5 14 5.5"/>'},
  climb:{name:'Climb',svg:'<circle cx="14" cy="3.5" r="1.6"/><path d="M14 6 L11 9 L8 7 L7 9 L10.5 12 L9 15 L7 13 L5 14 L9 18 L7 22 L9 22 L11 18 L13 19 L11 22 L14 22 L17 18 L20 19 L20 17 L15 14.5 L17 11 L20 12 L20 10 L17 8 L17.5 6 Z"/>'},
  box:{name:'Box',svg:'<circle cx="9" cy="4" r="1.8"/><path d="M7 7 L8 11 L4 12.5 L4 15 L8 14 L9 18 L7 22 L11 22 L13 17 L17 18 L20 14 L17 11 L14 13 L13 8 Z"/>'},
  yoga:{name:'Yoga',svg:'<circle cx="12" cy="3.5" r="1.5"/><path d="M12 6 L12 9 L8 11 L4 13 L5 15 L9 13 L11 12 L13 12 L15 13 L19 15 L20 13 L16 11 L12 9 M12 13 L11 18 L8 22 L11 22 L12 19.5 L13 22 L16 22 L13 18 Z"/>'},
  dance:{name:'Dance',svg:'<circle cx="14" cy="4" r="1.5"/><path d="M14 6 L13 9 L17 9 L19 13 L18 14 L15.5 11 L15 14 L17 18 L17 22 L15 22 L14.5 18 L13 14.5 L11 18 L9 22 L7 22 L8 18 L10 14 L8 11 L4 12 L3 10 L8 8 L11 8 Z"/>'},
  walk:{name:'Walk',svg:'<circle cx="13" cy="4" r="1.6"/><path d="M11 7 L13 6 L16 9 L17 13 L15 13 L14 11 L13 14 L15 18 L14 22 L12 22 L12 18 L10 15 L7 18 L5 17 L9 13 L10 9 Z"/>'},
  hike:{name:'Hike',svg:'<circle cx="14" cy="3" r="1.6"/><path d="M14 5.5 L13 9 L9 11 L9 13 L12 12 L11 16 L8 19 L6 22 L8.5 22 L11 19 L13 17 L14 21 L14 22 L16 22 L16 18 L14 14 L17 13 L20 14 L21 12 L17 10 L15 9 Z"/>'},
};

// ─────────────────────────────────────────────────────────────────────
// EXERCISE LIBRARY (catalog)
//
// Each library entry has a stable `exId` that day-instances reference. The
// catalog stores defaults used only when ADDING an exercise to a day —
// editing the library never reaches into existing day data. Identity (exId)
// is what lets the data section roll up logs across days. Title is the
// grouping key (siblings share a title); subtitle is the variant qualifier.
// muscles[] and pattern are optional metadata, exposed when the user enables
// "Advanced Exercise Tags" in settings.
//
// Kinds: 'weighted', 'cardio_time', 'cardio_distance', 'cardio_intervals'.
// (Bodyweight is just 'weighted' with the user logging added weight or 0.)
// ─────────────────────────────────────────────────────────────────────

// Default-set factories for the starter catalog.
function _setsW(weight,reps,n){const a=[];for(let i=0;i<n;i++)a.push({w:weight,r:reps});return a;}
