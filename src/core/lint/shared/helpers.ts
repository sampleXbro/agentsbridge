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
 * Create a warning for unsupported hook events.
 */
export function createUnsupportedHookWarning(
  event: string,
  target: string,
  supportedEvents: readonly string[],
): LintDiagnostic {
  const supported = supportedEvents.join(', ');
  return createWarning(
    '.agentsmesh/hooks.yaml',
    target,
    `${event} is not supported by ${target}; only ${supported} are projected.`,
  );
}
