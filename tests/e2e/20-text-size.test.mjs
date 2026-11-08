// Legibility: on every screen, no visible text is smaller than 13px (v61).
// Walks the screens the way a person does (ticking a set, opening the sheets,
// logging, History, Progress, PRs, Settings, the plan editor and the picker)
// and measures the rendered text, so overrides and inherited sizes count.
import { serve, newPhone, open, tab, tapCheck, slideToLog, wait } from '../lib/browser.mjs';

const MIN = 13;
const small = page => page.evaluate(MIN => {
  const out = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el) continue;
    if (el.closest('script,style,[id^="dbg"],[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let p = el, hidden = false;
    while (p) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) { hidden = true; break; } p = p.parentElement; }
    if (hidden) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < MIN) out.add(`${el.tagName.toLowerCase()}.${String(el.className || '').trim().split(/\s+/)[0] || '?'} ${fs}px "${n.nodeValue.trim().slice(0, 24)}"`);
  }
  return [...out];
}, MIN);

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  const check = async label => { const bad = await small(page); t.ok(bad.length === 0, `${label}: no text under ${MIN}px`, bad.slice(0, 12)); };
  try {
    await open(phone, site.url); await tab(phone, 'today'); await wait(300);
    await check('Today');
    await tapCheck(phone, 0); await wait(300);
    await check('Today, resting');
    await page.evaluate(() => wsRestSetMini(true)); await wait(200);
    await check('Today, small timer');
    await page.evaluate(() => wsRestSetMini(false));
    await page.evaluate(() => openEdit(0, 1)); await wait(400);
    await check('Set sheet');
    await page.evaluate(() => { try { closeEdit(); } catch (_) { document.getElementById('overlay').classList.remove('open'); } }); await wait(300);
    await page.evaluate(() => wsRestEdit(0)); await wait(300);
    await check('Rest sheet');
    await page.evaluate(() => wsRestEditClose(true));
    await page.evaluate(() => wsSsOpen(0)); await wait(300);
    await check('Superset sheet');
    await page.evaluate(() => wsSsClose());
    const hi = await page.evaluate(() => DAYS[curDay].items.findIndex(x => (x._itemKind || wsTagItemKind(x)) === 'cardio_intervals'));
    if (hi >= 0) {
      await page.evaluate(i => wsOpenTakeover(i), hi); await wait(500);
      await check('Interval timer, full screen');
      await page.evaluate(() => wsCloseTakeover()); await wait(300);
    }
    for (let d = 1; d < 5; d++) {
      await page.evaluate(d => switchDay(d), d); await wait(300);
      await check(`Workout ${d + 1} (cardio, intervals)`);
    }
    await page.evaluate(() => switchDay(0)); await wait(300);
    await slideToLog(phone, { keepSummary: true }); await wait(600);
    await check('Session summary');
    await page.evaluate(() => document.querySelector('.fkf-done').click()); await wait(400);
    await check('Today, logged');
    await tab(phone, 'history'); await wait(400);
    await check('History');
    await page.evaluate(() => { const r = document.querySelector('[onclick^="hiOpenDetail"]'); if (r) r.click(); }); await wait(500);
    await check('Session detail');
    await tab(phone, 'progress'); await wait(500);
    await check('Progress');
    await page.evaluate(() => { const c = document.querySelector('.wsprog-card'); if (c) c.click(); }); await wait(500);
    await check('Progress, one lift');
    await tab(phone, 'prs'); await wait(400);
    await check('PRs');
    await tab(phone, 'today'); await wait(300);
    await page.evaluate(() => openSettings()); await wait(400);
    await check('Settings');
    await page.evaluate(() => closeSettings()); await wait(300);
    await page.evaluate(() => openWorkshop()); await wait(500);
    await check('Plan (workouts)');
    await page.evaluate(() => openWsDayEdit(0)); await wait(400);
    await check('Workout editor');
    await page.evaluate(() => closeWsDayEdit()); await wait(300);
    await page.evaluate(() => openWsPicker(0)); await wait(500);
    await check('Add exercise');
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally { await phone.close(); await site.close(); }
}
