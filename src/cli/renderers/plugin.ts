/**
 * Human-readable renderer for plugin command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { PluginCommandResult } from '../commands/plugin.js';

export function renderPlugin(result: PluginCommandResult): void {
  if (result.error) {
    logger.error(result.error);
  }
  if (result.showHelp) {
    printPluginHelp();
    return;
  }

  const { data } = result;

  switch (data.subcommand) {
    case 'add':
      renderAdd(data.id, data.package, data.version);
      break;
    case 'list':
      renderList(data.plugins);
      break;
    case 'remove':
      renderRemove(data.id, data.found);
      break;
    case 'info':
      renderInfo(data, result.exitCode);
      break;
  }
}

function renderAdd(id: string, pkg: string, version: string): void {
  logger.success(`Plugin '${id}' added to agentsmesh.yaml`);
  logger.warn(
    'Plugins load as trusted Node.js modules and run with full process privileges. Only install plugins from sources you trust.',
  );
  const versionSuffix = version !== 'latest' ? `@${version}` : '@latest';
  logger.info(`Next: npm install ${pkg}${versionSuffix}`);
  logger.info(`Then add '${id}' to pluginTargets in agentsmesh.yaml to enable it.`);
}

function renderList(
  plugins: Array<{
    id: string;
    package: string;
    version?: string;
    status?: string;
    targets?: string;
  }>,
): void {
  if (plugins.length === 0) {
    logger.info('No plugins configured. Use: agentsmesh plugin add <source>');
    return;
  }

  logger.info('Configured plugins:');
  for (const entry of plugins) {
    const versionStr = entry.version !== undefined ? `@${entry.version}` : '';
    const status = entry.status ?? '';
    const targets = entry.targets ?? '';
    logger.info(`  ${entry.id} | ${entry.package}${versionStr} | ${status} | ${targets}`);
  }
}

function renderRemove(id: string, found: boolean): void {
  if (found) {
    logger.success(`Plugin '${id}' removed from agentsmesh.yaml`);
  } else {
    logger.warn(`Plugin '${id}' was not found in agentsmesh.yaml`);
  }
}

function renderInfo(
  data: {
    id: string;
    package: string;
    version?: string;
    descriptors: Array<{ id: string; description: string }>;
  },
  exitCode: number,
): void {
  if (exitCode !== 0 && data.package === '') {
    logger.error(`Plugin '${data.id}' not found in agentsmesh.yaml. Use: agentsmesh plugin add`);
    return;
  }

  if (exitCode !== 0) {
    logger.error(`Failed to load plugin '${data.id}'`);
    return;
  }

  logger.info(`Plugin: ${data.id}`);
  logger.info(`Source: ${data.package}${data.version !== undefined ? `@${data.version}` : ''}`);
  logger.info(`Descriptors: ${data.descriptors.length}`);
  for (const desc of data.descriptors) {
    logger.info(`  - ${desc.id}: ${desc.description}`);
  }
}

function printPluginHelp(): void {
  logger.info('Usage: agentsmesh plugin <subcommand> [args] [flags]');
  logger.info('');
  logger.info('Subcommands:');
  logger.info('  add <source>  Register a plugin package in agentsmesh.yaml');
  logger.info('  list          Show all configured plugins and load status');
  logger.info('  remove <id>   Remove a plugin from agentsmesh.yaml');
  logger.info('  info <id>     Show descriptor details for a configured plugin');
  logger.info('');
  logger.info('Flags (add):');
  logger.info('  --version <v>  Pin plugin version');
  logger.info('  --id <id>      Override derived plugin id');
  logger.info('');
  logger.info(
    'Note: plugins load as trusted Node.js modules and run with full process privileges.',
  );
  logger.info('  Only install plugins from sources you trust.');
}
