/**
 * Gemini CLI-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import {
  createWarning,
  createUnsupportedHookWarning,
  unsupportedHookEventNames,
} from '../../core/lint/shared/helpers.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        'gemini-cli',
        'Gemini TOML command files do not project canonical allowed-tools metadata.',
      ),
    );
}

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const supported = [
    'PreToolUse',
    'PostToolUse',
    'Notification',
    'SubagentStart',
    'SubagentStop',
    'SessionStart',
  ] as const;
  return unsupportedHookEventNames(canonical.hooks, supported).map((event) =>
    createUnsupportedHookWarning(event, 'gemini-cli', supported),
  );
}
