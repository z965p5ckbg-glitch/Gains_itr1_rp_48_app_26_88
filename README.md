# Gains

An offline workout tracker for iPhone, used from the home screen. It records
strength sets, cardio and interval circuits, and shows History, Progress and
personal records. There is no server and no account: everything you log stays
on the phone, in the browser's storage for this site.

What you install is one self-contained file, `index.html`, plus a service worker
(`sw.js`) that makes it open with no signal. Both are **built** from the sources
in `src/`. Never edit them by hand.

## Layout

```
src/
  shell.html        page skeleton, CSP, service-worker registration
  manifest.json     the order the CSS and JS files are joined in
  css/NN-*.css      styles, in cascade order
  js/NN-*.js        app code, in load order (one shared scope, see below)
  sw.js             service-worker source
build.mjs           joins src/ into index.html and sw.js, stamps the version
index.html, sw.js   BUILD OUTPUT — what GitHub Pages serves
tests/
  e2e/              browser tests: real Chrome at iPhone size, real taps and swipes
  legacy/           the v29–v54 regression harness, run against the current build
  fixtures/         the v44 build (for the upgrade test) and synthetic data only
docs/               product decisions and the changelog
```

The JS files are joined into **one** `<script>`, so they share one scope and a
function declared in any file can be called from any other. Keep it that way:
splitting into several scripts or ES modules would break that silently.

## Build and test

Requires Node 20+.

```sh
npm install          # first time only
npm run build        # src/ → index.html + sw.js
npm test             # checks the build is current, then runs every browser test
npm run test:shots   # same, and saves screenshots to tests/screenshots/
node tests/run.mjs trends cardio   # run only tests whose file name matches
```

The tests need Chrome. They find, in order: `CHROME_PATH`, the bundled
`@sparticuz/chromium` (Linux), or an installed Chrome/Chromium.

`npm test` must be green before anything is committed to `main`. The most
important test is `05-upgrade-from-live`: it installs the previous build,
logs real sessions through its UI, swaps in the new build at the same address,
reopens twice and checks every session survived. **If it fails, do not deploy.**

## Version

`package.json` → `version` is the only place the version lives. The build
stamps its major number into the page title, Settings, History and the
service-worker cache name. Bump it for every release that will be deployed;
the new cache name is what makes phones fetch the new build.

## Deploy

GitHub Pages serves `main` from the repository root. Deploying is:

1. `npm version major --no-git-tag-version` (or edit `version`), `npm run build`, `npm test`.
2. Commit `src/`, `index.html`, `sw.js`, `package.json` together and push `main`.
3. Wait about a minute for Pages to publish.

On the phone: close Gains fully, open it, close it, open it again. The first
launch fetches the new build in the background; the second runs it. Your data
is untouched. It is stored per site address, not per file.

## Your data

All of it is in this browser's storage for the site, on the phone. Apple does
not guarantee that storage forever (low storage, or clearing Safari data, wipes
it), so **Settings → Your data → Save backup file** every few weeks is the real
durability. The app shows how long it has been since the last backup.

Real training data never goes in this repository, which is public. Test
fixtures are synthetic. A local `private/` folder is git-ignored for anything
personal you need while developing.
