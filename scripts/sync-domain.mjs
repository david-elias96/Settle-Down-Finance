// Copies the shared budget logic into the edge functions so the app and backend use identical code.
import { cpSync, rmSync } from 'node:fs';
const dest = 'supabase/functions/_shared/domain';
rmSync(dest, { recursive: true, force: true });
cpSync('src/domain', dest, { recursive: true, filter: (p) => !p.endsWith('.test.ts') });
console.log('Synced src/domain →', dest);
