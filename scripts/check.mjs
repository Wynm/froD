// Syntax-checks every JS module (ESM) in the project. Zero deps.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'scripts', 'test', 'public'];
let files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(name)) files.push(p);
  }
}
for (const d of DIRS) walk(join(ROOT, d));
files.push(join(ROOT, 'server.mjs'));

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error('✗', f);
    console.error(err.stderr?.toString() || err.message);
  }
}
console.log(`Checked ${files.length} files — ${failed ? failed + ' FAILED' : 'all OK ✓'}`);
process.exit(failed ? 1 : 0);
