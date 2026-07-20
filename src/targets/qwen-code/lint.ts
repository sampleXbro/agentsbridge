/**
 * Qwen Code-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';
import { QWEN_CODE_TARGET } from './constants.js';

/**
 * Qwen Code's MarkdownCommandDefSchema has no tool-restriction field
 * (packages/cli/src/services/markdown-command-parser.ts) — canonical
 * `allowedTools` is dropped by the generator, so warn when it's non-empty.
 */
export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        QWEN_CODE_TARGET,
        'Qwen Code command files do not project canonical allowed-tools metadata.',
      ),
    );
}
