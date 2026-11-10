// Copies the shared budget logic into the edge functions so the app and backend use identical code.
// The app (Metro) imports without file extensions; Deno needs them, so the copy gets explicit `.ts`.
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dest = 'supabase/functions/_shared/domain';
rmSync(dest, { recursive: true, force: true });
cpSync('src/domain', dest, { recursive: true, filter: (p) => !p.endsWith('.test.ts') });
for (const name of readdirSync(dest)) {
  if (!name.endsWith('.ts')) continue;
  const file = join(dest, name);
  const src = readFileSync(file, 'utf8');
  writeFileSync(file, src.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(?<!\.ts)(['"])/g, '$1$2.ts$3'));
}
console.log('Synced src/domain →', dest);
