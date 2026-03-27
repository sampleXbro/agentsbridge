/**
 * Compatibility matrix builder: maps features to target support levels.
 */

import { basename } from 'node:path';
import type { CanonicalFiles, CompatibilityRow, SupportLevel } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { TargetCapabilities } from '../../targets/catalog/target.interface.js';
import { getEffectiveTargetSupportLevel } from '../../targets/catalog/builtin-targets.js';
import { SUPPORT_MATRIX, LEVEL_SYMBOL } from './data.js';

/**
 * Build compatibility rows for enabled features.
 * @param config - Validated config (targets, features)
 * @param canonical - Loaded canonical files (counts per feature)
 * @returns CompatibilityRow[] for enabled features only
 */
export function buildCompatibilityMatrix(
  config: ValidatedConfig,
  canonical: CanonicalFiles,
): CompatibilityRow[] {
  const rows: CompatibilityRow[] = [];
  const targets = config.targets;

  for (const featureId of config.features) {
    const supportMap = SUPPORT_MATRIX[featureId];
    if (!supportMap) continue;

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
      const level =
        supportMap[t] === undefined
          ? 'none'
          : getEffectiveTargetSupportLevel(t, featureId as keyof TargetCapabilities, config);
      support[t] = level;
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
 * Format compatibility matrix as ASCII table.
 * @param rows - Compatibility rows from buildCompatibilityMatrix
 * @param targets - Target IDs for column order
 * @returns Formatted string
 */
export function formatMatrix(rows: CompatibilityRow[], targets: string[]): string {
  const maxTargetLen = Math.max(12, ...targets.map((t) => t.length));
  const targetLabels = targets.map((t) => (t === 'claude-code' ? 'Claude' : t));
  const colWidth = Math.max(8, maxTargetLen);
  const featWidth = Math.max(12, ...rows.map((r) => r.feature.length));

  const pad = (s: string, w: number): string => s.padEnd(w);
  const border = (chars: string[]): string => '┌' + chars.join('┬') + '┐';
  const sep = (chars: string[]): string => '├' + chars.join('┼') + '┤';
  const bottom = (chars: string[]): string => '└' + chars.join('┴') + '┘';

  const cols = [featWidth, ...targets.map(() => colWidth)];
  const top = border(cols.map((w) => '─'.repeat(w)));
  const bot = bottom(cols.map((w) => '─'.repeat(w)));

  const headerCells = [pad('Feature', featWidth), ...targetLabels.map((l) => pad(l, colWidth))];
  const header = border(headerCells.map((c, i) => c.padEnd(cols[i]!)));
  const headerSep = sep(cols.map((w) => '─'.repeat(w)));

  const bodyRows = rows.map((r) => {
    const cells = [pad(r.feature, featWidth)];
    for (const t of targets) {
      const sym = LEVEL_SYMBOL[r.support[t] ?? 'none'];
      cells.push(pad(`  ${sym}  `, colWidth));
    }
    return sep(
      cells.map((c, i) => (c.length > cols[i]! ? c.slice(0, cols[i]) : c.padEnd(cols[i]!))),
    );
  });

  const lines = [top, header, headerSep, ...bodyRows, bot];
  lines.push('');
  lines.push('Legend: ✓ = native  📝 = embedded  ⚠ = partial  – = not supported');
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
