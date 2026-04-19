import type { SupportLevel } from '../types.js';
import type { TargetCapabilities } from '../../targets/catalog/target.interface.js';
import { TARGET_IDS } from '../../targets/catalog/target-ids.js';
import { getBuiltinTargetDefinition } from '../../targets/catalog/builtin-targets.js';

const FEATURE_IDS = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
] as const satisfies ReadonlyArray<keyof TargetCapabilities>;

function buildSupportMatrix(
  scope: 'project' | 'global',
): Record<string, Record<string, SupportLevel>> {
  return Object.fromEntries(
    FEATURE_IDS.map((feature) => [
      feature,
      Object.fromEntries(
        TARGET_IDS.map((targetId) => {
          const d = getBuiltinTargetDefinition(targetId);
          const caps =
            scope === 'global' ? (d?.globalCapabilities ?? d?.capabilities) : d?.capabilities;
          const level = (caps?.[feature] ?? 'none') as SupportLevel;
          return [targetId, level];
        }),
      ),
    ]),
  ) as Record<string, Record<string, SupportLevel>>;
}

/** Project-scope catalog levels (`descriptor.capabilities`). */
export const SUPPORT_MATRIX = buildSupportMatrix('project');

/** Global-scope catalog levels (`descriptor.globalCapabilities ?? descriptor.capabilities`). */
export const SUPPORT_MATRIX_GLOBAL = buildSupportMatrix('global');

export const LEVEL_SYMBOL: Record<SupportLevel, string> = {
  native: '✓',
  embedded: '◆',
  partial: '◐',
  none: '–',
};

/** ANSI color codes for support levels */
const ANSI = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function noColor(): boolean {
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
}

function colorize(code: string, text: string): string {
  return noColor() ? text : `${code}${text}${ANSI.reset}`;
}

export const LEVEL_COLOR: Record<SupportLevel, string> = {
  native: ANSI.green,
  embedded: ANSI.blue,
  partial: ANSI.yellow,
  none: ANSI.dim,
};

export function coloredSymbol(level: SupportLevel): string {
  const symbol = LEVEL_SYMBOL[level];
  return colorize(LEVEL_COLOR[level], symbol);
}
