import type { CanonicalFiles, LintDiagnostic } from '../types.js';

export function lintPermissions(canonical: CanonicalFiles, target: string): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  if (target !== 'cursor') return [];
  const askLen = canonical.permissions.ask?.length ?? 0;
  const hasEntries =
    canonical.permissions.allow.length > 0 || canonical.permissions.deny.length > 0 || askLen > 0;
  if (!hasEntries) return [];

  return [
    {
      level: 'warning',
      file: '.agentsmesh/permissions.yaml',
      target,
      message: 'Cursor permissions are partial; tool-level allow/deny may lose fidelity.',
    },
  ];
}
