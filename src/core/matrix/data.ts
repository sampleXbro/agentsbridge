import type { SupportLevel } from '../types.js';
import { TARGET_IDS, TARGET_CATALOG } from '../../targets/catalog/target-catalog.js';

const FEATURE_IDS = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
] as const;

/** PRD-defined support: feature -> target -> level */
export const SUPPORT_MATRIX: Record<string, Record<string, SupportLevel>> = Object.fromEntries(
  FEATURE_IDS.map((feature) => [
    feature,
    Object.fromEntries(
      TARGET_IDS.map((target) => [target, TARGET_CATALOG[target].capabilities[feature]]),
    ),
  ]),
) as Record<string, Record<string, SupportLevel>>;

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
