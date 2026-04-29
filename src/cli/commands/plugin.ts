/**
 * agentsmesh plugin — plugin management subcommands.
 * add | list | remove | info
 */

import { logger } from '../../utils/output/logger.js';
import { loadPlugin } from '../../plugins/load-plugin.js';
import {
  readScopedConfigRaw,
  writePluginEntry,
  removePluginEntry,
} from '../../plugins/plugin-config.js';

/**
 * Run the plugin command.
 * @param flags - CLI flags
 * @param args  - Positional args (subcommand + subcommand args)
 * @param projectRoot - Project root (process.cwd())
 * @returns Exit code: 0 success, 1 plugin error, 2 bad usage
 */
export async function runPlugin(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<number> {
  const subcommand = args[0];

  if (subcommand === undefined || subcommand === '') {
    printPluginHelp();
    return 0;
  }

  switch (subcommand) {
    case 'add':
      return runPluginAdd(flags, args.slice(1), projectRoot);
    case 'list':
      return runPluginList(projectRoot);
    case 'remove':
      return runPluginRemove(args.slice(1), projectRoot);
    case 'info':
      return runPluginInfo(args.slice(1), projectRoot);
    default:
      logger.error(`Unknown plugin subcommand: ${subcommand}`);
      printPluginHelp();
      return 2;
  }
}

async function runPluginAdd(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<number> {
  const source = args[0];
  if (!source) {
    logger.error('Usage: agentsmesh plugin add <source> [--version <v>] [--id <id>]');
    return 2;
  }

  const version = typeof flags.version === 'string' ? flags.version : undefined;
  const idOverride = typeof flags.id === 'string' ? flags.id : undefined;

  // Derive id from source if not overridden
  const id = idOverride ?? derivePluginId(source);

  try {
    await writePluginEntry(projectRoot, { id, source, version });
  } catch (err) {
    logger.error(`Failed to update config: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  logger.success(`Plugin '${id}' added to agentsmesh.yaml`);
  logger.warn(
    'Plugins load as trusted Node.js modules and run with full process privileges. Only install plugins from sources you trust.',
  );
  logger.info(`Next: npm install ${source}${version !== undefined ? `@${version}` : '@latest'}`);
  logger.info(`Then add '${id}' to pluginTargets in agentsmesh.yaml to enable it.`);
  return 0;
}

async function runPluginList(projectRoot: string): Promise<number> {
  let config;
  try {
    config = await readScopedConfigRaw(projectRoot);
  } catch (err) {
    logger.error(`Failed to read config: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const plugins = config.plugins ?? [];
  if (plugins.length === 0) {
    logger.info('No plugins configured. Use: agentsmesh plugin add <source>');
    return 0;
  }

  logger.info('Configured plugins:');
  for (const entry of plugins) {
    let status = '✗';
    let targets = '';
    try {
      const loaded = await loadPlugin(entry, projectRoot);
      status = loaded.descriptors.length > 0 ? '✓' : '✓ (0 descriptors)';
      targets = loaded.descriptors.map((d) => d.id).join(', ');
    } catch {
      // status remains '✗'
    }
    const versionStr = entry.version !== undefined ? `@${entry.version}` : '';
    logger.info(`  ${entry.id} | ${entry.source}${versionStr} | ${status} | ${targets}`);
  }
  return 0;
}

async function runPluginRemove(args: string[], projectRoot: string): Promise<number> {
  const id = args[0];
  if (!id) {
    logger.error('Usage: agentsmesh plugin remove <id>');
    return 2;
  }

  try {
    const removed = await removePluginEntry(projectRoot, id);
    if (removed) {
      logger.success(`Plugin '${id}' removed from agentsmesh.yaml`);
    } else {
      logger.warn(`Plugin '${id}' was not found in agentsmesh.yaml`);
    }
  } catch (err) {
    logger.error(`Failed to update config: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  return 0;
}

async function runPluginInfo(args: string[], projectRoot: string): Promise<number> {
  const id = args[0];
  if (!id) {
    logger.error('Usage: agentsmesh plugin info <id>');
    return 2;
  }

  let config;
  try {
    config = await readScopedConfigRaw(projectRoot);
  } catch (err) {
    logger.error(`Failed to read config: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const entry = (config.plugins ?? []).find((p) => p.id === id);
  if (!entry) {
    logger.error(`Plugin '${id}' not found in agentsmesh.yaml. Use: agentsmesh plugin add`);
    return 1;
  }

  let loaded;
  try {
    loaded = await loadPlugin(entry, projectRoot);
  } catch (err) {
    logger.error(
      `Failed to load plugin '${id}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }

  logger.info(`Plugin: ${entry.id}`);
  logger.info(`Source: ${entry.source}${entry.version !== undefined ? `@${entry.version}` : ''}`);
  logger.info(`Descriptors: ${loaded.descriptors.length}`);
  for (const desc of loaded.descriptors) {
    logger.info(`  - ${desc.id}: ${desc.emptyImportMessage}`);
  }
  return 0;
}

/** Strip scope (@org/) and common agentsmesh-target- prefix, then slugify. */
function derivePluginId(source: string): string {
  let s = source;
  // Strip npm scope
  if (s.startsWith('@')) {
    const slash = s.indexOf('/');
    if (slash !== -1) s = s.slice(slash + 1);
  }
  // Strip common prefix
  if (s.startsWith('agentsmesh-target-')) {
    s = s.slice('agentsmesh-target-'.length);
  }
  // Strip file: prefix
  if (s.startsWith('file:')) {
    s = s.slice('file:'.length);
  }
  // Normalize path separators and take basename
  const parts = s.replace(/\\/g, '/').split('/');
  s = parts[parts.length - 1] ?? s;
  // Remove .js, .ts extensions
  s = s.replace(/\.(js|ts)$/, '');
  // Lowercase and replace non-id chars with hyphens
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'plugin';
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
