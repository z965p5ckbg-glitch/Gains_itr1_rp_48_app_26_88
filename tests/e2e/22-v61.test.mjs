// v61, driven through the screens:
//  1. Workouts and sessions: the plan screens never say "day" for a workout
//  2. backup reminder after logging: shown when due, "Later" puts it off,
//     switching it off in Settings stops it; Settings says how old the backup is
//  3. Check for updates: says "up to date", or that a newer version is ready
//  4. supersets in the workout editor: link a row to the one below, A1/A2 shown;
//     dragging or removing never pairs exercises that weren't paired
import { serve, newPhone, open, tab, tapCheck, slideToLog, wait } from '../lib/browser.mjs';

const visibleText = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); return el ? el.innerText.replace(/\s+/g, ' ') : ''; }, sel);

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    await tab(phone, 'today');

    // ── 1: wording (a fresh install's workouts are named "Workout 1…")
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.d-tab:not(.add)')].map(x => x.textContent));
    t.ok(tabs[0] === 'Workout 1', 'a new install names its workouts "Workout 1", "Workout 2"…', tabs);
    await page.evaluate(() => openWorkshop()); await wait(400);
    const ws = await visibleText(page, '#wsBody') + ' ' + await visibleText(page, '#wsTabDays');
    await page.evaluate(() => openWsDayEdit(0)); await wait(300);
    const ed = await visibleText(page, '#wsDayEditModal');
    const dayWord = s => (s.match(/\bdays?\b/gi) || []);
    t.ok(/workouts/i.test(ws) && /\d workouts?/i.test(ws) && dayWord(ws).length === 0, 'the plan screen says workouts, never days', { day: dayWord(ws), ws: ws.slice(0, 160) });
    t.ok(/Edit workout/i.test(ed) && dayWord(ed).length === 0, 'the workout editor says workout, never day', dayWord(ed));

    // ── 4: supersets in the editor
    const links = await page.evaluate(() => [...document.querySelectorAll('#wsDayEditModal .ws-de-link')].map(b => ({ pressed: b.getAttribute('aria-pressed'), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
    t.ok(links.length >= 3 && links.every(l => l.pressed === 'false' && l.w >= 44 && l.h >= 44), 'each weighted row with a weighted row below has a 44pt link button', links);
    await page.evaluate(() => document.querySelectorAll('#wsDayEditModal .ws-de-link')[1].click()); await wait(300);
    const after = await page.evaluate(() => ({ ss: DAYS[0].items.map(x => !!x.ss), tags: [...document.querySelectorAll('#wsDayEditModal .ws-de-ss')].map(x => x.textContent), pressed: document.querySelectorAll('#wsDayEditModal .ws-de-link')[1].getAttribute('aria-pressed') }));
    t.ok(after.ss[1] && !after.ss[0] && after.pressed === 'true' && /A1/.test(after.tags[0]) && /A2/.test(after.tags[1]), 'linking makes the row and the one below A1 and A2', after);
    const today = await page.evaluate(() => { closeWsDayEdit(); renderAll(false); return [...document.querySelectorAll('.fk-idx')].slice(0, 3).map(x => x.textContent); });
    t.ok(today[1] === 'A1' && today[2] === 'A2', 'and the workout screen shows the same superset', today);
    // removing the second member leaves no stray link to whatever follows
    const rem = await page.evaluate(() => {
      const d = DAYS[0]; const items = d.items; const before = items.map(x => x.name);
      items[0].ss = true; items[1].ss = true; delete items[2].ss;        // A = 0,1,2 (giant set)
      wsDayRemoveInstance(d, items[2]);                                  // remove the last member
      return { before: before.slice(0, 4), ss: d.items.slice(0, 3).map(x => !!x.ss) };
    });
    t.ok(rem.ss[0] && !rem.ss[1] && !rem.ss[2], 'removing the last member of a superset doesn\'t pair the others with the next exercise', rem);
    // dragging an exercise out of a group: the old member keeps no link to its new neighbour
    const drag = await page.evaluate(() => {
      const d = DAYS[0]; const it = d.items; it.forEach(x => delete x.ss);
      it[0].ss = true;                                                   // 0+1 paired
      const groups = wsSsGroupMap(it);
      const moved = [it[1], it[2], it[0]].concat(it.slice(3));           // A1 dragged below the next exercise
      wsSsKeepGroups(moved, groups);
      return moved.slice(0, 3).map(x => !!x.ss);
    });
    t.ok(drag.every(x => !x), 'moving an exercise away from its partner unpairs them, and pairs nobody new', drag);
    await page.evaluate(() => { DAYS[0].items.forEach(x => delete x.ss); wsPersistSave(); renderAll(false); try { closeWorkshop(); } catch (_) {} });

    // ── 2: backup reminder (the demo history counts: never backed up, 3+ sessions)
    await page.evaluate(() => { try { document.getElementById('workshopOverlay') && document.getElementById('workshopOverlay').classList.remove('open'); } catch (_) {} });
    await tab(phone, 'today');
    await tapCheck(phone, 0);
    await slideToLog(phone, { keepSummary: true }); await wait(600);
    const rem1 = await page.evaluate(() => { const b = document.getElementById('fkBackup'); return b ? b.innerText.replace(/\s+/g, ' ') : null; });
    t.ok(rem1 && /Never backed up/.test(rem1) && /Back up now/.test(rem1), 'after logging, the summary reminds you to back up when you never have', rem1);
    await page.evaluate(() => document.querySelector('.fkb-later').click()); await wait(200);
    const snoozed = await page.evaluate(() => ({ gone: !document.getElementById('fkBackup'), until: settings._backupSnoozeUntil - Date.now(), due: !!wsBackupDue() }));
    t.ok(snoozed.gone && snoozed.until > 2.9 * 864e5 && !snoozed.due, '"Later" puts it off for three days', snoozed);
    await page.evaluate(() => document.querySelector('.fkf-done').click()); await wait(300);
    const rule = await page.evaluate(() => {
      const keep = { a: settings._lastBackupAt, s: settings._backupSnoozeUntil };
      delete settings._backupSnoozeUntil;
      settings._lastBackupAt = Date.now() - 3 * 864e5; const recent = !!wsBackupDue();
      settings._lastBackupAt = Date.now() - 8 * 864e5; const old = wsBackupDue();
      settings._lastBackupAt = Date.now() + 1; const nothingNew = !!wsBackupDue();
      settings._lastBackupAt = Date.now() - 8 * 864e5;
      return { recent, old, nothingNew, keep };
    });
    t.ok(!rule.recent && rule.old && rule.old.age === 8 && rule.old.fresh >= 1 && !rule.nothingNew, 'due after a week with something new; not after 3 days; not when nothing is new', rule);
    await page.evaluate(() => openSettings()); await wait(300);
    const sub = await page.evaluate(() => { const s = document.getElementById('dataRowSub'); return { t: s.textContent, stale: s.classList.contains('stale') }; });
    t.ok(/Last backup 8 days ago/.test(sub.t) && sub.stale, 'Settings says how old the last backup is, highlighted when it is old', sub);
    await page.evaluate(() => document.getElementById('togBackupRemind').click()); await wait(100);
    t.ok(await page.evaluate(() => settings.backupRemind === false && !wsBackupDue()), 'switching the reminder off stops it');
    await page.evaluate(() => document.getElementById('togBackupRemind').click());

    // ── 3: check for updates (the server's copy is stubbed)
    const same = await page.evaluate(async () => {
      const real = window.fetch;
      window.fetch = async (u, o) => (String(u).includes('gains-check') ? new Response(`<script>const GAINS_VERSION='${GAINS_VERSION}';</script>`, { status: 200 }) : real(u, o));
      const r = await wsCheckUpdate(); const txt = document.getElementById('appVerSub').textContent;
      window.fetch = async (u, o) => (String(u).includes('gains-check') ? new Response(`<script>const GAINS_VERSION='${+GAINS_VERSION + 1}';</script>`, { status: 200 }) : real(u, o));
      const r2 = await wsCheckUpdate(); const txt2 = document.getElementById('appVerSub').textContent;
      window.fetch = async () => { throw new TypeError('offline'); };
      const r3 = await wsCheckUpdate(); const txt3 = document.getElementById('appVerSub').textContent;
      window.fetch = real;
      return { r, txt, r2, txt2, r3, txt3, btn: !!document.querySelector('.ws-upd-restart') };
    });
    t.ok(same.r === 'current' && /up to date/.test(same.txt), 'Check for updates: same version reads "up to date"', same.txt);
    t.ok(same.r2 === 'ready' && /is ready/.test(same.txt2), 'a newer version on the server reads "vN is ready"', same.txt2);
    t.ok(same.r3 === 'error' && /couldn.t check/.test(same.txt3), 'no connection reads "couldn\'t check", not an error screen', same.txt3);
    const btnSize = await page.evaluate(() => { const b = document.getElementById('appVerBtn').getBoundingClientRect(); return [b.width, b.height]; });
    t.ok(btnSize[0] >= 44 && btnSize[1] >= 44, 'the button is at least 44pt', btnSize);
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally { await phone.close(); await site.close(); }
}
