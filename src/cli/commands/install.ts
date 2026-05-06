/**
 * agentsmesh install — add pinned extends entries from git or local paths.
 */

import {
  runInstall as runInstallCore,
  type InstallCommandResult,
} from '../../install/run/run-install.js';

export type { InstallCommandResult };

export async function runInstall(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<InstallCommandResult> {
  return runInstallCore(flags, args, projectRoot);
}
