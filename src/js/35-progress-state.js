

// ═══════════════════════════════════════════════════════════════════
// PROGRESS UI (Iteration 1) — exercise-first overview. Renders into histView.
// Time-frame control → at-a-glance hero → scrollable per-exercise cards,
// each with an SVG sparkline + computed plain-language insight.
// ═══════════════════════════════════════════════════════════════════
let wsProgFilter='all';      // all | strength | cond | cardio | days
let wsProgSort='recent';     // recent | movers | stalled
let wsProgMuscleSel=null;    // muscle-name filter from bar tap
let wsProgQ='';              // live search text
