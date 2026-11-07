// v57 workout screen, driven with real taps:
//  - each exercise marks its next set, and the mark moves as sets are ticked
//  - rest starts by itself, inline under the ticked set; pause, edit (one
//    slider), collapse, skip; it follows the wall clock, so a phone that slept
//    shows the right time; one rest at a time; editing a value keeps it running
//  - what you did carries to the next set unless you set that one yourself
//  - the timer docks above the tab bar when its exercise scrolls away
//  - sliding to log opens a summary built from the saved record; Done closes
//    it; Undo takes the record back out of History
import { serve, newPhone, open, tab, tapCheck, slideToLog, wait } from '../lib/browser.mjs';

const ex0 = page => page.evaluate(() => { const e = DAYS[curDay].items[0]; return { rs: e.rs, rl: e.rl, rest: e.rest, row: e._restRow, sets: e.sets.map(s => ({ w: s.w, r: s.r, done: !!s._logged })) }; });
const activeRow = (page, ei) => page.evaluate(ei => { const r = document.querySelector(`.ex-card[data-ei="${ei}"] .fk-active`); return r ? +r.dataset.si : -1; }, ei);
const restText = page => page.evaluate(() => { const t = document.querySelector('.fkr-t'); return t ? t.textContent : ''; });
const secs = txt => { const m = /(\d+):(\d\d)/.exec(txt); return m ? +m[1] * 60 + +m[2] : null; };
const clickLabel = (page, label) => page.evaluate(l => { const b = document.querySelector(`[aria-label="${l}"]`); if (b) b.click(); return !!b; }, label);

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    await tab(phone, 'today');

    // ── next-set marker
    t.ok(await activeRow(page, 0) === 0, 'the first set of each exercise is marked as next');
    t.ok(await activeRow(page, 1) === 0, 'every exercise has its own marker (second exercise too)');
    await tapCheck(phone, 0);
    t.ok(await activeRow(page, 0) === 1, 'ticking moves the marker to the next set');
    const segs = await page.evaluate(() => [...document.querySelectorAll('.ex-card[data-ei="0"] .fk-seg')].map(s => s.className.replace('fk-seg', '').trim() || '-').join(','));
    t.ok(segs === 'done,next,-,-', 'the set bar shows done / next / to do', segs);

    // ── rest starts by itself, under the ticked set
    let e = await ex0(page);
    t.ok(e.rs === 'running' && e.row === 0, 'rest starts by itself after a tick', e);
    const under = await page.evaluate(() => { const r = document.getElementById('fkr0'); const p = r && r.previousElementSibling; return p ? p.dataset.si : null; });
    t.ok(under === '0', 'the timer sits directly under the set just ticked', under);

    // ── pause holds the time, resume continues
    t.ok(await clickLabel(page, 'Pause rest'), 'there is a pause button');
    await wait(300);
    const p1 = await restText(page); await wait(2200); const p2 = await restText(page);
    t.ok(/PAUSED/.test(p1) && p1 === p2, 'paused, the time holds still', [p1, p2]);
    await clickLabel(page, 'Resume rest'); await wait(2200);
    const r1 = await restText(page);
    t.ok(/^REST/.test(r1) && secs(r1) < secs(p2), 'resumed, it counts down again', [p2, r1]);

    // ── edit with one slider
    await clickLabel(page, 'Change rest time'); await wait(300);
    t.ok(await page.$('#fkrSheet input[type=range]') !== null, 'edit opens a sheet with a single slider');
    await page.evaluate(() => { const r = document.querySelector('#fkrRange'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '150'); r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => document.querySelector('.fkr-sh-done').click()); await wait(300);
    e = await ex0(page);
    t.ok(e.rest === 150 && e.rl > 100, 'the slider sets the rest length and the running rest follows', e);

    // ── collapse and expand (a standing preference)
    await clickLabel(page, 'Make the timer smaller'); await wait(300);
    t.ok(await page.$('.fkr-mini') !== null, 'the timer collapses to a slim bar');
    await clickLabel(page, 'Show the full timer'); await wait(300);
    t.ok(await page.$('.fkr:not(.fkr-mini)') !== null, 'tapping the slim bar opens it again');

    // ── wall clock: a phone asleep for 60s comes back 60s later, not where JS froze
    const before = secs(await restText(page));
    await page.evaluate(() => { const x = DAYS[curDay].items[0]; x._restEnd -= 60000; });
    await wait(1300);
    const afterSleep = secs(await restText(page));
    t.ok(before - afterSleep >= 59 && before - afterSleep <= 63, 'after the phone sleeps, the timer shows the real time left', [before, afterSleep]);

    // ── editing a value mid-rest keeps the rest running (it used to reset it)
    const vt = await page.$$('.ex-card[data-ei="0"] .val-tap');
    await vt[2].click(); await wait(400);
    for (let i = 0; i < 4; i++) { await page.click('[onclick="stepW(1)"]'); await wait(30); }   // +2 kg on set 2
    await page.click('#saveSetBtn'); await wait(1000);
    e = await ex0(page);
    t.ok(e.rs === 'running', 'saving an edited value does not stop the rest', e.rs);

    // ── carry forward: set 2 was edited, ticking it carries to untouched sets 3 and 4
    const planned = e.sets[2].w;
    await page.evaluate(() => { const s = DAYS[curDay].items[0].sets[3]; s.w = s.w; });   // untouched
    await tapCheck(phone, 1);
    e = await ex0(page);
    t.ok(e.sets[2].w === e.sets[1].w && e.sets[3].w === e.sets[1].w && e.sets[1].w === planned + 2,
      'what you did on set 2 carries to the untouched sets after it', e.sets.map(s => s.w));
    t.ok(e.row === 1, 'the rest moved to the set just ticked', e.row);

    // a set you changed yourself is never overwritten
    await page.evaluate(() => { const ex = DAYS[curDay].items[1]; ex.sets[2].w = 33; ex.sets[2]._touched = true; ex.sets[2]._plan = { w: ex.sets[0].w, r: ex.sets[0].r }; renderAll(false); });
    await page.evaluate(() => stepSetVal(1, 0, 'w', 1));
    const cIdx = await page.evaluate(() => { let n = 0; for (let i = 0; i < 1; i++) n += DAYS[curDay].items[i].sets.length; return n; });
    await tapCheck(phone, cIdx);
    const ex1 = await page.evaluate(() => DAYS[curDay].items[1].sets.map(s => s.w));
    t.ok(ex1[2] === 33 && ex1[1] === ex1[0], 'a set you changed yourself keeps your number', ex1);

    // ── one rest at a time
    const both = await page.evaluate(() => DAYS[curDay].items.slice(0, 2).map(x => x.rs + ':' + x._restRow));
    t.ok(both[0].startsWith('idle') && both[1] === 'running:0', 'ticking another exercise moves the rest there', both);

    // ── un-ticking the set the rest belongs to cancels it
    await tapCheck(phone, cIdx);
    const after1 = await page.evaluate(() => DAYS[curDay].items[1].rs);
    t.ok(after1 === 'idle' && !(await page.$('#fkr1')), 'un-ticking that set cancels its rest', after1);

    // ── dock: scroll the resting exercise out of view
    await tapCheck(phone, cIdx);
    await page.evaluate(() => { const s = document.getElementById('scroll'); s.scrollTop = s.scrollHeight; s.dispatchEvent(new Event('scroll')); });
    await wait(400);
    const dockOn = await page.evaluate(() => { const d = document.getElementById('fkrDock'); return !!d && d.classList.contains('on') && /REST/.test(d.textContent); });
    t.ok(dockOn, 'the timer docks above the tab bar when its exercise scrolls away');
    const dockBox = await page.evaluate(() => { const d = document.getElementById('fkrDock').getBoundingClientRect(), n = document.getElementById('nav').getBoundingClientRect(); return { dockBottom: d.bottom, navTop: n.top, h: d.height }; });
    t.ok(dockBox.dockBottom <= dockBox.navTop && dockBox.h >= 44, 'it sits above the tab bar and is big enough to tap', dockBox);
    await page.click('#fkrDock'); await wait(900);
    const dockOff = await page.evaluate(() => !document.getElementById('fkrDock').classList.contains('on'));
    t.ok(dockOff, 'tapping it scrolls back to the timer');

    // ── log: the summary is built from what was saved
    await page.evaluate(() => { const ex = DAYS[curDay].items[0]; ex.sets[2].w = 120; ex.sets[2].r = 5; ex.sets[2]._touched = true; renderAll(false); });
    await tapCheck(phone, 2);                                                       // a heavy set → a record
    const ticked = await page.evaluate(() => DAYS[curDay].items.reduce((n, x) => n + (x.sets || []).filter(s => s._logged).length, 0));
    const histBefore = await page.evaluate(() => HISTORY.length);
    await slideToLog(phone, { keepSummary: true });
    t.ok(await page.$('#fkFinish') !== null, 'logging opens the summary');
    const f = await page.evaluate(() => document.getElementById('fkFinish').innerText);
    const shownSets = +((/(\d+)\s*\n\s*SETS?/.exec(f) || [])[1]);
    t.ok(shownSets === ticked, 'the summary counts exactly the sets you ticked', [shownSets, ticked]);
    t.ok(/120 × 5/.test(f), 'and shows the numbers you actually used', f.slice(0, 400));
    t.ok(/RECORD/.test(f), 'a new best is called a record', f.slice(0, 600));
    t.ok(/Not done, so not saved:[^\n]*Face Pull/i.test(f), 'untouched exercises are listed as not saved', (f.match(/Not done[^\n]*/) || [''])[0]);
    t.ok(await page.evaluate(() => HISTORY.length) === histBefore + 1, 'one record was saved');

    // effort chip writes the session rating to that record
    await page.evaluate(() => [...document.querySelectorAll('.fkf-chip')].find(b => b.textContent === '7').click()); await wait(200);
    t.ok(await page.evaluate(() => HISTORY[HISTORY.length - 1].sessionRpe === 7), 'the effort chip saves a session rating');

    // Undo takes it back out and unlocks the day
    await page.click('#fkUndo'); await wait(500);
    const undone = await page.evaluate(() => ({ n: HISTORY.length, logged: !!DAYS[curDay].logged, ticked: DAYS[curDay].items.reduce((n, x) => n + (x.sets || []).filter(s => s._logged).length, 0), sheet: !!document.getElementById('fkFinish') }));
    t.ok(undone.n === histBefore && !undone.logged && undone.ticked === ticked && !undone.sheet, 'Undo removes the record, unlocks the day and keeps every tick', undone);

    // log again and close with Done
    await slideToLog(phone, { keepSummary: true });
    await page.evaluate(() => document.querySelector('.fkf-done').click()); await wait(500);
    const closed = await page.evaluate(() => ({ sheet: !!document.getElementById('fkFinish'), logged: !!DAYS[curDay].logged, n: HISTORY.length }));
    t.ok(!closed.sheet && closed.logged && closed.n === histBefore + 1, 'Done closes the summary; the session stays logged', closed);

    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
    if (t.shots) await page.screenshot({ path: t.shotPath('13-workout.png') });
  } finally {
    await phone.close(); await site.close();
  }
}
