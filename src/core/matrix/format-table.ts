import type { CompatibilityRow, SupportLevel } from '../types.js';
import { matrixColumnLabel } from '../../targets/catalog/matrix-column-labels.js';
import { LEVEL_SYMBOL, coloredSymbol } from './data.js';
import { colorEnabled } from '../../utils/output/color.js';

const COLORS = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

/** Full display label per feature, keyed by the base name (count suffix stripped). */
const FEATURE_LABEL: Record<string, string> = {
  rules: 'Rules',
  'additional rules': 'Additional Rules',
  commands: 'Commands',
  agents: 'Agents',
  skills: 'Skills',
  mcp: 'MCP',
  hooks: 'Hooks',
  ignore: 'Ignore',
  permissions: 'Permissions',
};

/** Drop a trailing count parenthetical — "commands (9)" / "mcp (3 servers)" → base. */
function baseName(feature: string): string {
  return feature.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function featureLabel(feature: string): string {
  const base = baseName(feature);
  return FEATURE_LABEL[base] ?? base.charAt(0).toUpperCase() + base.slice(1);
}

/** Center `text` (assumed visible length === text.length) within `width`. */
function center(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + text + ' '.repeat(pad - left);
}

/**
 * Transposed compatibility matrix: one row per target, one full-name column per
 * feature. Targets are sorted by display label; the feature symbol is centered
 * under its column header. Color is gated by `colorEnabled()`.
 */
export function formatMatrix(rows: CompatibilityRow[], targets: string[]): string {
  const useColor = colorEnabled();
  const c = (code: string, text: string): string => (useColor ? `${code}${text}${COLORS.reset}` : text);
  const GAP = '  ';

  const labels = rows.map((r) => featureLabel(r.feature));
  const colW = labels.map((l) => Math.max(3, l.length));

  const labeled = targets
    .map((t) => ({ t, label: matrixColumnLabel(t) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const targetWidth = Math.max(6, ...labeled.map((x) => x.label.length));

  const header =
    c(COLORS.bold + COLORS.cyan, 'Target'.padEnd(targetWidth)) +
    GAP +
    labels.map((l, i) => c(COLORS.bold + COLORS.magenta, center(l, colW[i]!))).join(GAP);

  const rule =
    c(COLORS.dim, '─'.repeat(targetWidth)) +
    GAP +
    colW.map((w) => c(COLORS.dim, '─'.repeat(w))).join(GAP);

  const body = labeled.map(({ t, label }) => {
    const cells = rows.map((r, i) => {
      const level = (r.support[t] ?? 'none') as SupportLevel;
      const sym = useColor ? coloredSymbol(level) : LEVEL_SYMBOL[level];
      // The symbol is one visible char; center it in the column (color codes
      // add no visible width, so center on the plain symbol then color is fine).
      const pad = colW[i]! - 1;
      const left = Math.floor(pad / 2);
      return ' '.repeat(left) + sym + ' '.repeat(pad - left);
    });
    return c(COLORS.cyan, label.padEnd(targetWidth)) + GAP + cells.join(GAP);
  });

  const legend =
    c(COLORS.green, '✓') +
    ' native  ' +
    c(COLORS.blue, '◆') +
    ' embedded  ' +
    c(COLORS.yellow, '◐') +
    ' partial  ' +
    c(COLORS.dim, '–') +
    ' none';

  return [header, rule, ...body, '', legend].join('\n');
}
