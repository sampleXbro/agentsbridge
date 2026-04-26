/**
 * Copilot-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning, createUnsupportedHookWarning } from '../../core/lint/shared/helpers.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        'copilot',
        'Copilot prompt files do not enforce canonical allowed-tools natively.',
      ),
    );
}

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const supported = ['PreToolUse', 'PostToolUse', 'Notification', 'UserPromptSubmit'] as const;
  const supportedSet = new Set(supported);
  const diagnostics: LintDiagnostic[] = Object.keys(canonical.hooks)
    .filter((event) => !supportedSet.has(event as never))
    .map((event) =>
      createUnsupportedHookWarning(event, 'copilot', supported, {
        unsupportedBy: 'Copilot hooks',
      }),
    );
  const hasEntries = Object.values(canonical.hooks).some(
    (entries) => Array.isArray(entries) && entries.length > 0,
  );
  if (hasEntries) {
    diagnostics.push(
      createWarning(
        '.agentsmesh/hooks.yaml',
        'copilot',
        'copilot hooks are emitted as .github/hooks/scripts/*.sh wrapper scripts with a `#!/usr/bin/env bash` header; they require a POSIX shell (git-bash or WSL) to execute on Windows.',
      ),
    );
  }
  return diagnostics;
}
