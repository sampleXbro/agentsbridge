/**
 * Result shapes for `agentsmesh refresh`. Mirrors the install/uninstall
 * { exitCode, data } envelope so `handleResult` can route it.
 */

import type { RefreshData } from '../../cli/command-result.js';

export interface RefreshCommandResult {
  readonly exitCode: 0 | 1 | 2;
  readonly data: RefreshData;
}

export interface RefreshedItem {
  readonly name: string;
  readonly oldRef: string | null;
  readonly newRef: string;
  readonly oldSha: string | null;
  readonly newSha: string;
  readonly changedFiles: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly modified: readonly string[];
  };
}

export interface UnchangedItem {
  readonly name: string;
  readonly ref: string;
}

export interface SkippedItem {
  readonly name: string;
  readonly reason: 'user-declined';
}

export type FailurePhase = 'plan' | 'fetch' | 'apply' | 'manifest-update';

export interface FailedItem {
  readonly name: string;
  readonly phase: FailurePhase;
  readonly error: string;
}
