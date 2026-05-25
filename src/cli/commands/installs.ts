/**
 * `agentsmesh installs <subcommand>` — namespace dispatcher.
 *
 * Only `list` ships for now; the plural name is one character away from
 * `install`, so we surface a "did you mean install?" hint when the user
 * typos a subcommand. Future read-only subcommands (`show`, `verify`,
 * etc.) plug in here.
 */

import { runInstallsList } from './installs-list.js';
import type { InstallsListData } from '../command-result.js';

export interface InstallsCommandResult {
  exitCode: number;
  data: InstallsListData;
  showHelp?: boolean;
  error?: string;
}

const SUPPORTED_SUBCOMMANDS: readonly string[] = ['list'];

function emptyData(scope: 'project' | 'global'): InstallsListData {
  return { scope, subcommand: 'list', installs: [] };
}

export async function runInstalls(
  flags: Record<string, string | boolean>,
  args: readonly string[],
  projectRoot: string,
): Promise<InstallsCommandResult> {
  const scope: 'project' | 'global' = flags.global === true ? 'global' : 'project';
  const sub = args[0];

  if (sub === undefined || sub === '') {
    return { exitCode: 0, data: emptyData(scope), showHelp: true };
  }

  if (sub === 'list') {
    return runInstallsList(flags, projectRoot);
  }

  return {
    exitCode: 2,
    data: emptyData(scope),
    showHelp: true,
    error: `Unknown installs subcommand: "${sub}". Available: ${SUPPORTED_SUBCOMMANDS.join(', ')}. Did you mean \`agentsmesh install ${sub}\`?`,
  };
}
