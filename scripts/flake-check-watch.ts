/**
 * Run the watch unit suite N times under COVERAGE=1 to surface scheduler-load flakes.
 * The full test suite is too slow to repeat 10x for fast feedback; the watch suite
 * is where chokidar timing has historically misbehaved (lessons.md L74-L76, L153).
 *
 * Usage: pnpm flake:watch
 *        pnpm flake:watch 5    # override run count
 */

import { spawnSync } from 'node:child_process';

const DEFAULT_RUNS = 10;
const runs = Number.parseInt(process.argv[2] ?? '', 10) || DEFAULT_RUNS;
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

let failedAt: number | null = null;

for (let i = 1; i <= runs; i++) {
  console.error(`\n=== flake:watch ${i}/${runs} ===\n`);
  const r = spawnSync(PNPM, ['exec', 'vitest', 'run', 'tests/unit/cli/commands/watch.test.ts'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: false,
    env: { ...process.env, COVERAGE: '1' },
  });
  if (r.status !== 0) {
    failedAt = i;
    break;
  }
}

if (failedAt !== null) {
  console.error(`\nflake:watch failed on iteration ${failedAt}/${runs}`);
  process.exit(1);
}
console.error(`\nflake:watch passed ${runs}/${runs} iterations`);
process.exit(0);
