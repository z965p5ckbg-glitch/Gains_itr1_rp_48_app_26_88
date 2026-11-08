// A hostile backup can't run code (v61 security pass). Two kinds of payload:
//  • markup in text:      <img src=x onerror=…>      (must render as text)
//  • a script-string break-out in ids:  x'-__pwnf()-'
//    HTML escaping doesn't stop this one: the browser turns &#39; back into '
//    before an onclick runs, so an id inside onclick="open('…')" could close the
//    string. It survives encodeURIComponent too (' - ( ) are left alone).
// The data goes where a restored or imported file puts it: History records
// (ids, names, muscles, cardio tags), a custom exercise (id, title, muscles),
// the workout (title, label, cue, interval station names, numbers) and pins.
// Then every screen is drawn and the rows that carry those ids are tapped.
import { serve, newPhone, open, tab, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    await page.evaluate(() => {
      window.__pwn = 0; window.__pwnf = () => { window.__pwn++; return 0; };
      const H = '<img src=x onerror="window.__pwn++">';
      const Q = "x'-__pwnf()-'";
      const now = Date.now();
      const iso = d => new Date(now - d * 864e5).toISOString();
      // a custom exercise as a backup would restore it
      EXERCISES.push({ exId: Q, title: H, subtitle: H, kind: 'weighted', userAdded: true, muscles: [H, "Chest'-__pwnf()-'"], primary: [H], secondary: [], pattern: H, defaults: { cue: H, rest: 60, sets: [{ w: 10, r: 8 }] } });
      wsAdvancedTags = true;
      settings.progPins = [Q, 'id:' + Q];
      HISTORY.length = 0;
      for (let k = 0; k < 4; k++) {
        HISTORY.push({ id: Q + k, date: iso(30 - k * 7), localDate: null, dayLabel: H, dayExId: H, entries: [
          { exId: Q, name: H, kind: 'weighted', muscles: [H, "Back'-__pwnf()-'"], sets: [{ reps: 5, weightKg: 50 + k, completed: true }, { reps: 5, weightKg: 50 + k, completed: true }] },
          { exId: null, name: H + 'run', kind: 'cardio', muscles: [], cardio: { cardioKind: H, intensityTag: H, durationSec: 1200, distanceM: 3000 } }
        ] });
      }
      const d = DAYS[curDay];
      d.titleHtml = H + '<br><em>' + H + '</em>'; d.label = H;
      const w = d.items.find(x => (x._itemKind || wsTagItemKind(x)) === 'weighted'); w.name = H; w.cue = H;
      const iv = d.items.find(x => (x._itemKind || wsTagItemKind(x)) === 'cardio_intervals');
      if (iv) { (iv.roundsCustom || []).forEach(s => { s.name = H; }); iv.workSec = H; iv.restSec = H; iv.capMin = H; }
      const cd = DAYS.flatMap(x => x.items || []).find(x => (x._itemKind || wsTagItemKind(x)) === 'cardio_time');
      if (cd) cd.intensity = H;
      renderTabs(); renderHeader(); renderAll(false);
    });
    const pwn = () => page.evaluate(() => window.__pwn);
    const tapAll = sel => page.evaluate(s => { let n = 0; document.querySelectorAll(s).forEach(el => { try { el.click(); n++; } catch (_) {} }); return n; }, sel);

    // Today, every workout, the full-screen interval timer
    for (let i = 0; i < DAYS_N; i++) { await page.evaluate(i => switchDay(i), i); await wait(150); }
    await page.evaluate(() => switchDay(0)); await wait(200);
    const iv = await page.evaluate(() => DAYS[curDay].items.findIndex(x => (x._itemKind || wsTagItemKind(x)) === 'cardio_intervals'));
    if (iv >= 0) { await page.evaluate(i => { wsOpenTakeover(i); }, iv); await wait(400); await page.evaluate(() => wsCloseTakeover()); }
    t.ok(await pwn() === 0, 'Today, every workout and the interval timer draw hostile text as text', await pwn());

    // History: the list, a row (its id is the payload), the detail, Fix session
    await tab(phone, 'history'); await wait(400);
    await tapAll('[onclick^="hiToggleExpand"]'); await wait(200);
    const opened = await page.evaluate(() => { const r = document.querySelector('[onclick^="hiOpenDetail"]'); if (r) r.click(); return !!r; }); await wait(400);
    await page.evaluate(() => { const b = document.querySelector('[onclick^="wsFixSession"]'); if (b) b.click(); }); await wait(400);
    await page.evaluate(() => { const b = document.querySelector('[onclick^="wsPickSessionEffort"]'); if (b) b.click(); }); await wait(200);
    t.ok(opened && await pwn() === 0, 'History: rows, detail and Fix session with a hostile session id never run it', await pwn());

    // Progress: cards, pins, muscle bars (their names are the payload)
    await page.evaluate(() => { wsProgFrame = 'ALL'; });
    await tab(phone, 'progress'); await wait(500);
    await tapAll('.wspm-row'); await wait(200);
    await page.evaluate(() => { try { wsProgMuscleClear(); } catch (_) {} }); await wait(200);
    const cards = await page.evaluate(() => { const c = document.querySelector('.wsprog-card'); if (c) c.click(); return !!c; }); await wait(400);
    await tapAll('[onclick^="wsProgPinToggle"]'); await wait(200);
    t.ok(cards && await pwn() === 0, 'Progress: a hostile exercise id, name or muscle never runs', await pwn());

    // PRs, both orders, and tapping a record
    await tab(phone, 'prs'); await wait(400);
    await page.evaluate(() => { const r = document.querySelector('.wspr-row'); if (r) r.click(); }); await wait(300);
    await tab(phone, 'prs'); await page.evaluate(() => wsPRSetSort('exercise')); await wait(300);
    await page.evaluate(() => { const r = document.querySelector('.wspr-row'); if (r) r.click(); }); await wait(300);
    t.ok(await pwn() === 0, 'PRs: tapping a record with a hostile id never runs it', await pwn());

    // Plan: workouts, the library (row, star, editor with muscle tags), the picker
    await tab(phone, 'today'); await wait(200);
    await page.evaluate(() => openWorkshop()); await wait(400);
    await page.evaluate(() => wsSwitchTab('library')); await wait(400);
    await page.evaluate(() => { const r = [...document.querySelectorAll('.ws-lib-row')].find(x => x.dataset.exId && x.dataset.exId.indexOf("__pwnf") >= 0); if (r) { const s = r.querySelector('.ws-lib-star'); if (s) s.click(); r.click(); } }); await wait(500);
    await tapAll('.ws-le-tag.pm'); await wait(200);
    await page.evaluate(() => { try { wsSwitchTab('days'); openWsDayEdit(0); } catch (_) {} }); await wait(300);
    await page.evaluate(() => { try { closeWsDayEdit(); } catch (_) {} openWsPicker(0); }); await wait(400);
    await page.evaluate(() => { const r = [...document.querySelectorAll('.ws-pk-row')].find(x => x.dataset.exId && x.dataset.exId.indexOf("__pwnf") >= 0); if (r) r.click(); }); await wait(200);
    t.ok(await pwn() === 0, 'Plan, library, exercise editor and picker: hostile ids and names never run', await pwn());

    const hdr = await page.evaluate(() => document.getElementById('hdrTitle').innerHTML);
    t.ok(!/<img/i.test(hdr), 'the workout title shows markup as text', hdr.slice(0, 80));
    t.ok(phone.errors.length === 0, 'no errors', phone.errors.slice(0, 5));
  } finally { await phone.close(); await site.close(); }
}
const DAYS_N = 5;
