// The app boots, and every tab renders, without a single uncaught error.
import { serve, newPhone, open, tab, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  try {
    await open(phone, site.url);
    t.ok(phone.errors.length === 0, 'boots with no uncaught errors', phone.errors);
    const title = await phone.page.title();
    t.ok(/^Gains — v\d+/.test(title), 'title carries a version', title);

    for (const name of ['today', 'history', 'progress', 'prs']) {
      await tab(phone, name);
      t.ok(phone.errors.length === 0, `${name} tab renders with no errors`, phone.errors);
      if (t.shots) await phone.page.screenshot({ path: t.shotPath(`boot-${name}.png`) });
    }

    // Settings opens and closes cleanly.
    await tab(phone, 'today');
    const opened = await phone.page.evaluate(() => { if (typeof openSettings !== 'function') return false; openSettings(); return true; });
    await wait(500);
    t.ok(opened && phone.errors.length === 0, 'settings opens with no errors', phone.errors);
    if (t.shots) await phone.page.screenshot({ path: t.shotPath('boot-settings.png') });
  } finally {
    await phone.close(); await site.close();
  }
}
