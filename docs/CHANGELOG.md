# Gains: changelog

Newest first. One entry per deployed version. The reasons behind lasting
choices are in `DECISIONS.md`. The full blow-by-blow from v29 to v54 lives in
the project's original notes and isn't repeated here.

> **v45–v54 were built but never deployed.** The phone ran v44 until v55, so
> v55 is the first time any of the v45–v54 work reaches it.

## v61: honest numbers, readable everywhere, workouts and sessions, safer data
**Progress measures what it says**
- Sets per muscle is a true weekly average: it divides by the complete calendar weeks in the period (Monday to Sunday), leaves this unfinished week out, and starts counting at your first strength session. It used to divide by the time between your first and last session, so one week of training read as a full weekly average.
- The main muscle counts a whole set and helpers half (bench: chest 1, triceps and front delts ½), the same rule the adaptation mix already used. Warm-ups never count.
- The panel says what the number is: "estimated, a week, over 8 complete weeks", and how sets are counted. With no complete week yet it says when there will be.
- Warm-ups no longer feed the estimated max.

**Readable on every screen**
- Nothing that carries meaning is smaller than 13px anywhere in the app: tab bar, History, Progress, PRs, Settings, the plan editor, the library and the picker included. A test walks every screen and measures.

**Workouts and sessions**
- The plan is made of workouts; what you logged is a session. "Day" now means only a calendar day. The plan screen, editor, library, picker, delete dialog and messages all changed. New installs name their workouts "Workout 1, 2…"; your own names are never touched (tap the name at the top of Today to rename one).

**Backups and updates**
- After you log a session, the summary reminds you to back up when you never have, or when it has been a week and there is something new. "Later" puts it off for three days; Settings has a switch to turn it off.
- Settings shows how old your last backup is, highlighted when it's over a week.
- "Check for updates" in Settings says whether you're up to date or a newer version is ready, with a Restart button.
- The offline copy now always checks the server when it refreshes. Before, the browser's own cache could hand back an older copy and overwrite a build that had just arrived.

**Supersets in the workout editor**
- A link button pairs an exercise with the one below it; paired rows show A1, A2 and a bracket. Drag to choose the order.
- Removing or moving an exercise can no longer pair two exercises that weren't paired (pairing was stored as "with the next one", so a removal could link a stranger).
- Long exercise names wrap to two lines in the editor.

**Security**
- A full pass over every place data becomes HTML. Ids from a backup (session ids, exercise ids) sat inside tap handlers, where HTML escaping isn't enough: the browser turns `&#39;` back into a quote before the handler runs. A crafted backup could run code from History, Progress, PRs, the library and the picker. All of them now go through `wsJs`. Interval station names, cardio intensity tags, custom exercise muscles and the full-screen timer name are escaped too. A new test (`21-hostile-data`) restores hostile data and taps through every screen.

## v60: the workout screen, third pass
**One next thing at a time**
- Only the set that is up next has an orange ring. Every other exercise still shows its next set with the steppers, but in neutral, so the page no longer shows five orange rows at once.
- An **Up next** line under the set counter names that set ("UP NEXT · A2 · Face Pull · 20 × 10"); tap it to scroll there. It follows the set you ticked last: your superset partner, then the same exercise, then the ones below.
- **Finish** beside the counter takes you to the LOG SESSION slider from anywhere. Sliding still confirms.
- Once the counter scrolls away, a slim bar at the top keeps the count, Up next and Finish one tap away.

**Rest timer**
- The round button says what it does: START, PAUSE or RESUME, inside the button.
- A full-width progress bar sits under the time and fills as you rest (VoiceOver reads it too). The line beside the time only says what the number means ("left of 1:30").

**Set circles**
- An unticked set shows a grey tick again, so the circle reads as "tap to mark done". Done stays filled cream with a dark tick.

**Supersets: pair with any exercise**
- "Pair with next" is now **Superset with…**. It lists every other exercise in the workout; pick one and it moves to sit right after this one, from wherever it was, above or below. Undo puts the order back.
- Inside a superset the same button reads "Superset A" and lets you add a third (a giant set) or take the exercise out.
- Under the superset heading, one line says how it runs: "A1 → A2, then rest."
- The new order and pairing are saved with the workout, so they stand next time.

**Also**
- The workout you're on is a neutral tab; orange stays for the next action and the header word.
- Messages no longer shrink to half the screen; one with Undo puts the button beside the text.
- Security: a workout's two-line title (stored as a little HTML) is no longer trusted. From a restored or imported file it could have run code; now only the line break and the second-line style survive, and everything else is shown as text.

## v59: what the independent review proved, plus the timer and stepper notes
**Your records are trustworthy**
- Warm-ups stay warm-ups in History. They were dropped when a session was saved, so every count, volume, record and trend treated warm-ups as working sets. (Sessions saved before v59 can't be repaired: the information wasn't kept.)
- Logging is all-or-nothing. The record is built and saved first; only then is the day marked logged. If either step fails, the day stays open with every tick and you're told so.
- Each saved session keeps its own local day, time zone, start and end, and each set the moment it was ticked. A trip abroad can't move a session to another day, and the summary's duration comes from the record.
- Removing a set is saved straight away, and removing one you'd done offers Undo.
- Messages now actually appear. They lived inside the plan editor's hidden panel, so on other screens you never saw them, including "Not saving — export a backup now".
- Text from your data (exercise names, cues, day labels, interval steps) is always shown as text and can never run as code, including from an imported or restored file.

**Workout screen**
- Supersets: ticking A2 before A1 no longer starts the rest; a round is done when every exercise in it has done its set, in any order.
- The summary says exactly what moved: BEST EST. 1RM (an estimate, named as one), TOP WEIGHT UP, +1 SET, +2 REPS, or SAME. One more set than last time used to read "held".
- Shortening a rest below the time already rested ends it (it used to sit on 0:01). When the app comes back from the lock screen, rests settle at once from the clock.
- The timer is back to the earlier design's round start/pause button, with a ring that fills as you rest and a progress bar along the bottom, inside the new inline card. −15 s, +15 s and Skip below; tap the time for the slider; sound and shrink at the top right.
- Weight steps are chosen by exercise: big lifts move by 0.5 kg, smaller lifts by 0.25 kg, changeable per exercise in the set sheet (where the step chooser is now folded away). Weights show quarter kilos exactly (70.75, not 70.8).
- On phones narrower than 375pt the next-set row wraps instead of letting its buttons overlap.
- The elapsed-time line is gone. Small text on the workout screen is at least 13px; running text at least 14px.

## v58: the workout screen, second pass (built on v57, which was never deployed)
- **Rest waits for you by default.** Ticking a set puts the timer under it, ready; tap ▶ to start. "Start rest automatically" is in Settings and in the rest sheet.
- **The timer keeps the old one's controls in the new look**: start/pause, −15 / +15, Skip, sound on/off, shrink to a slim bar (with its own play button), and tap the time to set the length with one slider. One rule for every change: the rest is a length you are partway through, so changing the length moves the time left by the same amount, and both are always shown ("1:20 · Left · of 1:45"). The sheet shows the live time left as you drag.
- **The docked timer moves smoothly**: it slides up from the tab bar when the running rest scrolls away, glides back to its place when the rest comes back into view, and slides away when paused or skipped (instant with Reduce Motion).
- **Supersets**: "Pair with next" at the foot of an exercise. Paired exercises show as A1/A2 under one heading; there is no rest between them, and rest starts after the round. Three or more make a giant set.
- **An unticked set is an empty ring**, with no tick inside.
- **Tapping a weight or reps opens the set sheet with sliders** for both, plus the weight step for that exercise (0.5, 1, 1.25, 2, 2.5 or 5 kg), remembered for that exercise everywhere. Defaults: barbell, machine and cable 2.5, dumbbell 2, added bodyweight load 1.25. The + and − steppers use the same step.
- **SETS − n +** at the foot of every exercise.
- **The set counter is large and orange** at the top, and the time line says what it is: "STARTED 18:16 · 31 MIN IN", ticking on its own.
- **Days follow the phone.** The consistency grid, bodyweight dates and backup file names use the phone's local day (they used the UTC day, so a session at 00:30 counted on the day before), days are stepped by the calendar so the 23- and 25-hour days of a clock change can't shift them, and the old-app import uses the phone's time zone instead of a fixed one.
- The old-app import no longer writes a fixed bodyweight into records or your profile; it uses the bodyweight you entered, or leaves it out.

## v57: the workout screen
- **One scrolling page for the whole session.** Each exercise shows every set. Its next set (the first one not yet ticked) is the only row with steppers and the orange check; the others are one quiet line each, still tappable. Ticking moves the mark on. When every set is done, the exercise goes quiet and says DONE. Each exercise keeps its own mark, so you can move between exercises in a superset without losing your place.
- A set bar under each exercise (done, next, to do), the exercise number on the right, and last time's sets and date under the name ("LAST 65 × 8·8·8·8 · 13 OCT").
- **Rest starts by itself** when you tick a set, directly under that set: pause and resume, a pencil that opens one slider for the length (and the end-of-rest sound), Skip, and a button that shrinks it to a slim bar (remembered). If you scroll away it docks above the tab bar; tap it to go back. One rest at a time: ticking a set in another exercise moves the rest there. Un-ticking the set cancels its rest.
- The countdown follows the clock, so after the phone has been locked it shows the real time left instead of resuming where it froze.
- Editing a value no longer resets a running rest.
- **What you did carries forward**: change the weight or reps on a set and tick it, and the later sets that still had the same planned numbers take yours. Sets you changed yourself, and pyramids, are left alone.
- **Logging opens a summary** built from the saved record: sets, exercises, records, each exercise against the last time you did it, what was not done (so not saved), and the session effort rating. Done closes it; Undo (10 seconds) takes the record back out of History with every tick still in place.
- Colour has one job each on this screen: orange is the next thing to do, cream is done, blue is rest, gold is a record. The per-exercise effort pill and the 1RM figure are neutral now.
- Exercise names are cream, not orange. "+ Set / − Set" moved from the header to the foot of each exercise.

## v56: backup that works on the phone
- **Save backup file** now opens the iPhone share sheet with a real `.json` file (Save to Files is one tap). An iPhone home-screen app ignores ordinary downloads, so the button used to do nothing. The separate "Share backup…" row is gone; the backup date is recorded only once the file is actually saved.
- Settings closes by swiping the grabber down, not only with Done (all bottom sheets with a grabber).
- Progress no longer drops the weeks before a clock change. Since summer time ended on 25 Oct, every week before that date had vanished from the weekly trend charts, in every time frame, and the same would have happened after every clock change.
- Removed two settings rows that did nothing ("Export workout history — coming soon", "Help & tips"), and the stale "Gains 0.19 — prototype" label now shows the real version.

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
