import type { ImportResult } from '../../core/types.js';
import { importWrappedCommandHooks } from '../import/wrapped-command-hooks.js';
import { CODEX_CANONICAL_HOOKS, CODEX_HOOKS_FILE, CODEX_TARGET } from './constants.js';

export async function importCodexHooks(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  await importWrappedCommandHooks({
    projectRoot,
    hooksFile: CODEX_HOOKS_FILE,
    canonicalHooksPath: CODEX_CANONICAL_HOOKS,
    targetName: CODEX_TARGET,
    results,
  });
}
