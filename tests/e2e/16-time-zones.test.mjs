// Days follow the phone. A session is stored as an instant; the day it belongs
// to is the phone's local calendar day, in whatever time zone the phone is in.
// These failed before v58: the consistency grid filed days by UTC date (a
// session at 00:30 local time landed on the day before) and the old-app import
// used a fixed time zone.
import { serve, newPhone, open } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await page.emulateTimezone('Europe/Athens');
    await open(phone, site.url);

    const grid = await page.evaluate(() => {
      const NOW = new Date('2026-11-07T10:00:00Z').getTime();
      const real = Date.now; Date.now = () => NOW;
      try {
        HISTORY.length = 0;
        // 00:30 local on Tue 20 Oct = 21:30 UTC on Mon 19 Oct
        HISTORY.push({ id: 'a', date: '2026-10-19T21:30:00.000Z', dayLabel: 'T', entries: [
          { exId: 'bench-press-barbell', name: 'Bench', kind: 'weighted', muscles: ['Chest'], sets: [{ reps: 5, weightKg: 60, completed: true }] }] });
        const g = wsProgDayGrid();
        const keys = g.map(x => x.d);
        const consecutive = keys.every((k, i) => i === 0 || (new Date(k + 'T12:00:00') - new Date(keys[i - 1] + 'T12:00:00')) === 864e5 || Math.abs((new Date(k + 'T12:00:00') - new Date(keys[i - 1] + 'T12:00:00')) - 864e5) <= 3600e3);
        return { on20: (g.find(x => x.d === '2026-10-20') || {}).sets, on19: (g.find(x => x.d === '2026-10-19') || {}).sets,
                 unique: new Set(keys).size === keys.length, n: keys.length, last: keys[keys.length - 1], consecutive,
                 has25: keys.includes('2026-10-25') };
      } finally { Date.now = real; }
    });
    t.ok(grid.on20 === 1 && !grid.on19, 'a session at 00:30 local counts on that local day, not the UTC day before', grid);
    t.ok(grid.n === 84 && grid.unique && grid.consecutive && grid.has25, 'the grid is 84 consecutive local days with no gap or repeat across the clock change on 25 Oct', grid);
    t.ok(grid.last === '2026-11-07', 'and it ends on the local today', grid.last);

    const keys = await page.evaluate(() => ({ local: wsLocalDayKey(new Date('2026-10-19T21:30:00Z')), legacy: wsLegacyDayKey('2026-10-19T21:30:00Z'), tz: wsDeviceTimeZone(),
      step: [0, 1, 2].map(i => wsLocalDayKey(wsAddDays(new Date('2026-10-24T00:00:00+03:00').getTime(), i))) }));
    t.ok(keys.local === '2026-10-20' && keys.legacy === '2026-10-20', 'day keys use the phone\'s local day', keys);
    t.ok(keys.step.join() === '2026-10-24,2026-10-25,2026-10-26', 'stepping by days crosses the 25-hour clock-change day correctly', keys.step);
    t.ok(keys.tz === 'Europe/Athens', 'the phone\'s own time zone is used', keys.tz);
    t.ok(phone.errors.length === 0, 'no errors (Athens)', phone.errors);
  } finally { await phone.close(); }

  // Same instant on a phone in New York: the import groups by New York days.
  const phone2 = await newPhone();
  try {
    await phone2.page.emulateTimezone('America/New_York');
    await open(phone2, site.url);
    const ny = await phone2.page.evaluate(() => ({ legacy: wsLegacyDayKey('2026-07-01T02:00:00Z'), local: wsLocalDayKey(new Date('2026-07-01T02:00:00Z')) }));
    t.ok(ny.legacy === '2026-06-30' && ny.local === '2026-06-30', 'the old-app import follows the phone\'s time zone, not a fixed one', ny);
    t.ok(phone2.errors.length === 0, 'no errors (New York)', phone2.errors);
  } finally { await phone2.close(); await site.close(); }
}
