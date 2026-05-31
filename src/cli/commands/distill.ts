/**
 * agentsmesh distill — propose, apply, or check journal → topic routing.
 *
 * Default (no flag): propose. Writes
 * `.agentsmesh/lessons/distill-proposal.md` listing every unrouted bullet
 * with its best-match cluster decision.
 *
 * `--apply`: read decisions back from the proposal file, update the ledger,
 * clear the proposal.
 *
 * `--check`: assert every journal bullet is in the ledger (routed or `skip`).
 * Exits non-zero if any are missing — wire into pre-commit / CI.
 */

import { applyDistill, proposeDistill } from '../../lessons/distill.js';
import { checkJournalCoverage, type UnroutedBullet } from '../../lessons/check.js';
import { lessonsPaths } from '../../lessons/paths.js';
import type { DistillData } from '../command-result.js';

export interface DistillCommandResult {
  exitCode: number;
  data: DistillData;
}

export interface DistillOptions {
  readonly apply?: boolean;
  readonly check?: boolean;
}

export async function runDistill(
  projectRoot: string,
  options: DistillOptions = {},
): Promise<DistillCommandResult> {
  const paths = lessonsPaths(projectRoot);

  if (options.apply === true && options.check === true) {
    throw new Error('--apply and --check cannot be combined.');
  }

  if (options.check === true) {
    const result = checkJournalCoverage(paths);
    return {
      exitCode: result.ok ? 0 : 1,
      data: {
        mode: 'check',
        checked: result.checked,
        unrouted: result.unrouted.map((b: UnroutedBullet) => ({
          hash: b.hash,
          lineNumber: b.lineNumber,
          preview: b.preview,
        })),
      },
    };
  }

  if (options.apply === true) {
    const result = applyDistill(paths);
    return {
      exitCode: 0,
      data: {
        mode: 'apply',
        routed: result.routed,
        skipped: result.skipped,
      },
    };
  }

  const result = proposeDistill(paths);
  return {
    exitCode: 0,
    data: {
      mode: 'propose',
      proposalCount: result.proposals.length,
      proposalFile: result.proposalFileWritten,
    },
  };
}
