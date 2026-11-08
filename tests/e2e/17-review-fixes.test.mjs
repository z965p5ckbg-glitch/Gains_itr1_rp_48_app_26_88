// Fixes for what the independent review proved on v58 (8 Nov 2026). Each check
// failed on v58; the first four are the reviewer's own reproductions.
//  1. a warm-up stays a warm-up in History, and is not counted as work
//  2. in a superset, ticking A2 before A1 does not start the rest
//  3. one more set than last time reads "+1 SET", not "held"
//  4. shortening a rest below the time already rested ends it
//  5. logging is all-or-nothing: if the record can't be saved, the day stays open
//  6. the record keeps its own local day, time zone, start and end
//  7. removing a done set is saved and can be undone
//  8. text from your data (names, cues, labels) can never run as code
//  9. on a 320pt-wide phone the next-set controls don't overlap
import { serve, newPhone, open, tab, tapCheck, slideToLog, wait } from '../lib/browser.mjs';

const clickLabel = (page, label) => page.evaluate(l => { const b = document.querySelector(`[aria-label="${l}"]`); if (b) b.click(); return !!b; }, label);

export default async function (t) {
  const site = await serve(t.root);
  let phone = await newPhone();
  let page = phone.page;
  try {
    await open(phone, site.url);
    await tab(phone, 'today');

    // 1 — warm-up kept and excluded
    await page.evaluate(() => { const ex = DAYS[curDay].items[0]; ex.sets[0].warmup = true; renderAll(false); });
    await tapCheck(phone, 0); await tapCheck(phone, 1);
    const rec1 = await page.evaluate(() => captureSessionRecord(curDay));
    const sets1 = rec1.entries[0].sets;
    t.ok(sets1[0].warmup === true && !sets1[1].warmup, 'a warm-up is saved as a warm-up', sets1.slice(0, 2));
    t.ok(await page.evaluate(r => hiEntrySetCount(r.entries[0]), rec1) === 1, 'and it is not counted as a working set');
    t.ok(typeof sets1[1].doneAt === 'string', 'each set keeps the moment it was ticked', sets1[1].doneAt);

    // 6 — the record's own day, zone, start and end
    t.ok(/^\d{4}-\d\d-\d\d$/.test(rec1.localDate) && rec1.timeZone && rec1.startedAt && rec1.endedAt, 'the record stores its local day, time zone, start and end', { d: rec1.localDate, z: rec1.timeZone, s: rec1.startedAt, e: rec1.endedAt });
    const travelled = await page.evaluate(() => wsRecordDayKey({ date: '2026-10-19T21:30:00Z', localDate: '2026-10-20' }));
    t.ok(travelled === '2026-10-20', 'a stored day wins over the phone\'s current zone (travel can\'t move a session)', travelled);

    // 2 — superset A2 before A1
    await page.evaluate(() => { wsSetRestAuto(true); const it = DAYS[curDay].items; it[1].ss = true; renderAll(false); });
    const a1 = await page.evaluate(() => DAYS[curDay].items[0].sets.length);
    const a2 = await page.evaluate(() => DAYS[curDay].items[0].sets.length + DAYS[curDay].items[1].sets.length);
    await tapCheck(phone, a2);                                                   // A2 set 1 first
    let st = await page.evaluate(() => DAYS[curDay].items.slice(1, 3).map(x => x.rs));
    t.ok(st[0] !== 'running' && st[1] !== 'running', 'A2 before A1: no rest yet, the round isn\'t done', st);
    await tapCheck(phone, a1);                                                   // A1 set 1
    st = await page.evaluate(() => DAYS[curDay].items.slice(1, 3).map(x => x.rs));
    t.ok(st.includes('running'), 'once A1 is done too, the round is complete and rest starts', st);

    // 4 — shorten below elapsed
    const shortened = await page.evaluate(() => {
      const ex = DAYS[curDay].items.find(x => x.rs === 'running');
      ex.rest = 90; ex._restEnd = Date.now() + 30000; ex.rl = 30;                // 60 s already rested
      wsRestSetLength(ex, 30);
      return { rs: ex.rs, rl: ex.rl };
    });
    t.ok(shortened.rs === 'ready' && shortened.rl === 0, 'shortening a rest below the time already rested ends it (no 0:01)', shortened);

    // 3 — five sets vs four identical
    const tag = await page.evaluate(() => {
      const mk = (id, date, n) => ({ id, date, dayLabel: 'T', entries: [{ exId: 'x-bench', name: 'Bench', kind: 'weighted', muscles: [], sets: Array.from({ length: n }, () => ({ reps: 8, weightKg: 60, completed: true })) }] });
      const before = HISTORY.slice(); HISTORY.length = 0;
      HISTORY.push(mk('p', '2026-11-01T10:00:00Z', 4));
      const now = mk('n', '2026-11-05T10:00:00Z', 5);
      const S = wsFinishSummary(now, curDay);
      HISTORY.length = 0; before.forEach(r => HISTORY.push(r));
      return S.rows[0].tag;
    });
    t.ok(tag === '+1 SET', 'one more set than last time reads "+1 SET"', tag);

    // 5 — atomic logging: a failing capture leaves the day open
    // captureSessionRecord is a function declaration in the page scope; replace it there
    await page.evaluate(() => { window.__realCapture = captureSessionRecord; captureSessionRecord = function () { throw new Error('boom'); }; });
    const histN = await page.evaluate(() => HISTORY.length);
    await slideToLog(phone, { keepSummary: true });
    const afterFail = await page.evaluate(() => ({ logged: !!DAYS[curDay].logged, n: HISTORY.length, summary: !!document.getElementById('fkFinish'), toast: (document.getElementById('wsToast') || {}).textContent || '' }));
    t.ok(!afterFail.logged && afterFail.n === histN && !afterFail.summary, 'if the record can\'t be built, nothing claims the session was logged', afterFail);
    t.ok(/still here/.test(afterFail.toast), 'and you are told your sets are still there', afterFail.toast);
    await page.evaluate(() => { captureSessionRecord = window.__realCapture; });
    await slideToLog(phone, { keepSummary: true });
    const ok = await page.evaluate(() => ({ logged: !!DAYS[curDay].logged, summary: !!document.getElementById('fkFinish') }));
    t.ok(ok.logged && ok.summary, 'with capture working again, logging succeeds normally', ok);
    await page.evaluate(() => document.querySelector('.fkf-done').click()); await wait(300);
    t.ok(phone.errors.length === 0, 'no errors (part 1)', phone.errors);
  } finally { await phone.close(); }

  // 7 — removing a done set: saved, and undoable
  phone = await newPhone(); page = phone.page;
  try {
    await open(phone, site.url); await tab(phone, 'today');
    const n0 = await page.evaluate(() => DAYS[curDay].items[0].sets.length);
    for (let i = 0; i < n0; i++) await tapCheck(phone, i);
    await clickLabel(page, 'Remove the last set'); await wait(300);
    const stored = await page.evaluate(() => { wsPersistFlush(); const b = JSON.parse(localStorage.getItem(WS_PERSIST_KEY)); return b.days[curDay].items[0].sets.length; });
    t.ok(stored === n0 - 1, 'removing a set is saved straight away', [stored, n0]);
    const toastBox = await page.evaluate(() => { const r = document.getElementById('wsToast').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    t.ok(toastBox[0] > 0 && toastBox[1] > 0, 'messages are visible on the workout screen (they were hidden inside the plan editor)', toastBox);
    const undoBtn = await page.$('.ws-toast-undo');
    t.ok(!!undoBtn, 'removing a set that was done offers Undo');
    if (undoBtn) { await undoBtn.click(); await wait(300); }
    const back = await page.evaluate(() => ({ n: DAYS[curDay].items[0].sets.length, done: DAYS[curDay].items[0].sets[DAYS[curDay].items[0].sets.length - 1]._logged }));
    t.ok(back.n === n0 && back.done, 'Undo brings the done set back', back);

    // 8 — text from data never runs as code
    await page.evaluate(() => {
      const bad = '<img src=x onerror="window.__pwn=(window.__pwn||0)+1">';
      const d = DAYS[curDay]; d.label = bad; d.items[0].cue = bad; d.items[0].name = bad;
      HISTORY.push({ id: 'evil', date: new Date().toISOString(), dayLabel: bad, entries: [{ exId: 'x', name: bad, kind: 'weighted', muscles: [], sets: [{ reps: 5, weightKg: 50, completed: true }] }] });
      renderAll(false);
    });
    for (const v of ['today', 'history', 'progress', 'today']) { await tab(phone, v); await wait(300); }
    const pwn = await page.evaluate(() => window.__pwn || 0);
    t.ok(pwn === 0, 'names, cues and labels from your data are shown as text, never run as code', pwn);
    t.ok(phone.errors.length === 0, 'no errors (part 2)', phone.errors);
  } finally { await phone.close(); }

  // 9 — 320pt phone: no overlapping controls in the next-set row
  phone = await newPhone(); page = phone.page;
  try {
    await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await open(phone, site.url); await tab(phone, 'today');
    const overlaps = await page.evaluate(() => {
      const row = document.querySelector('.set-row.fk-active');
      const els = [...row.querySelectorAll('button')].map(b => b.getBoundingClientRect());
      let n = 0;
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 0.5 && y > 0.5) n++;
      }
      return { n, small: els.filter(r => r.width < 44 || r.height < 44).length, overflow: row.scrollWidth - row.clientWidth };
    });
    t.ok(overlaps.n === 0 && overlaps.small === 0 && overlaps.overflow <= 1, 'at 320pt the next-set controls don\'t overlap and stay 44pt', overlaps);
    t.ok(phone.errors.length === 0, 'no errors (part 3)', phone.errors);
  } finally { await phone.close(); await site.close(); }
}
