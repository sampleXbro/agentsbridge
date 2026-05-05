/**
 * agentsmesh target — target management subcommands.
 * Currently: scaffold <id> [--name <displayName>] [--force]
 */

import type { TargetData } from '../command-result.js';
import { CliUsageError } from '../cli-error.js';
import { writeTargetScaffold } from './target-scaffold/writer.js';

export interface TargetCommandResult {
  exitCode: number;
  data: TargetData;
  showHelp?: boolean;
  error?: string;
}

/**
 * Run the target command.
 * @param flags - CLI flags
 * @param args  - Positional args (subcommand + subcommand args)
 * @param projectRoot - Project root (process.cwd())
 * @returns Structured result with exit code and data
 */
export async function runTarget(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<TargetCommandResult> {
  const subcommand = args[0];

  if (subcommand === undefined || subcommand === '') {
    return {
      exitCode: 0,
      data: { id: '', written: [], skipped: [], postSteps: [] },
      showHelp: true,
    };
  }

  if (subcommand === 'scaffold') {
    return runScaffold(flags, args.slice(1), projectRoot);
  }

  throw new CliUsageError(`Unknown target subcommand: ${subcommand}`);
}

async function runScaffold(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<TargetCommandResult> {
  const id = args[0];
  if (!id) {
    throw new CliUsageError(
      'Usage: agentsmesh target scaffold <id> [--name <displayName>] [--force]',
    );
  }

  const displayName = typeof flags.name === 'string' ? flags.name : undefined;
  const force = flags.force === true;

  let result;
  try {
    result = await writeTargetScaffold({ id, displayName, projectRoot, force });
  } catch (err) {
    return {
      exitCode: 1,
      data: { id, written: [], skipped: [], postSteps: [] },
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    exitCode: 0,
    data: {
      id,
      written: result.written.map((p) => relativize(p, projectRoot)),
      skipped: result.skipped.map((p) => relativize(p, projectRoot)),
      postSteps: result.postSteps,
    },
  };
}

function relativize(filePath: string, projectRoot: string): string {
  const rel = filePath.startsWith(projectRoot) ? filePath.slice(projectRoot.length + 1) : filePath;
  return rel.replaceAll('\\', '/');
}
