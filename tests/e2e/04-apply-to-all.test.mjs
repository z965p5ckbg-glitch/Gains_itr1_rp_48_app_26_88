// "Slide to apply weight to all sets" must never rewrite sets you have
// already performed. v44 (still live on the phone as of v55) overwrote them.
// Also: editing a value is not a claim that you did the set.
import { serve, newPhone, open, tab, tapCheck, slide, startEmpty, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    await startEmpty(phone);
    await tab(phone, 'today');
    const sets = () => page.evaluate(() => DAYS[curDay].items[0].sets.map(s => ({ w: s.w, done: !!s._logged })));

    const start = await sets();
    t.ok(start.length >= 4, 'first exercise has at least 4 sets', start);
    await tapCheck(phone, 0); await tapCheck(phone, 1);          // perform sets 1 and 2

    // Open set 3's editor by tapping its value, bump the weight, slide "apply to all".
    const valTaps = await page.$$('.ex-card[data-ei="0"] .val-tap');
    await valTaps[4].click();                                     // weight of set 3 (2 taps per row)
    await wait(500);
    const sheetOpen = await page.evaluate(() => document.getElementById('overlay').classList.contains('open'));
    t.ok(sheetOpen, 'tapping a value opens the set editor');
    for (let i = 0; i < 10; i++) { await page.click('[onclick="stepW(1)"]'); await wait(40); }  // +5 kg
    await slide(phone, '#applyTrack', '#applyThumb');
    const after = await sets();

    t.ok(after[0].w === start[0].w && after[1].w === start[1].w,
      'performed sets 1 and 2 keep their real weight', { before: start.slice(0, 2), after: after.slice(0, 2) });
    t.ok(after.slice(2).every(s => s.w === start[2].w + 5),
      'unperformed sets 3+ take the new weight', after);
    t.ok(after.filter(s => s.done).length === 2, 'applying a weight does not tick anything', after);

    // Save the edited set: the value changes, the set is NOT marked done.
    await page.click('#saveSetBtn'); await wait(900);
    const saved = await sets();
    t.ok(saved[2].done === false, 'saving an edited value does not mark the set performed', saved[2]);

    // The change must survive a reload (v46 and earlier never persisted it).
    await page.reload({ waitUntil: 'load' }); await wait(1200);
    const reloaded = await sets();
    t.ok(reloaded[2].w === start[2].w + 5, 'applied weight persists across reload', reloaded[2]);
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
