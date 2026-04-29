/**
 * agentsmesh target — target management subcommands.
 * Currently: scaffold <id> [--name <displayName>] [--force]
 */

import { logger } from '../../utils/output/logger.js';
import { writeTargetScaffold } from './target-scaffold/writer.js';

/**
 * Run the target command.
 * @param flags - CLI flags
 * @param args  - Positional args (subcommand + subcommand args)
 * @param projectRoot - Project root (process.cwd())
 * @returns Exit code: 0 success, 1 validation error, 2 bad usage
 */
export async function runTarget(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<number> {
  const subcommand = args[0];

  if (subcommand === undefined || subcommand === '') {
    printTargetHelp();
    return 0;
  }

  if (subcommand === 'scaffold') {
    return runScaffold(flags, args.slice(1), projectRoot);
  }

  logger.error(`Unknown target subcommand: ${subcommand}`);
  printTargetHelp();
  return 2;
}

async function runScaffold(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<number> {
  const id = args[0];
  if (!id) {
    logger.error('Usage: agentsmesh target scaffold <id> [--name <displayName>] [--force]');
    return 2;
  }

  const displayName = typeof flags.name === 'string' ? flags.name : undefined;
  const force = flags.force === true;

  let result;
  try {
    result = await writeTargetScaffold({ id, displayName, projectRoot, force });
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (result.written.length > 0) {
    for (const p of result.written) {
      const rel = p.startsWith(projectRoot) ? p.slice(projectRoot.length + 1) : p;
      logger.success(`created ${rel.replaceAll('\\', '/')}`);
    }
  }

  if (result.skipped.length > 0) {
    for (const p of result.skipped) {
      const rel = p.startsWith(projectRoot) ? p.slice(projectRoot.length + 1) : p;
      logger.warn(
        `skipped ${rel.replaceAll('\\', '/')} (already exists — use --force to overwrite)`,
      );
    }
  }

  if (result.written.length > 0) {
    logger.info('');
    logger.info('Next steps:');
    for (const step of result.postSteps) {
      logger.info(`  ${step}`);
    }
  }

  return 0;
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
