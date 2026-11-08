// Settings and backup, as found on the phone (v56):
//  - Settings closes by swiping the grabber down, not only with Done.
//  - Settings shows the real version, and no fake rows (an "Export" that only
//    said "coming soon", a "Help & tips" that did nothing).
//  - "Save backup file" works on an iPhone home-screen app: it hands a real
//    .json file to the share sheet (iPhone ignores <a download> there), and
//    records the backup date only once the file has gone somewhere.
import { serve, newPhone, open, wait } from '../lib/browser.mjs';

const settingsOpen = page => page.evaluate(() => document.getElementById('settingsOverlay').classList.contains('open'));

async function swipeDown(page, dy) {
  const b = await page.evaluate(() => { const r = document.querySelector('#settingsOverlay .sh-handle').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(b.x, b.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(b.x, b.y + dy * i / 10); await wait(12); }
  await page.mouse.up(); await wait(450);
}

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);

    await page.evaluate(() => openSettings()); await wait(400);
    t.ok(await settingsOpen(page), 'settings opens');
    const txt = await page.evaluate(() => document.getElementById('settingsOverlay').innerText);
    const ver = (await page.title()).match(/v\d+/)[0];
    t.ok(!/0\.19|prototype/i.test(txt), 'no stale "0.19 prototype" label');
    t.ok((txt.match(new RegExp('Gains ' + ver, 'g')) || []).length >= 2, 'both version rows show the running version', ver);
    t.ok(!/Export workout history|Help & tips/.test(txt), 'no fake rows that do nothing');

    await swipeDown(page, 40);
    t.ok(await settingsOpen(page), 'a short drag springs back');
    await swipeDown(page, 160);
    t.ok(!(await settingsOpen(page)), 'swiping the grabber down closes settings');

    // iPhone path: navigator.standalone exists, the share sheet takes files.
    await page.evaluate(() => {
      window.__shared = null;
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
      navigator.canShare = d => !!(d && d.files);
      navigator.share = d => { window.__shared = d; return Promise.resolve(); };
      settings._lastBackupAt = 0;
    });
    await page.evaluate(() => wsOpenData()); await wait(300);
    const before = await page.evaluate(() => document.getElementById('wsDataSheet').innerText);
    t.ok(!/Share backup/.test(before), 'one save button, not a separate Share row');
    await page.evaluate(() => [...document.querySelectorAll('.ws-data-btn')].find(b => /Save backup file/.test(b.textContent)).click());
    await wait(400);
    const shared = await page.evaluate(() => {
      const f = window.__shared && window.__shared.files && window.__shared.files[0];
      return f ? { name: f.name, type: f.type, size: f.size } : null;
    });
    t.ok(shared && /^gains-backup-\d{4}-\d\d-\d\d\.json$/.test(shared.name) && shared.size > 1000,
      'Save backup file hands a real .json file to the share sheet', shared);
    const backedUp = await page.evaluate(() => settings._lastBackupAt > 0);
    t.ok(backedUp, 'the backup date is recorded once it is saved');
    const after = await page.evaluate(() => document.getElementById('wsDataSheet').innerText);
    t.ok(/Backed up today/i.test(after), 'the sheet updates to "Backed up today" straight away', after.slice(0, 160));

    // Cancelling the share sheet is not a backup.
    await page.evaluate(() => {
      settings._lastBackupAt = 0;
      navigator.share = () => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
      wsBackupDownload();
    });
    await wait(300);
    t.ok(await page.evaluate(() => !settings._lastBackupAt), 'cancelling the share sheet does not count as a backup');
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
