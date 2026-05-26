/**
 * Result shapes for `agentsmesh refresh`. Mirrors the install/uninstall
 * { exitCode, data } envelope so `handleResult` can route it.
 */

import type { RefreshData } from '../../cli/command-result.js';

export interface RefreshCommandResult {
  readonly exitCode: 0 | 1 | 2;
  readonly data: RefreshData;
}

export type FailurePhase = 'plan' | 'fetch' | 'apply' | 'manifest-update';
