/**
 * Compatibility matrix builder: maps features to target support levels.
 */

import { basename } from 'node:path';
import type { CanonicalFiles, CompatibilityRow, SupportLevel } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { TargetCapabilities } from '../../targets/catalog/target.interface.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { getEffectiveTargetSupportLevel } from '../../targets/catalog/builtin-targets.js';
import { LEVEL_SYMBOL, coloredSymbol } from './data.js';

/**
 * Build compatibility rows for enabled features.
 * @param config - Validated config (targets, features)
 * @param canonical - Loaded canonical files (counts per feature)
 * @returns CompatibilityRow[] for enabled features only
 */
export function buildCompatibilityMatrix(
  config: ValidatedConfig,
  canonical: CanonicalFiles,
  scope: TargetLayoutScope = 'project',
): CompatibilityRow[] {
  const rows: CompatibilityRow[] = [];
  const targets = config.targets;

  for (const featureId of config.features) {
    let label: string;
    let count: number;

    switch (featureId) {
      case 'rules':
        count = canonical.rules.length;
        label = 'rules';
        break;
      case 'commands':
        count = canonical.commands.length;
        label = count > 0 ? `commands (${count})` : 'commands';
        break;
      case 'agents':
        count = canonical.agents.length;
        label = count > 0 ? `agents (${count})` : 'agents';
        break;
      case 'skills':
        count = canonical.skills.length;
        label = count > 0 ? `skills (${count})` : 'skills';
        break;
      case 'mcp':
        count = canonical.mcp ? Object.keys(canonical.mcp.mcpServers).length : 0;
        label = count > 0 ? `mcp (${count} servers)` : 'mcp';
        break;
      case 'hooks':
        count = countHooks(canonical.hooks);
        label = count > 0 ? `hooks (${count})` : 'hooks';
        break;
      case 'ignore':
        count = canonical.ignore.length > 0 ? 1 : 0;
        label = 'ignore';
        break;
      case 'permissions':
        count =
          canonical.permissions &&
          (canonical.permissions.allow.length > 0 || canonical.permissions.deny.length > 0)
            ? 1
            : 0;
        label = 'permissions';
        break;
      default:
        continue;
    }

    const support: Record<string, SupportLevel> = {};
    for (const t of targets) {
      support[t] = getEffectiveTargetSupportLevel(
        t,
        featureId as keyof TargetCapabilities,
        config,
        scope,
      );
    }

    rows.push({ feature: label, count, support });
  }

  return rows;
}

function countHooks(hooks: CanonicalFiles['hooks']): number {
  if (!hooks) return 0;
  let n = 0;
  for (const arr of Object.values(hooks)) {
    if (Array.isArray(arr)) n += arr.length;
  }
  return n;
}

/**
 * Format compatibility matrix as ASCII table with colors.
 * @param rows - Compatibility rows from buildCompatibilityMatrix
 * @param targets - Target IDs for column order
 * @returns Formatted string
 */
export function formatMatrix(rows: CompatibilityRow[], targets: string[]): string {
  const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';

  // ANSI color codes
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

  // Helper to get visible length (excluding ANSI codes)
  const visibleLength = (s: string): number => {
    // Strip ANSI SGR sequences (ESC [ ... m)
    // eslint-disable-next-line no-control-regex -- intentional match on ANSI escape byte
    return s.replace(/\u001b\[[0-9;]*m/g, '').length;
  };

  // Helper to pad text accounting for ANSI codes
  const padWithColor = (s: string, targetWidth: number): string => {
    const visible = visibleLength(s);
    const padding = Math.max(0, targetWidth - visible);
    return s + ' '.repeat(padding);
  };

  const maxTargetLen = Math.max(12, ...targets.map((t) => t.length));
  const targetLabels = targets.map((t) => (t === 'claude-code' ? 'Claude' : t));
  const colWidth = Math.max(8, maxTargetLen);
  const featWidth = Math.max(12, ...rows.map((r) => r.feature.length));

  // Box drawing with colors
  const border = (widths: number[]): string =>
    c(colors.dim, '┌' + widths.map((w) => '─'.repeat(w)).join('┬') + '┐');
  const sep = (widths: number[]): string =>
    c(colors.dim, '├' + widths.map((w) => '─'.repeat(w)).join('┼') + '┤');
  const bottom = (widths: number[]): string =>
    c(colors.dim, '└' + widths.map((w) => '─'.repeat(w)).join('┴') + '┘');

  const cols = [featWidth, ...targets.map(() => colWidth)];
  const top = border(cols);

  // Header with bold cyan
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

  // Colorful legend
  const legendItems = [
    c(colors.green, '✓') + ' = native',
    c(colors.blue, '◆') + ' = embedded',
    c(colors.yellow, '◐') + ' = partial',
    c(colors.dim, '–') + ' = not supported',
  ];
  lines.push(c(colors.bold, 'Legend: ') + legendItems.join('  '));

  return lines.join('\n');
}

/**
 * Format per-file details for --verbose output.
 * @param canonical - Loaded canonical files
 * @returns Formatted string listing files per feature
 */
export function formatVerboseDetails(canonical: CanonicalFiles): string {
  const lines: string[] = [];
  if (canonical.rules.length > 0) {
    lines.push(`rules: ${canonical.rules.map((r) => basename(r.source)).join(', ')}`);
  }
  if (canonical.commands.length > 0) {
    lines.push(`commands: ${canonical.commands.map((c) => basename(c.source)).join(', ')}`);
  }
  if (canonical.agents.length > 0) {
    lines.push(`agents: ${canonical.agents.map((a) => basename(a.source)).join(', ')}`);
  }
  if (canonical.skills.length > 0) {
    lines.push(`skills: ${canonical.skills.map((s) => s.name).join(', ')}`);
  }
  if (canonical.mcp && Object.keys(canonical.mcp.mcpServers).length > 0) {
    lines.push(`mcp: ${Object.keys(canonical.mcp.mcpServers).join(', ')}`);
  }
  if (canonical.hooks) {
    const count = Object.values(canonical.hooks).reduce(
      (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
      0,
    );
    if (count > 0) lines.push(`hooks: ${count} entries in hooks.yaml`);
  }
  if (canonical.ignore.length > 0) {
    lines.push('ignore: .agentsmesh/ignore');
  }
  if (canonical.permissions) {
    const total = canonical.permissions.allow.length + canonical.permissions.deny.length;
    if (total > 0) lines.push('permissions: .agentsmesh/permissions.yaml');
  }
  if (lines.length === 0) return '';
  return '\nPer-file details:\n' + lines.join('\n') + '\n';
}
