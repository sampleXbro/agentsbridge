/**
 * Gemini CLI-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning, createUnsupportedHookWarning } from '../../core/lint/shared/helpers.js';

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
  const supported = ['PreToolUse', 'PostToolUse', 'Notification'] as const;
  const supportedSet = new Set(supported);
  return Object.keys(canonical.hooks)
    .filter((event) => !supportedSet.has(event as never))
    .map((event) => createUnsupportedHookWarning(event, 'gemini-cli', supported));
}
