// Test runner. Each tests/e2e/*.test.mjs exports `default async function(t)`
// where t.ok(cond, name, detail?) records a check. Exit code 1 if any fail.
//
//   node tests/run.mjs                run everything
//   node tests/run.mjs upgrade        only files whose name contains "upgrade"
//   node tests/run.mjs --shots        also save screenshots to tests/screenshots/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeBrowser } from './lib/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv.slice(2).filter(a => !a.startsWith('--'));
process.env.GAINS_SHOTS = process.argv.includes('--shots') ? '1' : '';

const files = fs.readdirSync(path.join(HERE, 'e2e'))
  .filter(f => f.endsWith('.test.mjs'))
  .filter(f => !filter.length || filter.some(x => f.includes(x)))
  .sort();

let pass = 0, fail = 0;
const failures = [];
for (const f of files) {
  const results = [];
  const t = {
    ok(cond, name, detail) { results.push({ ok: !!cond, name, detail }); },
    root: path.resolve(HERE, '..'),
    shots: !!process.env.GAINS_SHOTS,
    shotPath: n => { const d = path.join(HERE, 'screenshots'); fs.mkdirSync(d, { recursive: true }); return path.join(d, n); },
  };
  const t0 = Date.now();
  try {
    const mod = await import(pathToFileURL(path.join(HERE, 'e2e', f)).href);
    await mod.default(t);
  } catch (e) {
    results.push({ ok: false, name: 'test crashed', detail: e.stack || String(e) });
  }
  const bad = results.filter(r => !r.ok);
  pass += results.length - bad.length; fail += bad.length;
  console.log(`${bad.length ? 'FAIL' : 'pass'}  ${f.padEnd(34)} ${results.length - bad.length}/${results.length}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const r of bad) {
    failures.push(`${f} › ${r.name}`);
    console.log(`        ✗ ${r.name}${r.detail !== undefined ? '\n          ' + String(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)).slice(0, 600) : ''}`);
  }
}
await closeBrowser();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
