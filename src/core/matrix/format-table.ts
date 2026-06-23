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

const FEATURE_ABBR: Record<string, string> = {
  rules: 'Rul',
  'additional rules': '+Ru',
  commands: 'Cmd',
  agents: 'Agt',
  skills: 'Skl',
  mcp: 'MCP',
  hooks: 'Hok',
  ignore: 'Ign',
  permissions: 'Prm',
};

function baseName(feature: string): string {
  return feature.replace(/\s*\(\d+\)\s*$/, '').trim();
}

function abbr(feature: string): string {
  const base = baseName(feature);
  return (FEATURE_ABBR[base] ?? base.slice(0, 3).padEnd(3)).slice(0, 3);
}

/** Transposed compatibility matrix: one row per target, one symbol column per feature. */
export function formatMatrix(rows: CompatibilityRow[], targets: string[]): string {
  const useColor = colorEnabled();
  const c = (code: string, text: string): string => (useColor ? `${code}${text}${COLORS.reset}` : text);
  const COL = 3;
  const GAP = '  ';

  const labeled = targets
    .map((t) => ({ t, label: matrixColumnLabel(t) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const targetWidth = Math.max(6, ...labeled.map((x) => x.label.length));

  const header =
    c(COLORS.bold + COLORS.cyan, 'Target'.padEnd(targetWidth)) +
    GAP +
    rows.map((r) => c(COLORS.bold + COLORS.magenta, abbr(r.feature).padEnd(COL))).join(GAP);

  const rule =
    c(COLORS.dim, '─'.repeat(targetWidth)) +
    GAP +
    rows.map(() => c(COLORS.dim, '─'.repeat(COL))).join(GAP);

  const body = labeled.map(({ t, label }) => {
    const cells = rows.map((r) => {
      const level = (r.support[t] ?? 'none') as SupportLevel;
      const sym = useColor ? coloredSymbol(level) : LEVEL_SYMBOL[level];
      return sym + ' '.repeat(COL - 1);
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

  const keyParts = rows.map((r) => `${abbr(r.feature)} ${baseName(r.feature)}`);
  const keyLines: string[] = [];
  for (let i = 0; i < keyParts.length; i += 5) {
    keyLines.push(c(COLORS.dim, keyParts.slice(i, i + 5).join(' · ')));
  }

  return [header, rule, ...body, '', legend, ...keyLines].join('\n');
}
