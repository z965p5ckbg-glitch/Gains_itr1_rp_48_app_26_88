// The core loop, through the real UI: tick sets, slide to log, see it in
// History, survive a reload. And Link's rule: only what was performed is
// recorded — exercises you never touched must not appear in the session.
import { serve, newPhone, open, reload, tab, tapCheck, slideToLog, startEmpty, appState, wait } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  try {
    await open(phone, site.url);
    await startEmpty(phone);
    let s = await appState(phone);
    t.ok(s.history.length === 0, 'start empty leaves no sessions', s.history.length);

    await tab(phone, 'today');
    await tapCheck(phone, 0);
    await tapCheck(phone, 1);
    s = await appState(phone);
    t.ok(s.loggedToday[0] === 2, 'two taps tick two sets on the first exercise', s.loggedToday);

    await slideToLog(phone);
    s = await appState(phone);
    t.ok(s.dayLogged === true, 'slide-to-log marks the day logged');
    t.ok(s.history.length === 1, 'one session recorded', s.history.length);
    const rec = s.history[0] || { entries: [] };
    const sets = rec.entries.reduce((n, e) => n + e.sets, 0);
    t.ok(sets === 2, 'session holds exactly the two performed sets', rec.entries);

    // Only what was performed. Untouched exercises must not be saved.
    const ghosts = rec.entries.filter(e => e.sets === 0);
    t.ok(ghosts.length === 0, 'no untouched exercises saved into the session', ghosts.map(g => g.name + ' (' + g.kind + ')'));

    await tab(phone, 'history');
    const histText = await phone.page.evaluate(() => document.getElementById('histView').innerText);
    t.ok(/1 SESSION\b/i.test(histText), 'History shows the session', histText.slice(0, 200));

    await reload(phone);
    s = await appState(phone);
    t.ok(s.history.length === 1 && s.history[0].entries.reduce((n, e) => n + e.sets, 0) === 2,
      'session survives a reload intact', s.history);
    t.ok(phone.errors.length === 0, 'no errors through the whole flow', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
