/**
 * Human-readable renderer for target command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { TargetCommandResult } from '../commands/target.js';

export function renderTarget(result: TargetCommandResult): void {
  if (result.showHelp) {
    printTargetHelp();
    return;
  }

  if (result.error) {
    logger.error(result.error);
    return;
  }

  const { data } = result;

  for (const p of data.written) {
    logger.success(`created ${p}`);
  }

  for (const p of data.skipped) {
    logger.warn(`skipped ${p} (already exists — use --force to overwrite)`);
  }

  if (data.written.length > 0) {
    logger.info('');
    logger.info('Next steps:');
    for (const step of data.postSteps) {
      logger.info(`  ${step}`);
    }
  }
}

function printTargetHelp(): void {
  logger.info('Usage: agentsmesh target <subcommand> [args] [flags]');
  logger.info('');
  logger.info('Subcommands:');
  logger.info('  scaffold <id>  Generate a new target skeleton (files, tests, fixture)');
  logger.info('');
  logger.info('Flags (scaffold):');
  logger.info('  --name <displayName>  Human-readable name (defaults to id)');
  logger.info('  --force               Overwrite existing files');
}
