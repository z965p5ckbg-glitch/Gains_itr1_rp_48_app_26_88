// Apple's floor: every control is at least 44x44pt. Measured on the RENDERED
// page, not guessed from CSS — so overrides, flex sizing and inherited fonts
// all count. A control passes if its own box, or an ::after hit area, clears 44.
import { serve, newPhone, open, tab, wait } from '../lib/browser.mjs';

const MIN = 44;
async function undersized(page) {
  return page.evaluate(MIN => {
    const out = [];
    const sel = 'button, [onclick], input:not([type=hidden]), select, textarea, .ni, .set-check, .step-btn';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;                       // not displayed
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') continue;
      if (r.bottom < 0 || r.top > innerHeight * 3) continue;                // far off screen
      if (el.closest('#dbgPanel, #dbgFloat, [id^="dbg"]')) continue;       // hidden debug tools
      // a parent that is itself a large enough control counts (icon inside a row)
      const big = n => { const b = n.getBoundingClientRect(); return b.width >= MIN && b.height >= MIN; };
      if (big(el)) continue;
      const a = getComputedStyle(el, '::after');
      if (a.content && a.content !== 'none' && parseFloat(a.minWidth) >= MIN && parseFloat(a.minHeight) >= MIN) continue;
      const p = el.parentElement && el.parentElement.closest('[onclick], button');
      if (p && p !== el && big(p)) continue;
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '?'} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 18)}"`);
    }
    return [...new Set(out)];
  }, MIN);
}

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);
    for (const name of ['today', 'history', 'progress', 'prs']) {
      await tab(phone, name);
      const bad = await undersized(page);
      t.ok(bad.length === 0, `${name}: every control is at least 44x44`, bad.slice(0, 20));
    }
  } finally {
    await phone.close(); await site.close();
  }
}
