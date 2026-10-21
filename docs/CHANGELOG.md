# Gains: changelog

Newest first. One entry per deployed version. The reasons behind lasting
choices are in `DECISIONS.md`. The full blow-by-blow from v29 to v54 lives in
the project's original notes and isn't repeated here.

> **v45–v54 were built but never deployed.** The phone ran v44 until v55, so
> v55 is the first time any of the v45–v54 work reaches it.

## v55: the repository becomes the source of truth

**How the app is built and tested**

- The single 1.2 MB file was split into readable sources (`src/`), and a build
  joins them back together. The first build reproduced v54 byte for byte.
- A real-browser test suite (Chrome at iPhone size, real taps and swipes)
  replaces "the harness passed". It includes rehearsing the upgrade from the v44
  build the phone runs, with sessions logged through v44's own UI.
- The version comes from `package.json` alone. History said "v42" since v42.

**Only what was performed is saved**

- Until v54, logging a session saved every item on the day. An untouched
  exercise showed in History with zero sets, and a skipped HIIT finisher
  counted as conditioning. Now only performed work is saved. On first launch,
  empty entries saved by old builds are removed. Real entries and sessions are
  never touched.
- The LOG SESSION slider, the save and that clean-up now share one rule, so the
  slider is enabled exactly when logging would save something.
- Cardio: choosing an intensity or a goal no longer marks the item done, and a
  distance item's planned distance is no longer saved as if it happened. A
  timer left running for 30s+ is saved with its real time even if you never
  tap Done.
- At 30s into a cardio timer the slider lit up but ignored swipes. Fixed.

**Progress tells the truth**

- An empty period says so ("Nothing in the last 8 weeks", your last session's
  date, "Show all time"), instead of "No sessions yet" beside a full History.
- Trends and adaptation mix follow the period you pick. They had been fixed at
  12 weeks under an "8 weeks" label, ending at your last session rather than
  today.
- Comparisons use complete weeks only. This week is an open dot. Steady
  training no longer looks like a slump early in the week. The figure beside
  each trend is last week's, and says so.
- "34t kg" is now "34 t".
- The consistency grid is captioned and ends today.
- The period selector is a proper segmented control again, no longer clipped
  at the screen edges.

**44pt tap targets, measured on screen**

- Set rows: the number you tap to type a value was 30pt wide, and "102.5"
  spilled over the + button, so tapping the edge of the number added a kilo.
  The "×" between weight and reps is gone (KG and REPS say it), and the value
  is at least 44pt, including on a 375pt-wide phone.
- Day tabs, the rest-timer controls, Progress filters and search, and PRs
  chips now all reach 44pt.

## v54: merge import
Importing the old app merges by default and keeps everything logged in Gains.
Running it twice is safe, results are date-sorted, same-day collisions are
reported, and declared 1RMs and bodyweight are left alone. "Replace my log" is
separate and styled as dangerous.

## v53: set lifecycle; search aliases
After a session is logged, the day view's set checks, steppers and edits are
locked, with a pointer to History → Fix this session, so the screen can no longer
diverge from the record. Search aliases were added to high-traffic exercises
("hex bar", "ab wheel", "rdl", "pec deck"…). Fifteen exercises were added.

## v52: adaptation mix
Working sets by rep range (heavy / moderate / light) per muscle. Prime movers
count a full set, assisting muscles a half. A sweep found that `addSet` never
saved (fixed) and two settings shared one element id (fixed).

## v51: Fix session can add; drag that works
You can add an exercise to an already-logged session, built in exactly the
recorded shape so every chart picks it up. "Fix this session" became a real
button. Drag-to-reorder no longer cancels on a finger's natural drift. Only
movement that looks like a scroll cancels it.

## v50: like-for-like session comparison
"Was this better than the last one like it?" matches on content, compares
only shared exercises, and declines below 40% overlap.

## v49: load index and session effort
The Load panel became a fixed-basket index. A plain average of kg per set had
reported a 15% drop in a week where every repeated lift held or rose. Effort
moved to one rating per session. Estimated backfill exists only as an explicit,
flagged and reversible action. The workload ramp moved to the bottom, labelled
descriptive.

## v48: training trends
Four small charts (sets, volume, load, effort) on one time axis replaced the
unreadable acute:chronic "Load trend" headline.

## v47: data-integrity fixes
"Apply to all sets" no longer overwrites performed sets and warm-ups, and now
saves. Editing a value no longer ticks the set. The warm-up toggle actually
works. Icon changes save.

## v46: accessibility
A first tap-target pass (57 controls raised to 44pt, including the set check),
plus Reduce Motion and Increase Contrast support and a contrast fix for the
quietest text colour.

## v45: import, catalog fixes, interval presets
Import from the old app, matched by name rather than slot id, completed sets
only, and bodyweight lifts as offsets. Mis-kinded catalog entries fixed, and
Assault Bike, SkiErg, Battle Ropes, Burpee, Wall Ball and outdoor rowing added.
Named interval presets (Tabata, 30:15, 40:20, 1:1, 1:2, Norwegian 4×4) with a
step size that adapts to the value.

## v44: daily-driver ergonomics (the build on the phone until v55)
A loud warning when saving fails (it used to fail silently), backup age shown,
numeric keypads, the keyboard no longer covers the field being typed into, and
no long-press callouts.

## v43: first real-use fixes
Content no longer sits under the status bar. "About me" and backup are easy to
find. "Clear log" really clears. The service worker fetches fresh on update,
and the build is stamped with its version.

## v29–v42
The library of about 600 exercises, the interval engine and full-screen
circuit view, Progress and PRs, offline service worker, strict CSP with
embedded fonts, the AI coach brief (copy into your own AI), and profile and
bodyweight.
