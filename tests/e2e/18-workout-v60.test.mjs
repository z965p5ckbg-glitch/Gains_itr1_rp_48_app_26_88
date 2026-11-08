// v60 workout screen, third pass, driven with real taps:
//  1. the round rest button says what it does (START / PAUSE / RESUME), and a
//     full-width progress bar fills as the rest runs
//  2. only the set that is up next has an orange ring
//  3. "Up next" names that set and takes you to it; Finish takes you to the
//     LOG SESSION slider; both stay reachable in a slim bar once you scroll
//  4. "Superset with…" pairs an exercise with any other one, above or below;
//     the chosen one moves next to it; it is saved; Undo restores the order;
//     an exercise can leave a superset; a third makes a giant set
//  5. the workout you're on is a neutral tab
//  6. a workout title from a backup can't run code (only <br> and <em> pass)
//  7. on a 320pt phone the timer's controls fit without overlapping
import { serve, newPhone, open, tab, tapCheck, wait } from '../lib/browser.mjs';

const clickLabel = (page, label) => page.evaluate(l => { const b = document.querySelector(`[aria-label="${l}"]`); if (b) b.click(); return !!b; }, label);
const inView = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(), sc = document.getElementById('scroll').getBoundingClientRect(); return r.top >= sc.top - 1 && r.bottom <= sc.bottom + 1; }, sel);
const emberRings = page => page.evaluate(() => [...document.querySelectorAll('.set-check')].filter(c => getComputedStyle(c).borderTopColor === 'rgb(240, 120, 48)').length);
const order = page => page.evaluate(() => DAYS[curDay].items.map(x => x.name));

export default async function (t) {
  const site = await serve(t.root);
  let phone = await newPhone();
  let page = phone.page;
  try {
    await open(phone, site.url);
    await tab(phone, 'today');

    // ── 5: neutral tab
    const tabBg = await page.evaluate(() => getComputedStyle(document.querySelector('.d-tab.active')).backgroundColor);
    t.ok(tabBg !== 'rgb(240, 120, 48)', 'the workout you are on is a neutral tab, not orange', tabBg);

    // ── 2: one orange ring
    t.ok(await emberRings(page) === 1, 'before starting, exactly one set ring is orange (the first set)', await emberRings(page));
    const up0 = await page.evaluate(() => document.querySelector('.fk-upnext').innerText.replace(/\s+/g, ' '));
    const first = await page.evaluate(() => wsExDisplayParts(DAYS[curDay].items[0]).title);
    t.ok(/^UP NEXT/.test(up0) && up0.includes(first), 'Up next names the first exercise', up0);

    // ── 1: the rest timer
    await tapCheck(phone, 0);
    const idle = await page.evaluate(() => { const b = document.querySelector('#fkr0 .fkr-roundbtn'); const l = b.querySelector('.fkr-rb-l'); return { label: l && l.textContent, size: l && parseFloat(getComputedStyle(l).fontSize), sub: document.getElementById('fkrs0').textContent, w: b.getBoundingClientRect().width }; });
    t.ok(idle.label === 'START' && idle.size >= 13 && idle.w >= 72, 'the waiting timer\'s round button reads START, at 13px or more', idle);
    t.ok(!/▶|Tap ▶/.test(idle.sub), 'the line beside the time no longer carries the start instruction', idle.sub);
    t.ok(await emberRings(page) === 1, 'after a tick there is still exactly one orange ring', await emberRings(page));
    await clickLabel(page, 'Start rest'); await wait(300);
    const run = await page.evaluate(() => { const card = document.getElementById('fkr0'); const tr = card.querySelector('.fkr-track'); const r = tr.getBoundingClientRect(); return { label: card.querySelector('.fkr-rb-l').textContent, h: r.height, wFrac: r.width / card.getBoundingClientRect().width, role: tr.getAttribute('role') }; });
    t.ok(run.label === 'PAUSE', 'running, it reads PAUSE', run.label);
    t.ok(run.h >= 6 && run.wFrac >= 0.85 && run.role === 'progressbar', 'a progress bar at least 6pt tall runs the width of the timer', run);
    await page.evaluate(() => { const ex = DAYS[curDay].items[0]; ex._restEnd = Date.now() + Math.round(ex.rest * 0.4) * 1000; });
    await wait(2400);                                                            // one tick plus the bar's 0.9 s glide
    const fill = await page.evaluate(() => { const tr = document.querySelector('#fkr0 .fkr-track'); const f = tr.querySelector('.fkr-fillbar'); return { frac: f.getBoundingClientRect().width / tr.getBoundingClientRect().width, now: +tr.getAttribute('aria-valuenow') }; });
    t.ok(fill.frac > 0.52 && fill.frac < 0.68 && fill.now >= 55 && fill.now <= 66, 'with 40% of the rest left, the bar is about 60% full (and says so to VoiceOver)', fill);
    await clickLabel(page, 'Pause rest'); await wait(200);
    t.ok(await page.evaluate(() => document.querySelector('#fkr0 .fkr-rb-l').textContent) === 'RESUME', 'paused, it reads RESUME');
    await clickLabel(page, 'Resume rest'); await wait(200);

    // ── 3: up next, top bar, finish
    const up1 = await page.evaluate(() => document.querySelector('.fk-upnext').innerText.replace(/\s+/g, ' '));
    t.ok(up1.includes(first), 'after set 1, Up next is the same exercise\'s next set', up1);
    const before = await page.evaluate(() => !!document.querySelector('#fkTop.on'));
    t.ok(!before, 'at the top of the list there is no slim bar (the counter is on screen)');
    await page.evaluate(() => { document.querySelector('.ex-card[data-ei="3"]').scrollIntoView({ block: 'start' }); }); await wait(400);
    const bar = await page.evaluate(() => { const b = document.getElementById('fkTop'); return b && b.classList.contains('on') ? { txt: b.innerText.replace(/\s+/g, ' '), finish: !!b.querySelector('.fk-finish') } : null; });
    t.ok(bar && /^1\/\d+/.test(bar.txt) && bar.txt.includes(first) && bar.finish, 'scrolled down, a slim bar keeps the count, Up next and Finish', bar);
    await page.evaluate(() => document.querySelector('#fkTop .fk-top-next').click()); await wait(900);
    t.ok(await inView(page, '.ex-card[data-ei="0"] .set-row[data-si="1"]'), 'tapping Up next brings that set into view');
    await page.evaluate(() => { document.getElementById('scroll').scrollTop = 0; }); await wait(200);
    await page.evaluate(() => document.querySelector('.fk-prog .fk-finish').click()); await wait(900);
    t.ok(await inView(page, '#slideTrack'), 'Finish takes you to the LOG SESSION slider (the slide still confirms)');
    t.ok(await page.evaluate(() => !DAYS[curDay].logged), 'and nothing is logged until you slide');

    // ── 4: superset with any exercise
    await page.evaluate(() => { document.getElementById('scroll').scrollTop = 0; DAYS[curDay].items.forEach((x, i) => { if (x._restRow != null) wsRestStop(i, true); }); renderAll(false); });
    const o0 = await order(page);
    await page.evaluate(() => document.querySelector('.ex-card[data-ei="0"] .fk-pair').click()); await wait(200);
    const sheet = await page.evaluate(() => { const s = document.getElementById('fkssSheet'); return s ? { rows: [...s.querySelectorAll('.fkss-row')].map(r => r.querySelector('.fkss-n').textContent), role: s.getAttribute('role'), explain: s.querySelector('.fkss-explain').textContent } : null; });
    t.ok(sheet && sheet.role === 'dialog' && sheet.rows.length >= 3 && /alternates/.test(sheet.explain), '"Superset with…" lists the other exercises and says what a superset is', sheet);
    const far = await page.evaluate(() => wsExDisplayParts(DAYS[curDay].items[3]).title);
    await page.evaluate(n => [...document.querySelectorAll('.fkss-row')].find(r => r.querySelector('.fkss-n').textContent === n).click(), far); await wait(400);
    const o1 = await order(page);
    t.ok(o1[0] === o0[0] && o1[1] === o0[3] && o1.length === o0.length, 'picking an exercise further down moves it to sit right after this one', o1);
    const lbl = await page.evaluate(() => ({ a1: document.querySelector('.ex-card[data-ei="0"] .fk-idx').textContent, a2: document.querySelector('.ex-card[data-ei="1"] .fk-idx').textContent, hint: (document.querySelector('.fk-ss-hint') || {}).textContent || '', btn: document.querySelector('.ex-card[data-ei="0"] .fk-pair').textContent }));
    t.ok(/A1$/.test(lbl.a1) && /A2$/.test(lbl.a2) && /A1 → A2, then rest/.test(lbl.hint) && /Superset A/i.test(lbl.btn), 'they become A1 and A2, with a one-line "A1 → A2, then rest"', lbl);
    const saved = await page.evaluate(() => { wsPersistFlush(); const b = JSON.parse(localStorage.getItem(WS_PERSIST_KEY)); return b.days[curDay].items.map(x => x.name + (x.ss ? '+' : '')); });
    t.ok(saved[0] === o0[0] + '+' && saved[1] === o0[3], 'the new order and pairing are saved with the workout', saved.slice(0, 3));
    const undo = await page.$('.ws-toast-undo');
    t.ok(!!undo, 'pairing offers Undo');
    if (undo) { await undo.click(); await wait(300); }
    const o2 = await order(page);
    t.ok(JSON.stringify(o2) === JSON.stringify(o0) && await page.evaluate(() => !DAYS[curDay].items.some(x => x.ss)), 'Undo puts the order back and unpairs', o2);

    // pick one ABOVE: exercise 3 pairs with exercise 1 → 1 moves down to follow 3
    await page.evaluate(() => wsSsOpen(3)); await wait(200);
    const above = await page.evaluate(() => wsExDisplayParts(DAYS[curDay].items[1]).title);
    await page.evaluate(n => [...document.querySelectorAll('.fkss-row')].find(r => r.querySelector('.fkss-n').textContent === n).click(), above); await wait(300);
    const o3 = await order(page);
    t.ok(o3[2] === o0[3] && o3[3] === o0[1] && o3[0] === o0[0], 'picking an exercise further up moves it down to follow this one', o3);
    // a third joins: giant set
    await page.evaluate(() => wsSsOpen(2)); await wait(200);
    const third = await page.evaluate(() => wsExDisplayParts(DAYS[curDay].items[0]).title);
    await page.evaluate(n => [...document.querySelectorAll('.fkss-row')].find(r => r.querySelector('.fkss-n').textContent === n).click(), third); await wait(300);
    const giant = await page.evaluate(() => ({ head: document.querySelector('.fk-ss-head').innerText, n: DAYS[curDay].items.filter(x => x.ss).length }));
    t.ok(/GIANT SET A/.test(giant.head) && giant.n === 2, 'adding a third makes a giant set of three', giant);
    // leave: the middle member moves out to after the group
    const mid = await page.evaluate(() => DAYS[curDay].items[2].name);
    await page.evaluate(() => wsSsOpen(2)); await wait(200);
    t.ok(await page.evaluate(() => !!document.querySelector('.fkss-leave')), 'inside a superset the sheet offers to take the exercise out');
    await page.evaluate(() => document.querySelector('.fkss-leave').click()); await wait(300);
    const o4 = await page.evaluate(() => DAYS[curDay].items.map(x => x.name + (x.ss ? '+' : '')));
    t.ok(o4[3] === mid && o4.filter(x => x.endsWith('+')).length === 1, 'taking it out leaves the other two paired and puts it right after them', o4);

    // ── tap targets
    await page.evaluate(() => wsSsOpen(0)); await wait(200);
    const small = await page.evaluate(() => [...document.querySelectorAll('.fk-finish,.fk-upnext,.fk-top button,.fkss-row,.fkss-leave,.fkss-cancel,.fk-pair,.fkr-roundbtn')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length);
    t.ok(small === 0, 'every new control is at least 44 pt', small);
    await page.evaluate(() => wsSsClose());

    // ── 6: workout title from a backup
    await page.evaluate(() => { DAYS[curDay].titleHtml = 'Push &amp; <img src=x onerror="window.__pwn2=1"><br><em>Pull<script>window.__pwn2=1<\/script></em>'; renderHeader(); });
    await wait(300);
    const hdr = await page.evaluate(() => ({ pwn: window.__pwn2 || 0, html: document.getElementById('hdrTitle').innerHTML, text: document.getElementById('hdrTitle').innerText.replace(/\s+/g, ' ') }));
    t.ok(hdr.pwn === 0 && !/<img|<script/i.test(hdr.html), 'a workout title from a backup is shown as text; markup in it never runs', hdr);
    t.ok(/<br><em>/.test(hdr.html) && /^Push & Pull/.test(hdr.text), 'the two-line title (with &) still shows as intended', hdr.text);
    t.ok(phone.errors.length === 0, 'no errors (part 1)', phone.errors);
  } finally { await phone.close(); }

  // ── 7: 320pt phone, the full timer fits
  phone = await newPhone(); page = phone.page;
  try {
    await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await open(phone, site.url); await tab(phone, 'today');
    await tapCheck(phone, 0);
    const fit = await page.evaluate(() => {
      const card = document.getElementById('fkr0');
      const btns = [...card.querySelectorAll('button')].map(b => b.getBoundingClientRect());
      let n = 0;
      for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
        const a = btns[i], b = btns[j];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) n++;
      }
      const top = card.querySelector('.fkr-top');
      const cr = card.getBoundingClientRect();
      return { overlaps: n, overflow: top.scrollWidth - top.clientWidth, outside: btns.filter(r => r.right > cr.right + 0.5 || r.left < cr.left - 0.5).length };
    });
    t.ok(fit.overlaps === 0 && fit.overflow <= 1 && fit.outside === 0, 'at 320pt the timer\'s buttons fit without overlapping', fit);
    t.ok(phone.errors.length === 0, 'no errors (part 2)', phone.errors);
  } finally { await phone.close(); await site.close(); }
}
