// Cardio follows the same rule as sets: only what was performed is saved, and
// the LOG SESSION slider is enabled exactly when logging would save something.
//  - A distance item's PLANNED distance is not a performance.
//  - Picking an intensity is not a performance.
//  - A timer that has run 30s is, even if you never tap Done — and the slider
//    wakes up on its own at 30s, mid-run.
// Takes ~40s: the timer runs in real time.
import { serve, newPhone, open, reload, tab, slideToLog, startEmpty, wait } from '../lib/browser.mjs';

const slider = page => page.evaluate(() => {
  const t = document.getElementById('slideTrack');
  return t ? { enabled: !t.classList.contains('disabled'), label: document.getElementById('slideLbl').textContent } : null;
});
const cardioEntries = page => page.evaluate(() => HISTORY.flatMap(r => r.entries)
  .filter(e => e.kind === 'cardio').map(e => ({ name: e.name, sec: e.cardio.durationSec, m: e.cardio.distanceM || 0 })));

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    await startEmpty(phone);
    await tab(phone, 'today');
    const tabs = await page.$$('.d-tab');
    await tabs[4].click(); await wait(500);                // Day 5: jump rope, circuit, walk
    const plan = await page.evaluate(() => DAYS[curDay].items.map(ex => ex.name + ':' + (ex.distance || 0)));
    t.ok(plan.some(p => /:[1-9]/.test(p)), 'the plan carries a planned distance (the trap)', plan);

    let s = await slider(page);
    t.ok(s && !s.enabled, 'untouched day: slider stays disabled', s);
    t.ok(await page.evaluate(() => captureSessionRecord(curDay)) === null, 'untouched day: logging would save nothing');

    await page.evaluate(() => { openCardioEdit(0, 'intensity'); saveCardioEdit(); renderAll(false); }); await wait(300);
    s = await slider(page);
    t.ok(s && !s.enabled, 'picking an intensity does not make it "done"', s);

    await page.click('#rb0');                               // start the jump-rope timer
    await wait(12000);
    s = await slider(page);
    t.ok(s && !s.enabled, 'a timer under 30s does not count yet', s);
    await wait(20000);
    s = await slider(page);
    t.ok(s && s.enabled && /log session/i.test(s.label), 'at 30s the slider wakes up mid-run, no tap needed', s);

    await slideToLog(phone);
    const c = await cardioEntries(page);
    t.ok(c.length === 1 && /jump rope/i.test(c[0].name) && c[0].sec >= 30,
      'logging mid-run saves the jump rope with its real time — and nothing else', c);
    t.ok(await page.evaluate(() => HISTORY.length) === 1, 'exactly one session');

    await reload(phone);
    const after = await cardioEntries(page);
    t.ok(after.length === 1 && after[0].sec === c[0].sec, 'it survives a reload (and the boot clean-up)', after);
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
