// Runs after `expo export -p web`. Expo puts package assets (our fonts, the icon font) under
// dist/assets/node_modules/, but Cloudflare Pages never uploads folders named node_modules, so
// those files 404'd in production and the app crashed on launch. Move them to dist/assets/pkg/
// and point the bundles at the new path.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const from = join(dist, 'assets', 'node_modules');
if (existsSync(from)) renameSync(from, join(dist, 'assets', 'pkg'));

let files = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|css|json)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      if (src.includes('/assets/node_modules/')) {
        writeFileSync(p, src.replaceAll('/assets/node_modules/', '/assets/pkg/'));
        files++;
      }
    }
  }
};
walk(dist);
console.log(`Moved package assets to dist/assets/pkg (${files} files updated)`);
