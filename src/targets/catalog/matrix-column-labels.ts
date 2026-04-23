/**
 * CLI matrix display names — keeps presentation strings out of `src/core`.
 */

const MATRIX_COLUMN_LABELS: Readonly<Record<string, string>> = {
  'claude-code': 'Claude',
};

export function matrixColumnLabel(targetId: string): string {
  return MATRIX_COLUMN_LABELS[targetId] ?? targetId;
}
