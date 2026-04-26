/**
 * Run unit + contract suites repeatedly to surface flakes (Testing Strategy §10).
 * Usage: pnpm flake:check
 */

import { spawnSync } from 'node:child_process';

const RUNS = 20;
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
let failed = false;

for (let i = 0; i < RUNS; i++) {
  const r = spawnSync(PNPM, ['exec', 'vitest', 'run', 'tests/unit', 'tests/contract'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: false,
  });
  if (r.status !== 0) {
    failed = true;
    console.error(`flake:check failed on iteration ${i + 1}/${RUNS}`);
    break;
  }
}

process.exit(failed ? 1 : 0);
