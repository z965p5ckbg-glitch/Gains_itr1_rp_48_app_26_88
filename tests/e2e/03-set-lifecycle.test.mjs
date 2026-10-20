// Check / uncheck / re-check behave exactly, and once a session is logged the
// screen can no longer drift away from the saved record.
import { serve, newPhone, open, tab, tapCheck, slideToLog, startEmpty, appState, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  try {
    await open(phone, site.url);
    await startEmpty(phone);
    await tab(phone, 'today');
    const count = async () => (await appState(phone)).loggedToday[0];

    await tapCheck(phone, 0); t.ok(await count() === 1, 'check ticks one set');
    await tapCheck(phone, 0); t.ok(await count() === 0, 'uncheck clears it');
    await tapCheck(phone, 0); t.ok(await count() === 1, 're-check ticks it once, not twice');

    await tapCheck(phone, 1); await tapCheck(phone, 2); await tapCheck(phone, 1);
    const pattern = await phone.page.evaluate(() => DAYS[curDay].items[0].sets.slice(0, 3).map(s => !!s._logged).join(','));
    t.ok(pattern === 'true,false,true', 'tick 1-2-3 then untick 2 leaves exactly 1 and 3', pattern);

    // Accidental double-tap on a fresh set leaves nothing ticked.
    await tapCheck(phone, 3); await tapCheck(phone, 3);
    t.ok(await count() === 2, 'double-tap leaves nothing extra ticked');

    // Log, then try to change it from the Today screen.
    await slideToLog(phone);
    const saved = (await appState(phone)).history[0];
    const savedSets = saved ? saved.entries.reduce((n, e) => n + e.sets, 0) : -1;
    t.ok(savedSets === 2, 'logged session holds the two ticked sets', saved);

    phone.toasts.length = 0;
    const before = await count();
    await tapCheck(phone, 2);
    t.ok(await count() === before, 'after logging, tapping a check does not change the screen');
    t.ok(phone.toasts.some(m => /logged/i.test(m)), 'and the app says why', phone.toasts);
    const after = (await appState(phone)).history[0];
    t.ok(after.entries.reduce((n, e) => n + e.sets, 0) === savedSets, 'the saved record is untouched');

    // Reset day: taps work again.
    await phone.page.evaluate(() => resetDay());
    await wait(400);
    await tapCheck(phone, 0);
    t.ok((await appState(phone)).loggedToday[0] === 1, 'after Reset day, checks work again');
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
