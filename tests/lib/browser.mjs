// Real-browser harness. Every test drives the actual built app in Chrome at
// iPhone size: real taps, real slides, real reloads, real localStorage, and a
// real service worker when served over http.
//
// Chrome lookup order: $CHROME_PATH -> @sparticuz/chromium (Linux sandboxes,
// where Chrome-for-Testing downloads may be blocked) -> a system Chrome.
// Limits worth remembering: this is Chromium, not WebKit. It proves logic,
// layout, persistence and upgrade paths. It cannot prove iOS-only behaviour
// (safe-area insets, home-screen standalone mode, how a drag *feels*).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

export const IPHONE = {
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

async function findChrome() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args: [] };
  if (process.platform === 'linux') {
    try {
      const c = (await import('@sparticuz/chromium')).default;
      // This build defaults to serverless flags. Drop the ones that would make
      // tests unfaithful: single-process breaks isolated contexts, and
      // disabled web security would let code pass that the phone's CSP and
      // same-origin rules would block.
      const DROP = ['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'];
      return { executablePath: await c.executablePath(), args: c.args.filter(a => !DROP.includes(a)) };
    } catch { /* fall through to system Chrome */ }
  }
  const candidates = {
    win32: [
      `${process.env['PROGRAMFILES'] || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[process.platform] || [];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) throw new Error('No Chrome found. Install Google Chrome, or set CHROME_PATH.');
  return { executablePath: found, args: [] };
}

let _browser = null;
export async function browser() {
  if (_browser) return _browser;
  const { executablePath, args } = await findChrome();
  _browser = await puppeteer.launch({ executablePath, args, headless: true });
  return _browser;
}
export async function closeBrowser() { if (_browser) await _browser.close(); _browser = null; }

// A static server for a directory. Files can be swapped between requests to
// rehearse "the site was updated" exactly as GitHub Pages does it.
export function serve(dir, port = 0) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const f = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      const type = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(fs.readFileSync(f));
    }).listen(port, '127.0.0.1', () => resolve({ url: `http://localhost:${srv.address().port}/`, close: () => new Promise(r => srv.close(r)) }));
  });
}

// One isolated browser context per test: no localStorage, service worker or
// cache leaks between tests.
export async function newPhone() {
  const b = await browser();
  const ctx = await b.createBrowserContext();
  const page = await ctx.newPage();
  await page.emulate(IPHONE);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());          // confirm() prompts: accept, as the user would
  const toasts = [];
  await page.exposeFunction('__gainsToast', m => toasts.push(String(m)));
  // Installed before ANY app script on EVERY load: the app reloads itself in
  // places (e.g. "start empty"), which would silently drop a late-bound hook.
  await page.evaluateOnNewDocument(WATCH_TOASTS);
  return { page, ctx, errors, toasts, close: () => ctx.close() };
}

// Record every toast the user would SEE by watching toast elements in the DOM,
// rather than wrapping toast functions (the app re-binds those after boot).
const WATCH_TOASTS = () => {
  const start = () => {
    let last = '';
    const report = () => {
      for (const el of document.querySelectorAll('[id*="oast"],[class*="toast"]')) {
        const txt = (el.textContent || '').trim();
        const shown = el.classList.contains('on') || el.classList.contains('show') || getComputedStyle(el).opacity !== '0';
        if (txt && shown && txt !== last) { last = txt; try { window.__gainsToast(txt); } catch (_) {} }
        if (!shown) last = '';
      }
    };
    new MutationObserver(report).observe(document.documentElement,
      { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
};

export const wait = ms => new Promise(r => setTimeout(r, ms));

// Boot the app (toasts are captured from the very first script).
export async function open(phone, url) {
  await phone.page.goto(url, { waitUntil: 'load' });
  await wait(1200);
}
export async function reload(phone) {
  await phone.page.reload({ waitUntil: 'load' });
  await wait(1200);
}

// ---- real user gestures ------------------------------------------------------
export async function tab(phone, name) {
  const i = { today: 1, history: 2, progress: 3, prs: 4 }[name];
  await phone.page.click(`#nav .ni:nth-child(${i})`);
  await wait(700);
}

// Tap the n-th set check on the Today screen. The screen re-renders after
// every tap, so the element is looked up fresh each time.
export async function tapCheck(phone, n) {
  const checks = await phone.page.$$('.set-check');
  if (!checks[n]) throw new Error(`no set-check #${n} (have ${checks.length})`);
  await checks[n].click();
  await wait(300);
}

// Drag a slide-to-confirm thumb across its whole track, like a thumb would.
export async function slide(phone, trackSel, thumbSel) {
  const { page } = phone;
  await page.evaluate(sel => { const t = document.querySelector(sel); if (t) t.scrollIntoView({ block: 'center' }); }, trackSel);
  await wait(350);
  const track = await (await page.$(trackSel)).boundingBox();
  const thumb = await (await page.$(thumbSel)).boundingBox();
  const y = thumb.y + thumb.height / 2;
  await page.mouse.move(thumb.x + thumb.width / 2, y);
  await page.mouse.down();
  for (let x = thumb.x + thumb.width / 2; x <= track.x + track.width + 24; x += 10) {
    await page.mouse.move(x, y); await wait(6);
  }
  await page.mouse.up();
  await wait(900);
}
export const slideToLog = phone => slide(phone, '#slideTrack', '#slideThumb');

// Start from an empty log using the app's own "start empty" path.
export async function startEmpty(phone) {
  await phone.page.evaluate(() => {
    if (typeof wsStartEmpty === 'function') wsStartEmpty();
    else { HISTORY.length = 0; if (typeof wsPersistFlush === 'function') wsPersistFlush(); }
  });
  await wait(400);
}

export const appState = phone => phone.page.evaluate(() => ({
  title: document.title,
  history: (typeof HISTORY !== 'undefined' ? HISTORY : []).map(r => ({
    id: r.id, date: r.date, label: r.dayLabel,
    entries: (r.entries || []).map(e => ({ name: e.name, kind: e.kind, sets: (e.sets || []).length })),
  })),
  loggedToday: (typeof DAYS !== 'undefined') ? DAYS[curDay].items.map(ex => (ex.sets || []).filter(s => s._logged).length) : [],
  dayLogged: (typeof DAYS !== 'undefined') ? !!DAYS[curDay].logged : null,
}));
