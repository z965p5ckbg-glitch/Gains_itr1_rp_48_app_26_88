// How Progress measures (review GAINS-014 and GAINS-015), with synthetic data:
//  1. sets per muscle divide by complete calendar weeks in the period: one
//     training week inside 8 is not 8 weeks of that volume
//  2. a new user is divided by the weeks since they started, not by 8
//  3. the unfinished current week is left out of both sets and weeks
//  4. the main muscle counts a whole set, helpers half; warm-ups never count
//  5. warm-ups never feed the estimated max
//  6. the screen says what the number is (estimate, over how many weeks)
import { serve, newPhone, open, tab, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);

    const r = await page.evaluate(() => {
      const wk0 = wsTrendWeekStart(Date.now());                    // this Monday
      const at = (weeksBack, day) => new Date(wsAddDays(wsAddDays(wk0, -7 * weeksBack), day) + 18 * 3600e3).toISOString();
      const bench = (date, work, warm) => ({ id: 'b' + date, date, dayLabel: 'T', entries: [{ exId: 'bench-press-barbell', name: 'Bench Press', kind: 'weighted', muscles: ['Chest', 'Front delts', 'Triceps'],
        sets: [].concat(Array.from({ length: warm || 0 }, () => ({ reps: 5, weightKg: 100, completed: true, warmup: true })), Array.from({ length: work }, () => ({ reps: 5, weightKg: 60, completed: true }))) }] });
      const keep = HISTORY.slice();
      const out = {};
      // long-time user: a session 20 weeks ago, then ONE training week inside the last 8 (week 3 back): 10 work sets + 2 warm-ups
      HISTORY.length = 0;
      HISTORY.push(bench(at(20, 1), 4), bench(at(3, 0), 5, 2), bench(at(3, 2), 5));
      HISTORY.push(bench(at(0, 0), 7));                             // this week: must not count
      let mw = wsProgMuscleWeekly('8W');
      out.long = { weeks: mw.weeks, chest: (mw.find(x => x.m === 'Chest') || {}).perWk, tri: (mw.find(x => x.m === 'Triceps') || {}).perWk, chestTotal: (mw.find(x => x.m === 'Chest') || {}).total };
      // new user: first ever session in the last complete week
      HISTORY.length = 0;
      HISTORY.push(bench(at(1, 1), 6), bench(at(0, 0), 4));
      mw = wsProgMuscleWeekly('8W');
      out.fresh = { weeks: mw.weeks, chest: (mw.find(x => x.m === 'Chest') || {}).perWk };
      // brand new: only this week
      HISTORY.length = 0;
      HISTORY.push(bench(at(0, 0), 4));
      mw = wsProgMuscleWeekly('8W');
      out.none = { weeks: mw.weeks, n: mw.length };
      // estimated max ignores warm-ups (warm-up 100×5 would estimate 117)
      HISTORY.length = 0;
      HISTORY.push(bench(new Date(Date.now() - 2 * 864e5).toISOString(), 3, 1));
      out.est = wsEst1RM('Bench Press');
      // leave a dataset on screen for the Progress check
      HISTORY.length = 0;
      HISTORY.push(bench(at(20, 1), 4), bench(at(3, 0), 5, 2), bench(at(3, 2), 5));
      out.keepN = keep.length;
      return out;
    });
    t.ok(r.long.weeks === 8, 'a long-time user is divided by the 8 complete weeks of the period', r.long);
    t.ok(r.long.chestTotal === 10 && r.long.chest === 1.3, 'one training week of 10 sets reads 1.3 a week over 8 weeks, not 10 (warm-ups and this week left out)', r.long);
    t.ok(r.long.tri === 0.6, 'a helper muscle (triceps on bench) gets half: 5 over 8 weeks', r.long.tri);
    t.ok(r.fresh.weeks === 1 && r.fresh.chest === 6, 'someone who started last week is divided by 1 week, not 8', r.fresh);
    t.ok(r.none.weeks === 0 && r.none.n === 0, 'with no complete week yet there is no weekly number at all', r.none);
    t.ok(r.est === 70, 'the estimated max comes from work sets only (60×5 → 70, not 117 from the 100 kg warm-up)', r.est);

    await page.evaluate(() => { wsProgFrame = '8W'; });
    await tab(phone, 'progress'); await wait(500);
    const ui = await page.evaluate(() => { const h = [...document.querySelectorAll('.wsprog-sect')].find(e => /Sets per muscle/.test(e.textContent)); const card = h && h.nextElementSibling; return h ? { head: h.textContent.replace(/\s+/g, ' '), note: card ? card.textContent.replace(/\s+/g, ' ') : '', vals: card ? [...card.querySelectorAll('.wspm-v')].map(v => v.textContent) : [] } : null; });
    t.ok(ui && /estimated, a week, over 8 complete weeks/.test(ui.head), 'Progress names the number: an estimate, a week, over 8 complete weeks', ui && ui.head);
    t.ok(ui && /helpers half/.test(ui.note) && /Warm-ups don't count/.test(ui.note), 'and says how sets are counted', ui && ui.note);
    t.ok(ui && ui.vals.includes('1.3'), 'the chest row shows 1.3', ui && ui.vals);
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally { await phone.close(); await site.close(); }
}
