// v58 workout screen, second pass, driven with real taps:
//  - an unticked set is an empty ring (no tick inside)
//  - the set counter is prominent and orange; the time says what it is
//  - SETS − n + at the foot of every exercise
//  - tapping a value opens the set sheet with sliders; + and − move by the
//    exercise's own weight step, chosen per exercise and remembered
//  - supersets: pair with next; no rest between A1 and A2, rest after the round
//  - the auto-rest setting lives in Settings and in the rest sheet
import { serve, newPhone, open, tab, tapCheck, wait } from '../lib/browser.mjs';

const clickLabel = (page, label, nth = 0) => page.evaluate((l, n) => { const b = document.querySelectorAll(`[aria-label="${l}"]`)[n]; if (b) b.click(); return !!b; }, label, nth);
const setVal = (page, sel, v) => page.evaluate((sel, v) => { const r = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, String(v)); r.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    await tab(phone, 'today');

    // ── empty ring
    const ring = await page.evaluate(() => { const c = document.querySelector('.set-row.fk-active .set-check'); const svg = c.querySelector('svg'); const cs = getComputedStyle(svg); return { stroke: cs.stroke, border: getComputedStyle(c).borderTopColor }; });
    t.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(ring.stroke), 'an unticked set shows an empty ring, no tick inside', ring);

    // ── counter and time
    const head = await page.evaluate(() => ({ count: document.querySelector('.fk-prog-count').innerText.replace(/\s+/g, ' '), color: getComputedStyle(document.querySelector('.fk-prog-count b')).color, size: parseFloat(getComputedStyle(document.querySelector('.fk-prog-count b')).fontSize), time: (document.getElementById('fkElapsed') || {}).textContent || null }));
    t.ok(/^0 ?\/\d+ ?SETS$/.test(head.count) && head.size >= 32, 'the set counter is large', head);
    t.ok(head.color === 'rgb(240, 120, 48)', 'and orange', head.color);
    t.ok(head.time === null, 'there is no elapsed-time line (dropped in v59)', head.time);
    await tapCheck(phone, 0);

    // ── SETS − n +
    const n0 = await page.evaluate(() => DAYS[curDay].items[0].sets.length);
    await clickLabel(page, 'Add a set'); await wait(200);
    const n1 = await page.evaluate(() => ({ n: DAYS[curDay].items[0].sets.length, label: document.querySelector('.ex-card[data-ei="0"] .fk-setn').innerText.replace(/\s+/g, ' ') }));
    t.ok(n1.n === n0 + 1 && n1.label === (n0 + 1) + ' SETS', 'the sets stepper adds a set and shows the count', n1);
    await clickLabel(page, 'Remove the last set'); await wait(200);
    t.ok(await page.evaluate(() => DAYS[curDay].items[0].sets.length) === n0, 'and removes it again');

    // ── weight step: barbell default 2.5, the inline + uses it
    const step0 = await page.evaluate(() => wsWStep(DAYS[curDay].items[0]));
    const w0 = await page.evaluate(() => DAYS[curDay].items[0].sets[1].w);
    await clickLabel(page, 'More weight'); await wait(150);
    const w1 = await page.evaluate(() => DAYS[curDay].items[0].sets[1].w);
    t.ok(step0 === 0.5 && w1 === w0 + 0.5, 'a big lift steps by 0.5 kg by default (v59: by exercise, not equipment)', [step0, w0, w1]);
    const smallStep = await page.evaluate(() => wsWStepDefault({ name: 'Dumbbell lateral raise' }));
    t.ok(smallStep === 0.25, 'a smaller lift steps by 0.25 kg', smallStep);

    // ── tap the value: the sheet has sliders and the step chooser
    await page.evaluate(() => document.querySelector('.set-row.fk-active .val-tap').click()); await wait(400);
    const sheet = await page.evaluate(() => ({ open: document.getElementById('overlay').classList.contains('open'), w: document.getElementById('wRange'), r: !!document.getElementById('rRange'), chips: [...document.querySelectorAll('.fk-stepchip')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')) }));
    t.ok(sheet.open && sheet.r && sheet.chips.includes('0.5*'), 'tapping a value opens the sheet with weight and reps sliders and the step chooser', sheet);
    const rng = await page.evaluate(() => { const r = document.getElementById('wRange'); return { step: +r.step, min: +r.min, max: +r.max, value: +r.value }; });
    t.ok(rng.step === 0.5 && rng.min < rng.value && rng.max > rng.value, 'the weight slider moves in the exercise step around the current weight', rng);
    await setVal(page, '#wRange', rng.value + 5); await setVal(page, '#rRange', 6); await wait(100);
    const shown = await page.evaluate(() => [document.getElementById('wVal').textContent, document.getElementById('rVal').textContent]);
    t.ok(+shown[0] === rng.value + 5 && shown[1] === '6', 'the sliders update the numbers shown', shown);
    // choose a 0.25 kg step: + in the sheet now moves by a quarter, and it is remembered for this lift
    await page.evaluate(() => document.querySelector('.fk-steptoggle').click()); await wait(100);
    await page.evaluate(() => [...document.querySelectorAll('.fk-stepchip')].find(b => b.textContent === '0.25').click()); await wait(100);
    await page.click('[onclick="stepW(1)"]'); await wait(100);
    const afterFine = await page.evaluate(() => +document.getElementById('wVal').textContent);
    t.ok(afterFine === rng.value + 5.25, 'choosing 0.25 makes + move by a quarter kilo', afterFine);
    await page.click('#saveSetBtn'); await wait(900);
    const saved = await page.evaluate(() => { const s = DAYS[curDay].items[0].sets[1]; return { w: s.w, r: s.r, step: wsWStep(DAYS[curDay].items[0]) }; });
    t.ok(saved.w === rng.value + 5.25 && saved.r === 6 && saved.step === 0.25, 'saving keeps the values, and the step stays chosen for this lift', saved);

    // ── supersets: pair exercise 1 with 2
    await page.evaluate(() => wsSetRestAuto(true));
    const pairBtn = await page.evaluate(() => { const b = document.querySelector('.ex-card[data-ei="1"] .fk-pair'); if (b) b.click(); return !!b; });
    await wait(200);
    const lbl = await page.evaluate(() => ({ a1: document.querySelector('.ex-card[data-ei="1"] .fk-idx').textContent, a2: document.querySelector('.ex-card[data-ei="2"] .fk-idx').textContent, head: (document.querySelector('.fk-ss-head') || {}).innerText }));
    t.ok(pairBtn && lbl.a1 === 'A1' && lbl.a2 === 'A2' && /SUPERSET A/.test(lbl.head || '') && /REST AFTER A2/.test(lbl.head || ''), 'pairing labels the exercises A1 and A2 under one superset heading', lbl);
    const idxA1 = await page.evaluate(() => DAYS[curDay].items[0].sets.length);
    const idxA2 = await page.evaluate(() => DAYS[curDay].items[0].sets.length + DAYS[curDay].items[1].sets.length);
    await tapCheck(phone, idxA1);                                                 // A1 set 1
    let st = await page.evaluate(() => DAYS[curDay].items.slice(1, 3).map(x => x.rs + ':' + (x._restRow == null ? '-' : x._restRow)));
    t.ok(st[0].startsWith('idle:-') && st[1].startsWith('idle:-'), 'after A1 there is no rest: go straight to A2', st);
    await tapCheck(phone, idxA2);                                                 // A2 set 1
    st = await page.evaluate(() => DAYS[curDay].items.slice(1, 3).map(x => x.rs + ':' + (x._restRow == null ? '-' : x._restRow)));
    t.ok(st[1] === 'running:0', 'after A2 the round is done and rest starts', st);
    const nextTxt = await page.evaluate(() => (document.querySelector('#fkr2 .fkr-next') || {}).textContent || '');
    t.ok(/^Next: /.test(nextTxt), 'the timer names what comes next', nextTxt);
    const a1Name = await page.evaluate(() => wsExDisplayParts(DAYS[curDay].items[1]).title);
    t.ok(nextTxt.includes(a1Name), 'after the round, next is A1 again', [nextTxt, a1Name]);

    // ── the setting is in Settings too
    await page.evaluate(() => openSettings()); await wait(300);
    const tog = await page.evaluate(() => { const r = document.getElementById('togRestAuto'); return r ? r.classList.contains('on') : null; });
    t.ok(tog === true, 'Settings shows "Start rest automatically", in step with the sheet', tog);
    await page.evaluate(() => document.getElementById('togRestAuto').click()); await wait(100);
    t.ok(await page.evaluate(() => settings.restAuto === false), 'and switching it off there turns it off');
    await page.evaluate(() => closeSettings());

    // ── tap targets on the new controls
    const small = await page.evaluate(() => [...document.querySelectorAll('.fk-ss-btn,.fk-pair,.fkr button,.fk-stepchip')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length);
    t.ok(small === 0, 'every new control is at least 44 pt', small);

    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
