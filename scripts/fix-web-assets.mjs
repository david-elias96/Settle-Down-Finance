// Runs after `expo export -p web`. Expo puts assets that come from packages (our Fraunces fonts)
// under dist/assets/node_modules/, but Cloudflare Pages never uploads folders named
// node_modules. The site then answered those font URLs with index.html, the font failed to load
// and the web app opened on its error screen. This moves them to dist/assets/pkg/ and rewrites
// every reference in the exported files.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const from = join(dist, 'assets', 'node_modules');
const to = join(dist, 'assets', 'pkg');

if (!existsSync(from)) {
  console.log('fix-web-assets: nothing to move');
  process.exit(0);
}
renameSync(from, to);

const TEXT = /\.(js|html|json|css|webmanifest|map)$/;
let files = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!TEXT.test(name)) continue;
    const s = readFileSync(p, 'utf8');
    if (!s.includes('assets/node_modules/')) continue;
    writeFileSync(p, s.split('assets/node_modules/').join('assets/pkg/'));
    files++;
  }
}
walk(dist);

// Nothing may still point at the old folder.
function check(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name === 'node_modules') throw new Error(`fix-web-assets: ${p} would not be uploaded`); check(p); }
  }
}
check(dist);
console.log(`fix-web-assets: moved package assets to assets/pkg and updated ${files} file(s)`);
