/**
 * Human-readable renderer for `agentsmesh installs <subcommand>`.
 *
 * `list` emits a space-padded table with NAME / SOURCE / FEATURES /
 * INSTALLED columns. Empty list -> single info line. Help banner is
 * triggered by the dispatcher's `showHelp` flag.
 */

import { logger } from '../../utils/output/logger.js';
import { printCommandHelp } from '../help.js';
import type { InstallsCommandResult } from '../commands/installs.js';
import type { InstallsListEntry } from '../command-result.js';

interface Row {
  readonly name: string;
  readonly source: string;
  readonly features: string;
  readonly license: string;
  readonly installed: string;
}

type ColumnKey = keyof Row;

const COLUMNS: ReadonlyArray<{ key: ColumnKey; label: string }> = [
  { key: 'name', label: 'NAME' },
  { key: 'source', label: 'SOURCE' },
  { key: 'features', label: 'FEATURES' },
  { key: 'license', label: 'LICENSE' },
  { key: 'installed', label: 'INSTALLED' },
];

function toRow(entry: InstallsListEntry): Row {
  return {
    name: entry.name,
    source: entry.source,
    features: entry.features.join(', '),
    license: entry.license ?? '-',
    installed: entry.installed_at ? entry.installed_at.slice(0, 10) : '-',
  };
}

function renderTable(rows: readonly Row[]): void {
  const widths: Record<ColumnKey, number> = {
    name: 0,
    source: 0,
    features: 0,
    license: 0,
    installed: 0,
  };
  for (const col of COLUMNS) widths[col.key] = col.label.length;
  for (const row of rows) {
    for (const col of COLUMNS) {
      widths[col.key] = Math.max(widths[col.key], row[col.key].length);
    }
  }
  const header = COLUMNS.map((c) => c.label.padEnd(widths[c.key])).join('  ');
  logger.info(header);
  for (const row of rows) {
    logger.info(COLUMNS.map((c) => row[c.key].padEnd(widths[c.key])).join('  '));
  }
}

export function renderInstalls(result: InstallsCommandResult): void {
  if (result.error) {
    logger.error(result.error);
  }
  if (result.showHelp) {
    // Single source of truth: `help-data.ts` carries the canonical flag set
    // and description. Hand-rolling a second banner here drifts every time
    // a new flag is added to the dispatcher.
    printCommandHelp('installs');
    return;
  }

  const { data } = result;
  if (data.installs.length === 0) {
    logger.info('No installed packs.');
    return;
  }
  renderTable(data.installs.map(toRow));
}
