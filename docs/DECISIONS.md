# Gains: product decisions

Decisions that are settled, with the reason for each, so they aren't argued
again from scratch. Reopen one when there is new evidence, not because a
different approach looks tidier. Newest reasoning wins: if code and this file
disagree, find out which is right and fix the other.

## 1. What gets recorded

**Only what was performed.** A training log that records the plan as if it
happened is worse than none, because every chart built on it is wrong in ways
you can't see.

- A strength set counts when its circle is ticked. **Editing a weight or rep
  count never ticks it.** Correcting a number is not saying you did the set.
- **"Apply to all sets"** changes only sets that are neither ticked nor
  warm-ups. Rewriting performed sets would falsify history.
- **Warm-ups** are recorded but excluded from volume, load, effort and records.
- **Cardio counts** when the timer has run for 30 seconds or more, when the run
  was finished, or when a distance was entered. A distance item's planned
  distance, a chosen intensity or a goal duration is not a performance. The
  30-second floor stops a timer started by accident from being logged as
  exercise.
- **Intervals count** when at least one work round completed. A finisher you
  skipped is not conditioning work.
- **LOG SESSION is enabled exactly when logging would save something.** The
  slider, the save and the boot clean-up use one shared test
  (`wsEntryHasWork` / `wsItemPerformed`). Before v55 they had separate rules,
  and the gap between them saved ghosts and dropped real work.
- **Clean-up of old data** (v55) removes only entries with no recorded work at
  all: strength with zero sets, intervals with zero rounds and zero work time,
  cardio with neither time nor distance. It never deletes a session, and it
  never guesses: cardio with a duration is kept even though old builds
  sometimes saved a planned duration, because the data can't tell them apart.

## 2. What number to enter (weight conventions)

These are conventions for what to type, not special cases in code. The aim is
that the recorded number means the same thing every time.

- **Barbell lifts:** total on the bar including the bar.
- **Machines:** loaded plates only. A machine's sled or carriage weight is
  specific to the gym and can't be known, so it isn't guessed.
- **Dumbbells used one per hand:** the weight of one dumbbell.
- **Bodyweight exercises** (pull-ups, dips, leg raises): logged as bodyweight
  plus an offset. Added weight is a positive offset, assistance is negative.
  Never logged as `weightKg`, or "+18 kg" would read as an 18 kg lift and
  corrupt volume and estimated 1RM.
- **Single-leg squats:** the added weight only. How much bodyweight loads the
  working leg can't be known, so it is left out rather than estimated.

## 3. Importing the old app

- **Merge is the default, and it keeps everything logged here.** Records
  already present are never touched. Imported days are skipped if their
  deterministic id (`legacy-YYYY-MM-DD`) is already there, so running it twice
  is safe. Results are sorted by date, because "the most recent session" is
  read from the end of the list. Same-day collisions are reported, not fused.
  "Replace my log" exists separately and is styled as dangerous.
- **Exercises are matched by name, not by the old app's id.** The old id was a
  plan slot whose contents changed over time. Matching on it would have fused
  different movements into one progress line.
- **Only sets marked completed are imported.** Unticked sets are training that
  never happened.
- **One calendar day (local time) is one session.** Parts of several plan days
  done together become one "Mixed session" that keeps where it came from.
- Name variants of the same movement are merged (e.g. "Dips" / "Weighted Dips").
- Old volume totals are discarded and recomputed, because they counted loaded
  sets only.
- Declared 1RMs and bodyweight from this app are left alone on merge.

## 4. Metrics

**Sets are the headline,** on every session-level surface. Volume (kg × reps)
counts bodyweight into calisthenics, so a push-up day out-"volumes" a heavy
bench day. Tonnage summed across different lifts barely means anything. Five-digit
numbers are hard to read, and cardio days read as zero. Sets are honest, readable,
comparable across exercise types, and they are what programmes are written in.
Volume still appears, but secondary and only like-for-like.

**Training trends** are four small charts sharing one time axis: sets, volume,
load, effort. Each has its own scale because the units don't mix. One chart
with several axes lets you imply any correlation you like by choosing scales.
You read the shapes against each other: heavier + fewer sets + higher effort
looks like a strength block, and everything down together looks like a layoff.

- **They cover the period picked at the top of Progress**, ending this week.
- **Only complete weeks are compared.** This week is drawn as an open dot and
  left out of every comparison. Counting two days of a week against seven
  makes steady training look like a slump every Monday. The figure beside each
  panel is last week's, labelled "last wk". (v55)
- **Load across all exercises is a fixed-basket index.** Each lift is compared
  only with its own first appearance in the window, then weighted by sets. A
  plain average of kg per set follows the exercise mix rather than strength:
  adding light accessories made a week of across-the-board progress read as a
  15% drop. A lift needs an earlier baseline week to count, and a week with
  fewer than two comparable lifts is a gap. For a single exercise, plain
  kilograms are shown, since there is no mix to correct for.
- **Effort is one rating per session** (session RPE, 1–10), asked for at the
  end of a workout and editable in Fix session. It's the construct the research
  supports for resistance training, and it can't be skewed by which exercises
  were in the session. Resolution order: the session rating, else the mean of
  per-exercise ratings, else nothing. **Never zero, never guessed.**
- **Estimated effort** for old sessions exists only as an explicit Settings
  action. Every estimate is flagged and badged "est", a real rating replaces
  it, and "Remove estimated ratings" undoes all of them.
- **Read-outs describe the shape, never the cause.** "Heavier, fewer sets"
  is fine. "You deloaded" or "you were ill" is not: a tracker that guesses a
  cause and gets it wrong loses trust in everything else it says.
- **Workload ramp** (sets in the last 7 days against the 4-week weekly average)
  sits at the bottom of Progress, labelled "descriptive, not a diagnosis". It
  used to be the headline, called "Load trend", and nobody could read it.

**Session comparison** ("was this better than the last one like it?") matches
on **content**, not the day's name. The best strictly earlier session by share
of working sets on shared exercises wins. Names fail on mixed days and after
plan edits. Every number compares **only the exercises both sessions
contain**, and the card says how many. Below 40% overlap it declines ("this one
becomes the baseline") rather than compare unrelated workouts.

**Adaptation mix** shows working sets by rep range (heavy 1–5, moderate 6–12,
light 13+) per muscle. The prime mover counts a full set and assisting muscles
a half. Otherwise one bench set would read as three sets of work. It
describes the mix and doesn't prescribe, because what you need depends on goals
and recovery the app doesn't know.

**Estimated 1RM** uses Epley on top sets. Declared 1RMs are something you tell
the app, never inferred from history.

## 5. Screens must agree

- The period chosen at the top of Progress frames every number below it:
  "This stretch", trends and adaptation mix.
- An empty period says so: "Nothing in the last 8 weeks", the date of your most
  recent session, and a button to show all time. It never says "No sessions yet"
  while History has sessions.
- The version shown anywhere is the version running. It has one source
  (`package.json`).

## 6. Look and feel

- **Warm dark, restrained, readable at arm's length mid-set.** Bebas Neue for
  display, DM Mono for numbers and labels, DM Sans for body text.
- **Colour carries meaning, never decoration:** ember = work and the brand, sage
  = rest and ready, lilac = setup, periwinkle = break between rounds,
  straw-gold = achievement (records, round complete), blue = cardio and
  distance, crimson = effort and risk.
- **No Liquid Glass.** Translucency costs legibility and battery and needs live
  blur. A gym app is read sweaty, at arm's length, sometimes upside down on a
  bench. Opaque, high contrast and big numerals win. The principles (clarity,
  content first) are kept, the material is not.
- **44 × 44pt minimum touch target** for everything tappable. Neighbouring
  controls are grown for real. An invisible enlarged hit area is used only on
  an isolated control, because overlapping ones steal each other's taps.
- **Text contrast at least 4.5:1** on every surface it appears on.
- The app honours **Reduce Motion** and **Increase Contrast**. Dynamic Type
  isn't supported yet (it needs a refactor away from fixed pixel sizes, tested
  on a device).
- Haptics aren't possible from a web app on iOS, so they are left out rather
  than faked.
- No automatic clustering of ad-hoc exercises into "days". The owner found the
  idea annoying. Saving a session as a day will be an explicit action.

## 7. Platform

- **One self-contained HTML file**, installed to the home screen from an https
  address. Opening a local file doesn't work: Safari blocks storage on `file:`.
  Home-screen web apps are also exempt from Safari's 7-day storage expiry.
- **Offline first.** The service worker serves the app from cache and refreshes
  in the background. A new build applies on the next launch, never mid-workout.
  It caches only same-origin, non-redirected responses, so a login page can
  never be cached as the app.
- **Hosting:** GitHub Pages from `main`. The address is hard to guess and the
  page is marked `noindex`. That's obscurity, not protection, which is fine
  because the only thing on the server is code and an exercise plan. An
  authentication gate was rejected: it needs signal before the app can open,
  and gyms often have none.
- **Storage:** one localStorage blob (`gains_v19_state`), with the previous
  good write kept as a backup slot. A failed write raises a visible warning;
  it never fails silently. The backup file is the real durability, and the app
  shows how old the last one is.

## 8. Security

- **No external dependencies, and nothing sent out.** Fonts are embedded. The
  CSP's `connect-src 'self'` means the page can't contact any other server,
  so even injected code would have nowhere to send data.
- **No API keys in the app.** The AI coach is "Tier 1": the app writes a
  training brief, and you paste it into whatever AI you already use. A key in
  browser storage is readable by any script on the page and is a billable
  credential. If an in-app AI is ever built: `connect-src` gets exactly one
  provider endpoint, the key never goes into the saved state or a backup, and
  the key is budget-capped at the provider.
- The real attack surface is **who can change the served file**, which means the
  GitHub account. Protect it with a passkey or authenticator 2FA.
- `script-src 'unsafe-inline'` is required by the single-file design. The
  mitigation is the `connect-src` lock and treating restored JSON as data
  (escaped on render).
