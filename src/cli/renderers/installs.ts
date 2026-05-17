/**
 * Human-readable renderer for `agentsmesh installs <subcommand>`.
 *
 * `list` emits a space-padded table with NAME / SOURCE / FEATURES /
 * INSTALLED columns. Empty list -> single info line. Help banner is
 * triggered by the dispatcher's `showHelp` flag.
 */

import { logger } from '../../utils/output/logger.js';
import type { InstallsCommandResult } from '../commands/installs.js';
import type { InstallsListEntry } from '../command-result.js';

const COLUMNS: ReadonlyArray<{
  key: keyof Pick<Row, 'name' | 'source' | 'features' | 'installed'>;
  label: string;
}> = [
  { key: 'name', label: 'NAME' },
  { key: 'source', label: 'SOURCE' },
  { key: 'features', label: 'FEATURES' },
  { key: 'installed', label: 'INSTALLED' },
];

interface Row {
  readonly name: string;
  readonly source: string;
  readonly features: string;
  readonly installed: string;
}

function toRow(entry: InstallsListEntry): Row {
  return {
    name: entry.name,
    source: entry.source,
    features: entry.features.join(', '),
    installed: entry.installed_at ? entry.installed_at.slice(0, 10) : '-',
  };
}

function renderTable(rows: readonly Row[]): void {
  const widths: Record<string, number> = {};
  for (const col of COLUMNS) widths[col.key] = col.label.length;
  for (const row of rows) {
    for (const col of COLUMNS) {
      widths[col.key] = Math.max(widths[col.key] ?? 0, row[col.key].length);
    }
  }
  const header = COLUMNS.map((c) => c.label.padEnd(widths[c.key] ?? 0)).join('  ');
  logger.info(header);
  for (const row of rows) {
    logger.info(COLUMNS.map((c) => row[c.key].padEnd(widths[c.key] ?? 0)).join('  '));
  }
}

export function renderInstalls(result: InstallsCommandResult): void {
  if (result.error) {
    logger.error(result.error);
  }
  if (result.showHelp) {
    printInstallsHelp();
    return;
  }

  const { data } = result;
  if (data.installs.length === 0) {
    logger.info('No installed packs.');
    return;
  }
  renderTable(data.installs.map(toRow));
}

function printInstallsHelp(): void {
  logger.info('Usage: agentsmesh installs <subcommand> [flags]');
  logger.info('');
  logger.info('Subcommands:');
  logger.info('  list  List installed packs');
  logger.info('');
  logger.info('Flags:');
  logger.info('  --global  List from ~/.agentsmesh/installs.yaml');
  logger.info('  --json    Machine-readable output');
  logger.info('');
  logger.info('Tip: `agentsmesh install <source>` (singular) adds a pack.');
}
