/**
 * Standalone target ID constants.
 *
 * Re-exports from the auto-generated `builtin-target-ids-generated.ts`
 * (run by `prebuild` / `pnpm verify:catalog`).
 *
 * Kept as a separate module to break a circular type dependency:
 * `schema.ts → builtin-targets.ts → descriptors → ValidatedConfig → schema.ts`.
 * Only descriptor-free constants live here; the full descriptor array lives in
 * `builtin-targets.ts`.
 */

import {
  BUILTIN_TARGET_IDS,
  type BuiltinTargetId,
  isBuiltinTargetId,
} from './builtin-target-ids-generated.js';

export const TARGET_IDS = BUILTIN_TARGET_IDS;
export type { BuiltinTargetId };
export { isBuiltinTargetId };

/** Codex CLI id — shared skill dirs and AGENTS.md collision policy reference this explicitly. */
export const CODEX_CLI_TARGET_ID = 'codex-cli' satisfies BuiltinTargetId;
