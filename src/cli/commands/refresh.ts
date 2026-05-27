/**
 * agentsmesh refresh — re-fetch and re-apply installed packs against their
 * originally-recorded source/ref.
 */

import { runRefresh as runRefreshCore } from '../../install/refresh/run-refresh.js';
import type { RefreshCommandResult } from '../../install/refresh/refresh-result.js';

export type { RefreshCommandResult };

export async function runRefresh(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<RefreshCommandResult> {
  return runRefreshCore(flags, args, projectRoot);
}
