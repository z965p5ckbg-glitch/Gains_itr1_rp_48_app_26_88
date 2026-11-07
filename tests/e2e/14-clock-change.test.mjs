// Progress across a clock change. Weekly trend buckets were keyed by stepping
// back 7×24 hours from this week's Monday. Local Mondays either side of a
// summer-time change are 167 or 169 hours apart, so every week before the
// change got a key one hour off and its sessions silently vanished from
// Progress, for eight weeks after every change. Found on 7 Nov 2026, two weeks
// after Europe and Israel turned their clocks back on 25 Oct.
import { serve, newPhone, open, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await page.emulateTimezone('Europe/London');
    await open(phone, site.url);
    for (const [label, now] of [['autumn (clocks back 25 Oct)', '2026-11-07T12:00:00Z'], ['spring (clocks forward 29 Mar)', '2026-04-11T12:00:00Z']]) {
      const r = await page.evaluate(nowIso => {
        const NOW = new Date(nowIso).getTime();
        const realNow = Date.now; Date.now = () => NOW;
        try {
          const thisMon = wsTrendWeekStart(NOW);
          HISTORY.length = 0;
          // one session every Wednesday 18:00 local for the 8 complete weeks before this one
          for (let k = 8; k >= 1; k--) {
            const d = new Date(thisMon); d.setDate(d.getDate() - 7 * k + 2); d.setHours(18, 0, 0, 0);
            HISTORY.push({ id: 'c' + k, date: d.toISOString(), dayLabel: 'T', entries: [
              { exId: 'bench-press-barbell', name: 'Bench', kind: 'weighted', muscles: ['Chest'],
                sets: [1, 2, 3].map(() => ({ reps: 5, weightKg: 60, completed: true })) }] });
          }
          const rows = wsTrendBuckets('ALL', 8).filter(x => !x.partial);
          return { sets: rows.map(x => x.sets), read: (wsTrendReadout(rows) || {}).text || null };
        } finally { Date.now = realNow; }
      }, now);
      t.ok(r.sets.length === 8 && r.sets.every(n => n === 3), `${label}: every week keeps its sessions`, r.sets);
      t.ok(/steady/i.test(r.read || ''), `${label}: identical weeks read as steady`, r.read);
    }
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
