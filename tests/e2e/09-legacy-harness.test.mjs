// Runs the v29–v54 legacy harness against the CURRENT build. It is a
// regression net, not proof: any assertion that flips to false is a red flag
// worth reading. Seven assertions have been false since v44 by design (they
// probe features that were deliberately removed or never shipped); they are
// listed below and tolerated. Anything else false fails this test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const KNOWN_FALSE = new Set([
  'amHide.roundsCtl', 'advOff.perRow', 'advOff.sm', 'progRender.hasHero',
  'progRender.hasSpark', 'p2.cond', 'coach.profileHonest',
]);
// Assertions that pin a specific old version or behaviour v55+ deliberately
// changed. Each entry names the change that retired it.
const RETIRED = new Map([
  ['v40sec.headersFile', 'GitHub Pages ignores _headers (a Cloudflare/Netlify file). The CSP ships as a <meta> tag inside index.html instead.'],
]);

export default async function (t) {
  const html = fs.readFileSync(path.join(t.root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const biggest = scripts.sort((a, b) => b.length - a.length)[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gains-legacy-'));
  try {
    fs.writeFileSync(path.join(dir, 'extracted.js'), biggest);
    fs.writeFileSync(path.join(dir, 'gains_v54_work.html'), html);
    fs.copyFileSync(path.join(t.root, 'sw.js'), path.join(dir, 'sw.js'));
    fs.copyFileSync(path.join(t.root, 'tests/legacy/harness.cjs'), path.join(dir, 'harness.cjs'));
    let out;
    try {
      const version = String(JSON.parse(fs.readFileSync(path.join(t.root, 'package.json'), 'utf8')).version).split('.')[0];
      out = execFileSync(process.execPath, ['harness.cjs'], { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 240000,
        env: { ...process.env, GAINS_VERSION: version } });
    } catch (e) { t.ok(false, 'legacy harness runs to completion', (e.stdout || '') + (e.stderr || '')); return; }
    const json = JSON.parse(out.slice(out.indexOf('{')));
    let total = 0; const unexpected = []; const errs = [];
    for (const [battery, checks] of Object.entries(json)) {
      if (!checks || typeof checks !== 'object') continue;
      for (const [k, v] of Object.entries(checks)) {
        total++;
        const id = `${battery}.${k}`;
        if (k === 'err') errs.push(`${battery}: ${v}`);
        else if (v === false && !KNOWN_FALSE.has(id) && !RETIRED.has(id)) unexpected.push(id);
      }
    }
    t.ok(total > 400, `legacy harness ran (${total} assertions)`, total);
    t.ok(errs.length === 0, 'no legacy battery crashed', errs);
    t.ok(unexpected.length === 0, 'nothing beyond the 7 known probes is false', unexpected);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
