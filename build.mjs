#!/usr/bin/env node
// Gains build: reassembles src/ into the single offline file the phone runs.
//
//   node build.mjs            -> writes index.html + sw.js at the repo root
//                                (GitHub Pages serves main:/ — that IS the deploy)
//   node build.mjs --check    -> builds to memory; fails if the committed
//                                index.html is not exactly what src/ produces
//
// The app must stay ONE self-contained HTML file (it runs offline from the
// home screen, with a strict CSP that forbids external scripts). So the
// sources are concatenated, in manifest order, into one <style> and one
// <script> — never split into separate tags. That matters: a function
// declared in one classic <script> is not hoisted into another, so splitting
// the script would change how the app boots.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const read = p => fs.readFileSync(p, 'utf8');

export function build() {
  const manifest = JSON.parse(read(path.join(SRC, 'manifest.json')));
  const shell = read(path.join(SRC, 'shell.html'));
  const css = manifest.css.map(f => read(path.join(SRC, 'css', f))).join('');
  const js = manifest.js.map(f => read(path.join(SRC, 'js', f))).join('');
  const { css: CT, js: JT } = manifest.tokens;
  // Splice by index, never String.replace: replace() would interpret any "$&"
  // or "$1" inside the app's own code as a substitution pattern.
  const splice = (hay, token, value) => {
    const i = hay.indexOf(token);
    if (i < 0 || hay.indexOf(token, i + 1) >= 0) throw new Error('token must occur exactly once: ' + token);
    return hay.slice(0, i) + value + hay.slice(i + token.length);
  };
  return splice(splice(shell, CT, css), JT, js);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const html = build();
  const md5 = crypto.createHash('md5').update(html, 'utf8').digest('hex');
  const OUT = path.join(ROOT, 'index.html');
  if (process.argv.includes('--check')) {
    const committed = fs.existsSync(OUT) ? read(OUT) : '';
    const same = committed === html && read(path.join(ROOT, 'sw.js')) === read(path.join(SRC, 'sw.js'));
    console.log(`built ${html.length} chars  md5 ${md5}  ${same ? 'matches committed index.html' : 'DIFFERS from committed index.html'}`);
    if (!same) { console.error('index.html/sw.js are stale or hand-edited. Edit src/, then run: node build.mjs'); process.exit(1); }
  } else {
    fs.writeFileSync(OUT, html);
    fs.copyFileSync(path.join(SRC, 'sw.js'), path.join(ROOT, 'sw.js'));
    console.log(`index.html  ${html.length} chars  md5 ${md5}`);
  }
}
