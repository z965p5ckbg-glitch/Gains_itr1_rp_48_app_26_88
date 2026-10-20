// Trends compare like with like.
//  - The unfinished current week never enters a comparison. Identical training
//    every week must read as steady on any day of the week — not as a slump on
//    a Tuesday because two days are being compared with seven.
//  - The figure beside each panel is last week's (complete), and says so.
//  - Units print once: "8.0 t", never "8.0t kg".
import { serve, newPhone, open, tab, wait } from '../lib/browser.mjs';

const panels = page => page.evaluate(() => [...document.querySelectorAll('.wstrend-p')].map(p => ({
  title: (p.querySelector('.wstrend-t') || {}).textContent,
  value: (p.querySelector('.wstrend-v') || {}).textContent,
  chip: (p.querySelector('.wstrend-d') || {}).textContent,
  chipClass: (p.querySelector('.wstrend-d') || {}).className,
  openDot: !!p.querySelector('circle[fill="var(--bg)"]'),
})));

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    // Eight identical complete weeks, then a light session so far this week.
    await page.evaluate(() => {
      const D = 864e5, W = 7 * D, wk = wsTrendWeekStart(Date.now());
      const sets = n => Array.from({ length: n }, () => ({ reps: 5, completed: true }));
      const sess = (at, n) => ({ id: 't' + at, date: new Date(at).toISOString(), dayLabel: 'Test', entries: [
        { exId: 'bench-press-barbell', name: 'Bench', kind: 'weighted', muscles: ['Chest'], sets: sets(n).map(s => ({ ...s, weightKg: 60 })) },
        { exId: 'back-squat-barbell', name: 'Squat', kind: 'weighted', muscles: ['Quads'], sets: sets(n).map(s => ({ ...s, weightKg: 100 })) }] });
      HISTORY.length = 0;
      for (let k = 8; k >= 1; k--) HISTORY.push(sess(wk - k * W + 2 * D + 10 * 3600e3, 10));
      HISTORY.push(sess(Math.max(wk, Date.now() - 60e3), 2));
    });
    await tab(phone, 'progress');

    for (const frame of ['8W', '4W']) {
      await page.evaluate(f => wsProgSetFrame(f), frame); await wait(400);
      const p = await panels(page);
      const sets = p.find(x => /sets/i.test(x.title)), vol = p.find(x => /volume/i.test(x.title));
      t.ok(sets && /^\s*20\b/.test(sets.value) && /last wk/i.test(sets.value),
        `${frame}: sets figure is last week's 20, labelled "last wk"`, sets);
      t.ok(sets && /flat/.test(sets.chipClass), `${frame}: identical weeks read as flat, not a drop`, sets);
      t.ok(vol && /flat/.test(vol.chipClass), `${frame}: volume reads flat too`, vol);
      t.ok(sets && sets.openDot, `${frame}: this week is drawn as an open dot`, sets);
      const read = await page.evaluate(() => (document.querySelector('.wstrend-read') || {}).textContent || '');
      t.ok(/steady/i.test(read), `${frame}: the read-out says steady`, read);
    }

    const vol = (await panels(page)).find(x => /volume/i.test(x.title));
    t.ok(vol && /^\s*8\.0 t\b/.test(vol.value), 'volume prints "8.0 t" (10×5×60 + 10×5×100 per week)', vol && vol.value);
    const txt = await page.evaluate(() => document.getElementById('histView').innerText);
    t.ok(!/\dt kg/.test(txt), 'no unit printed twice ("t kg")', (txt.match(/.{0,12}\dt kg.{0,12}/) || [])[0]);
    if (t.shots) await page.screenshot({ path: t.shotPath('trends-steady.png') });
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
