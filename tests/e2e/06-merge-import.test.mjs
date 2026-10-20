// Importing the old prototype's export must MERGE into what is already logged
// here, never replace it; be safe to run twice; and honour the two traps in the
// old format (exercise ids are slots, not identities; unticked sets were plans).
import fs from 'node:fs';
import path from 'node:path';
import { serve, newPhone, open, tab, tapCheck, slideToLog, startEmpty, wait, appState } from '../lib/browser.mjs';

export default async function (t) {
  const site = await serve(t.root);
  const phone = await newPhone();
  const { page } = phone;
  const exportText = fs.readFileSync(path.join(t.root, 'tests/fixtures/legacy-export-synthetic.json'), 'utf8');
  try {
    await open(phone, site.url);
    await startEmpty(phone);
    await tab(phone, 'today');
    await tapCheck(phone, 0);
    await slideToLog(phone);                       // one native session, today
    const nativeId = (await appState(phone)).history[0].id;

    const r1 = await page.evaluate(txt => wsApplyLegacyMerge(txt), exportText);
    const s = await appState(phone);
    t.ok(r1.ok, 'merge succeeds', r1);
    t.ok(s.history.some(h => h.id === nativeId), 'the native session survives the merge');
    // s2 and s3 share a calendar day and are merged into one record -> 2 days
    t.ok(s.history.length === 3, '3 records: 2 imported days + 1 native', s.history.map(h => h.date.slice(0, 10)));
    t.ok(s.history.every((h, i) => i === 0 || h.date >= s.history[i - 1].date), 'history stays sorted by date');
    t.ok(s.history[s.history.length - 1].id === nativeId, 'the newest record is still the native one');

    const names = s.history.flatMap(h => h.entries.map(e => e.name));
    t.ok(!names.includes('Hamstring Curl'), 'an exercise with only unticked sets is not imported', names);
    t.ok(names.includes('Hack Squat') && !names.some(n => /hamstring/i.test(n)),
      'slot id e2 does not fuse Hamstring Curl into Hack Squat', names);
    const day1 = s.history.find(h => h.date.startsWith('2026-04-01'));
    t.ok(day1 && day1.entries[0].sets === 2, 'only the two ticked RDL sets are imported', day1);
    const chins = s.history.flatMap(h => h.entries).find(e => /pull-up|chin/i.test(e.name));
    t.ok(chins && chins.kind === 'bodyweight', 'weighted chins import as bodyweight (+kg offset), not an 16 kg lift', chins);

    const r2 = await page.evaluate(txt => wsApplyLegacyMerge(txt), exportText);
    t.ok(r2.added === 0 && (await appState(phone)).history.length === 3, 'running the merge twice adds nothing', r2);

    await page.reload({ waitUntil: 'load' }); await wait(1200);
    t.ok((await appState(phone)).history.length === 3, 'merged history persists across reload');
    t.ok(phone.errors.length === 0, 'no errors', phone.errors);
  } finally {
    await phone.close(); await site.close();
  }
}
