/**
 * agentsmesh install — add pinned extends entries from git or local paths.
 */

import { runInstall as runInstallCore } from '../../install/run-install.js';

export async function runInstall(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<void> {
  await runInstallCore(flags, args, projectRoot);
}
