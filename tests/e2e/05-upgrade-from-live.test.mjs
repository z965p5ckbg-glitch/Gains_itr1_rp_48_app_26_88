// The most important test in the suite. Rehearses exactly what happens on the
// phone when a new build is pushed:
//   1. the previous build (tests/fixtures/v44.html — byte-identical to what the
//      phone ran until v55) is live at a URL, service worker and all
//   2. real sessions are logged through its real UI
//   3. the site is replaced with the current build at the SAME url
//   4. the user reopens the app twice
// Every session must survive, demo data must not come back, and the new build
// must boot clean. If this fails, do not deploy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, newPhone, tab, tapCheck, slideToLog, startEmpty, wait, appState } from '../lib/browser.mjs';

export default async function (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gains-site-'));
  const deploy = (html, sw) => { fs.copyFileSync(html, path.join(dir, 'index.html')); fs.copyFileSync(sw, path.join(dir, 'sw.js')); };
  deploy(path.join(t.root, 'tests/fixtures/v44.html'), path.join(t.root, 'tests/fixtures/v44-sw.js'));
  const site = await serve(dir);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await page.goto(site.url, { waitUntil: 'load' }); await wait(1500);
    t.ok(/v44/.test(await page.title()), 'previous build is live', await page.title());
    const swReady = await page.evaluate(async () => !!(navigator.serviceWorker && await navigator.serviceWorker.getRegistration()));
    t.ok(swReady, 'previous build registered its service worker');

    // Two real sessions on the old build, through its own UI.
    await startEmpty(phone);
    await tab(phone, 'today');
    await tapCheck(phone, 0); await tapCheck(phone, 1); await tapCheck(phone, 2);
    await slideToLog(phone);
    await page.evaluate(() => resetDay()); await wait(300);
    await page.evaluate(() => switchDay(1)); await wait(400);
    await tapCheck(phone, 0);
    await slideToLog(phone);
    const before = await appState(phone);
    t.ok(before.history.length === 2, 'two sessions logged on the old build', before.history.length);
    const empties = s => s.history.flatMap(r => r.entries).filter(e => (e.kind === 'weighted' || e.kind === 'bodyweight') ? e.sets === 0 : false).length;
    t.ok(empties(before) > 0, 'the old build saved untouched exercises (the bug being cleaned up)', empties(before));
    const fingerprint = s => s.history.map(r => r.date + ':' + r.entries.reduce((n, e) => n + e.sets, 0)).sort().join('|');
    const want = fingerprint(before);

    // Ship the current build at the same URL.
    deploy(path.join(t.root, 'index.html'), path.join(t.root, 'sw.js'));
    const current = (fs.readFileSync(path.join(t.root, 'index.html'), 'utf8').match(/<title>([^<]*)<\/title>/) || [])[1];

    await page.reload({ waitUntil: 'load' }); await wait(1500);   // reopen #1 (may still be cached)
    await page.reload({ waitUntil: 'load' }); await wait(1500);   // reopen #2
    t.ok((await page.title()) === current, 'after reopening twice the phone runs the new build', { got: await page.title(), want: current });

    const after = await appState(phone);
    t.ok(fingerprint(after) === want, 'every session survives the upgrade, set for set', { before: want, after: fingerprint(after) });
    t.ok(after.history.length === 2, 'demo data is not re-injected over real data', after.history.length);
    t.ok(empties(after) === 0, 'untouched exercises saved by the old build are cleaned out', empties(after));
    const hiitGhosts = await page.evaluate(() => HISTORY.flatMap(r => r.entries).filter(e => e.kind === 'hiit' && !((e.hiit || {}).roundsDone > 0) && !((e.hiit || {}).workSecTotal > 0)).length);
    t.ok(hiitGhosts === 0, 'skipped HIIT finishers no longer count as work', hiitGhosts);
    for (const name of ['history', 'progress', 'prs', 'today']) await tab(phone, name);
    t.ok(phone.errors.length === 0, 'new build boots and renders every tab with no errors', phone.errors);
    if (t.shots) { await tab(phone, 'history'); await page.screenshot({ path: t.shotPath('upgrade-history.png') }); }
  } finally {
    await phone.close(); await site.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
