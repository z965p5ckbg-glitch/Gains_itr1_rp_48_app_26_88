// One screen must never contradict itself or another screen.
//  - Progress must not say "no sessions" while History shows sessions.
//  - The period you pick in Progress is the frame for EVERY number below it.
//  - The version the app shows is the version it is.
import { serve, newPhone, open, tab, wait } from '../lib/browser.mjs';

const progressText = page => page.evaluate(() => document.getElementById('histView').innerText);

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  try {
    await open(phone, site.url);                   // fresh install: demo plan history present
    const n = await page.evaluate(() => HISTORY.length);
    await tab(phone, 'history');
    const histText = await page.evaluate(() => document.getElementById('histView').innerText);
    await tab(phone, 'progress');
    const prog = await progressText(page);
    if (t.shots) await page.screenshot({ path: t.shotPath('coherence-progress.png') });
    t.ok(!(n > 0 && /no sessions yet/i.test(prog)),
      'Progress does not claim "no sessions" while History has sessions',
      { historySessions: n, progressSays: prog.slice(0, 160) });

    // Every period chip: the period named at the top is the period the trends use.
    const frames = await page.evaluate(() => Object.keys(WS_PROG_FRAMES));
    const weeksOf = { '4W': 4, '8W': 8, '6M': 26, '1Y': 52 };
    for (const fr of frames) {
      await page.evaluate(f => wsProgSetFrame(f), fr); await wait(400);
      const txt = await progressText(page);
      const m = txt.match(/trends\s*·\s*last\s*(\d+)\s*weeks?/i);
      if (!m) continue;                            // trends not shown for this frame
      if (/^all$/i.test(fr)) {
        t.ok(true, 'All: trends shown');
      } else {
        t.ok(+m[1] === weeksOf[fr], `${fr}: trends cover the selected period`, { selected: fr, trendsSay: m[0] });
      }
    }

    // The version shown is the version running.
    const title = await page.title();
    const running = (title.match(/v(\d+)/) || [])[1];
    const shown = [...histText.matchAll(/\bv(\d+)(?:\.\d+)?\b/gi)].map(x => x[1]);
    t.ok(shown.every(v => v === running), 'History shows the version that is actually running', { title, shown });
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
