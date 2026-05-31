/**
 * Internal dev wrapper around the `agentsmesh distill` library functions.
 * Consumer projects use the CLI directly (`agentsmesh distill --check`); this
 * script exists so agentsmesh's own dev workflow can run the same logic via
 * `tsx` without needing a built `dist/`.
 */

import { relative } from 'node:path';
import { checkJournalCoverage } from '../src/lessons/check.js';
import { applyDistill, proposeDistill } from '../src/lessons/distill.js';
import { lessonsPaths } from '../src/lessons/paths.js';

const paths = lessonsPaths(process.cwd());

function propose(): void {
  const result = proposeDistill(paths);
  if (result.proposalFileWritten === null) {
    console.log('No new bullets to distill.');
    return;
  }
  const rel = relative(process.cwd(), result.proposalFileWritten).replaceAll('\\', '/');
  console.log(`Wrote ${result.proposals.length} proposals to ${rel}.`);
}

function apply(): void {
  try {
    const result = applyDistill(paths);
    console.log(
      `Applied. ${result.routed} bullet(s) routed, ${result.skipped} skipped. Ledger updated.`,
    );
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

function check(): void {
  const result = checkJournalCoverage(paths);
  if (result.ok) {
    console.log(`✓ all ${result.checked} journal bullets routed`);
    return;
  }
  const journalRel = relative(process.cwd(), paths.journal).replaceAll('\\', '/');
  console.error(`✗ ${result.unrouted.length} unrouted bullet(s) in ${journalRel}:`);
  for (const bullet of result.unrouted) {
    console.error(`  L${bullet.lineNumber}  ${bullet.preview}`);
  }
  console.error('');
  console.error('Run `agentsmesh distill` → review proposal → `agentsmesh distill --apply`.');
  process.exit(1);
}

const mode = process.argv[2] ?? '--propose';
if (mode === '--apply') apply();
else if (mode === '--check') check();
else propose();
