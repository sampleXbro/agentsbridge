/**
 * Result shapes for `agentsmesh refresh`. Mirrors the install/uninstall
 * { exitCode, data } envelope so `handleResult` can route it.
 */

import type { FailurePhase, RefreshData } from '../../cli/command-result.js';

export type { FailurePhase };

export interface RefreshCommandResult {
  readonly exitCode: 0 | 1 | 2;
  readonly data: RefreshData;
}
