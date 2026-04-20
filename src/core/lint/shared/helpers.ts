/**
 * Shared lint helper utilities for target-specific linters.
 */

import type { LintDiagnostic } from '../../types.js';

/**
 * Create a warning diagnostic for a canonical file.
 */
export function createWarning(file: string, target: string, message: string): LintDiagnostic {
  return {
    level: 'warning',
    file,
    target,
    message,
  };
}

/**
 * Create a warning for unsupported metadata in a command.
 */
export function createCommandMetadataWarning(
  commandSource: string,
  target: string,
  unsupportedFields: string[],
): LintDiagnostic {
  const fields = unsupportedFields.join(' and ');
  return createWarning(
    commandSource,
    target,
    `${target} command files do not project canonical ${fields} metadata.`,
  );
}

/**
 * Format a list for prose: "a", "a and b", or "a, b, and c".
 */
function formatOxfordComma(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]!}`;
}

/**
 * Create a warning for unsupported hook events.
 * @param unsupportedBy - Phrase after "is not supported by" (defaults to `target`, e.g. "Copilot hooks").
 */
export function createUnsupportedHookWarning(
  event: string,
  target: string,
  supportedEvents: readonly string[],
  options?: { unsupportedBy?: string },
): LintDiagnostic {
  const by = options?.unsupportedBy ?? target;
  const supported = formatOxfordComma(supportedEvents);
  return createWarning(
    '.agentsmesh/hooks.yaml',
    target,
    `${event} is not supported by ${by}; only ${supported} are projected.`,
  );
}
