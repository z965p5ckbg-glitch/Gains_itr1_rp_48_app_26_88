# Working on Gains

This repository is the single source of truth for Gains, whichever Claude is
working on it: chat, Claude Code on the laptop, or a cloud session. There is no
other copy that counts. If you have an `index.html` from somewhere else, it is a
snapshot; reconcile it into `src/` here, never the other way round.

Read `README.md` for layout, build and deploy, and `docs/DECISIONS.md` before
changing anything a user sees. Recent history is in `docs/CHANGELOG.md`.

## Rules for changing code

1. **Edit `src/`, never `index.html` or `sw.js`.** Those are build output.
   `npm test` fails if they differ from what `src/` builds.
2. **One script, one scope.** `build.mjs` joins `src/js/*` into a single
   `<script>`. Function declarations hoist across files; top-level `let`/`const`
   do not. Reading a `let` before its file has run halts the whole app (blank
   screen). The legacy code guards this with `try{}` and `_wsPending*` holders.
   Follow that pattern rather than reordering files.
3. **Order is meaningful.** `src/manifest.json` lists CSS in cascade order and JS
   in load order. New CSS goes in a new file at the end (`20-v55.css` is the
   current one) or beside the rule it changes, never in the middle of the order.
4. **Run `npm test` before every commit.** Add a browser test for every bug you
   fix, and check that it fails on the old code before you trust it. For anything
   visual, run `npm run test:shots` and look at the screenshots.
5. **Never bump `WS_PERSIST_VERSION`** (in `04-persistence.js`) without writing a
   migration. On a mismatch the loader sets the user's whole log aside and starts
   fresh with demo data. That was acceptable before real data existed and is a
   data-loss bug now. `05-upgrade-from-live` will catch it.
6. **Bump `package.json` → `version` for every deploy.** It renames the
   service-worker cache, which is what makes phones fetch the new build. The
   new build arrives on the second reopen, never mid-workout.
7. **Don't trust line numbers or memory.** Grep for the function name and read
   the current code before changing it. Most past bugs came from acting on a
   remembered version of the file.
8. **A test that checks source text is weaker than one that taps the screen.**
   Don't add to `tests/legacy/`. Write `tests/e2e/` tests instead.

## Product rules that override convenience

The full reasoning is in `docs/DECISIONS.md`. The short version:

- **Only what was performed is recorded.** A set counts when its circle is
  ticked. Editing a value never ticks it. Untouched exercises, planned
  distances and skipped finishers are never saved. The LOG SESSION slider, the
  save and the boot clean-up share one definition (`wsEntryHasWork`,
  `wsItemPerformed` in `30-session-capture.js`). Keep them shared.
- **Never invent data silently.** Estimates are allowed only when the user asks,
  and are flagged in the data and on screen (`sessionRpeEstimated`, the "est"
  badge). A missing value is a gap, never a zero.
- **Compare like with like.** Trends compare complete weeks only. Session
  comparisons use only the exercises both sessions share. The load index
  compares each lift with itself. If there is no honest comparison, say so.
- **Describe, don't diagnose.** Read-outs name the shape of the data ("heavier,
  fewer sets") and never a cause ("you deloaded", "you were ill").
- **Sets are the headline metric.** Volume is secondary and only like-for-like.
- **44pt minimum for anything tappable**, measured on the rendered page
  (`08-tap-targets`). Neighbouring controls are grown for real. Invisible hit
  areas that overlap would make neighbours steal each other's taps.
- **One screen never contradicts another.** The period picked at the top of
  Progress frames every number below it (`07-coherence`).

## Privacy and security

- **This repository is public.** Never commit real training data, exports,
  backups, screenshots of real History, or numbers from real sessions, not even
  in a test, a comment or a commit message. Use synthetic fixtures. Put anything
  personal in `private/` (git-ignored).
- **Commit with a no-reply address**, never a personal email. On a new machine,
  set `git config user.email` to the GitHub no-reply address before the first
  commit.
- **No external requests.** The CSP in `src/shell.html` sets
  `connect-src 'self'`, so the page cannot contact any other server, and fonts
  are embedded. Don't add a CDN, analytics, or a script from anywhere else. If a
  feature seems to need one, raise it first.
- **No credentials in the app.** The AI coach is "copy a brief into your own AI".
  An API key in the browser was considered and rejected (see DECISIONS).
- Whoever can push to `main` controls the code that reads the user's data.
  Protect the GitHub account (passkey or authenticator 2FA), and give no
  third-party app write access.

## Testing caveats

The browser tests run Chromium, not Safari. They catch logic, layout, data and
upgrade problems, but not WebKit-only behaviour: iOS gestures, the home-screen
standalone shell, safe areas, audio unlock and Dynamic Type. Those still need a
check on the phone. Say which kind of check a claim rests on.

## Open threads

- The **Claude Code fork** (branched from v34, about a week of separate work)
  has not been reconciled. Rule: diff first and never overwrite. Where both
  lines changed the same feature, show both versions to the owner rather than
  picking one.
- Dynamic Type needs a refactor (fixed px everywhere) and device testing.
- Ad-hoc logging (something not in the plan) and "save this as a day" are agreed
  in principle, with no automatic clustering.
- Manual entry of a cardio duration timed elsewhere: not built. Entering a
  duration while idle sets the goal.
