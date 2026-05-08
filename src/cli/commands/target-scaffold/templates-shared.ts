/**
 * Shared types and helpers for the target-scaffold templates.
 * Split from `templates.ts` to keep each module under the 200-line file budget.
 */

export interface TemplateVars {
  id: string; // e.g. 'kilo-code'
  displayName: string; // e.g. 'Kilo Code'
}

/** Convert 'kilo-code' → 'KILO_CODE' */
export function toPrefix(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}

/** Convert 'kilo-code' → 'KiloCode' (PascalCase) */
export function toPascal(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
