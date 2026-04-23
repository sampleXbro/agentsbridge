import type { CompatibilityRow } from '../types.js';
import { matrixColumnLabel } from '../../targets/catalog/matrix-column-labels.js';
import { LEVEL_SYMBOL, coloredSymbol } from './data.js';

/**
 * Format compatibility matrix as ASCII table with colors.
 */
export function formatMatrix(rows: CompatibilityRow[], targets: string[]): string {
  const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';

  const colors = {
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
  };

  const c = (code: string, text: string): string =>
    noColor ? text : `${code}${text}${colors.reset}`;

  const visibleLength = (s: string): number => {
    // eslint-disable-next-line no-control-regex -- intentional match on ANSI escape byte
    return s.replace(/\u001b\[[0-9;]*m/g, '').length;
  };

  const padWithColor = (s: string, targetWidth: number): string => {
    const visible = visibleLength(s);
    const padding = Math.max(0, targetWidth - visible);
    return s + ' '.repeat(padding);
  };

  const maxTargetLen = Math.max(12, ...targets.map((t) => t.length));
  const targetLabels = targets.map((t) => matrixColumnLabel(t));
  const colWidth = Math.max(8, maxTargetLen);
  const featWidth = Math.max(12, ...rows.map((r) => r.feature.length));

  const border = (widths: number[]): string =>
    c(colors.dim, '┌' + widths.map((w) => '─'.repeat(w)).join('┬') + '┐');
  const sep = (widths: number[]): string =>
    c(colors.dim, '├' + widths.map((w) => '─'.repeat(w)).join('┼') + '┤');
  const bottom = (widths: number[]): string =>
    c(colors.dim, '└' + widths.map((w) => '─'.repeat(w)).join('┴') + '┘');

  const cols = [featWidth, ...targets.map(() => colWidth)];
  const top = border(cols);

  const headerCells = [
    padWithColor(c(colors.bold + colors.cyan, 'Feature'), featWidth),
    ...targetLabels.map((l) => padWithColor(c(colors.bold + colors.magenta, l), colWidth)),
  ];
  const header = c(colors.dim, '│') + headerCells.join(c(colors.dim, '│')) + c(colors.dim, '│');
  const headerSep = sep(cols);

  const bodyRows = rows.map((r) => {
    const cells = [padWithColor(c(colors.cyan, r.feature), featWidth)];
    for (const t of targets) {
      const level = r.support[t] ?? 'none';
      const sym = noColor ? LEVEL_SYMBOL[level] : coloredSymbol(level);
      cells.push(padWithColor(`  ${sym}  `, colWidth));
    }
    return c(colors.dim, '│') + cells.join(c(colors.dim, '│')) + c(colors.dim, '│');
  });

  const bot = bottom(cols);

  const lines = [top, header, headerSep, ...bodyRows, bot];
  lines.push('');

  const legendItems = [
    c(colors.green, '✓') + ' = native',
    c(colors.blue, '◆') + ' = embedded',
    c(colors.yellow, '◐') + ' = partial',
    c(colors.dim, '–') + ' = not supported',
  ];
  lines.push(c(colors.bold, 'Legend: ') + legendItems.join('  '));

  return lines.join('\n');
}
