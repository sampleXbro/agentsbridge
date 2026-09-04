/**
 * Fails when any source file is under the per-file coverage floor.
 * Usage: `tsx scripts/coverage-floor.ts [coverage/coverage-summary.json]`
 * Runs after `vitest run --coverage` (see the test:coverage script).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_FLOOR,
  filesBelowFloor,
  formatOffenders,
  type CoverageSummary,
} from './coverage-floor-core.js';

const summaryPath = resolve(process.argv[2] ?? 'coverage/coverage-summary.json');
const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as CoverageSummary;
const offenders = filesBelowFloor(summary, DEFAULT_FLOOR);
const floorText = `lines ${DEFAULT_FLOOR.lines}%, functions ${DEFAULT_FLOOR.functions}%, branches ${DEFAULT_FLOOR.branches}%`;

if (offenders.length === 0) {
  process.stdout.write(`coverage-floor OK: every file meets the per-file floor (${floorText}).\n`);
} else {
  console.error(
    `coverage-floor: ${offenders.length} file(s) below the per-file floor (${floorText}):`,
  );
  for (const line of formatOffenders(offenders, process.cwd())) console.error(`  ${line}`);
  process.exit(1);
}
