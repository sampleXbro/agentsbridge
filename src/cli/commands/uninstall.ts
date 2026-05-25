/**
 * agentsmesh uninstall — remove an installed pack (or every pack).
 *
 * Thin CLI wrapper around `runUninstall` so dispatcher wiring lives in one
 * place; the actual work is in `src/install/uninstall/run-uninstall.ts`.
 */

import {
  runUninstall as runUninstallCore,
  type UninstallCommandResult,
} from '../../install/uninstall/run-uninstall.js';

export type { UninstallCommandResult };

export async function runUninstall(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<UninstallCommandResult> {
  return runUninstallCore(flags, args, projectRoot);
}
