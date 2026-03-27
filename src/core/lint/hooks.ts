import type { CanonicalFiles, LintDiagnostic } from '../types.js';

export function lintHooks(canonical: CanonicalFiles, target: string): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  if (target === 'gemini-cli') {
    const supported = new Set(['PreToolUse', 'PostToolUse', 'Notification']);
    return Object.keys(canonical.hooks)
      .filter((event) => !supported.has(event))
      .map((event) => ({
        level: 'warning' as const,
        file: '.agentsmesh/hooks.yaml',
        target,
        message: `${event} is not supported by gemini-cli; only PreToolUse, PostToolUse, and Notification are projected.`,
      }));
  }

  if (target === 'copilot') {
    const supported = new Set(['PreToolUse', 'PostToolUse', 'Notification', 'UserPromptSubmit']);
    return Object.keys(canonical.hooks)
      .filter((event) => !supported.has(event))
      .map((event) => ({
        level: 'warning' as const,
        file: '.agentsmesh/hooks.yaml',
        target,
        message: `${event} is not supported by Copilot hooks; only PreToolUse, PostToolUse, Notification, and UserPromptSubmit are projected.`,
      }));
  }

  return [];
}
