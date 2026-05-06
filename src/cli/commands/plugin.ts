/**
 * agentsmesh plugin — plugin management subcommands.
 * add | list | remove | info
 */

import { loadPlugin } from '../../plugins/load-plugin.js';
import {
  readScopedConfigRaw,
  writePluginEntry,
  removePluginEntry,
} from '../../plugins/plugin-config.js';
import { CliUsageError } from '../cli-error.js';
import type { PluginData } from '../command-result.js';

export interface PluginCommandResult {
  exitCode: number;
  data: PluginData;
  showHelp?: boolean;
  error?: string;
}

/**
 * Run the plugin command.
 * @param flags - CLI flags
 * @param args  - Positional args (subcommand + subcommand args)
 * @param projectRoot - Project root (process.cwd())
 * @returns Structured result with exit code and data
 */
export async function runPlugin(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<PluginCommandResult> {
  const subcommand = args[0];

  if (subcommand === undefined || subcommand === '') {
    return { exitCode: 0, data: { subcommand: 'list', plugins: [] }, showHelp: true };
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
      return {
        exitCode: 2,
        data: { subcommand: 'list', plugins: [] },
        showHelp: true,
        error: `Unknown plugin subcommand: ${subcommand}`,
      };
  }
}

async function runPluginAdd(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<PluginCommandResult> {
  const source = args[0];
  if (!source) {
    throw new CliUsageError('Usage: agentsmesh plugin add <source> [--version <v>] [--id <id>]');
  }

  const version = typeof flags.version === 'string' ? flags.version : 'latest';
  const idOverride = typeof flags.id === 'string' ? flags.id : undefined;
  const id = idOverride ?? derivePluginId(source);

  await writePluginEntry(projectRoot, {
    id,
    source,
    version: version === 'latest' ? undefined : version,
  });

  return {
    exitCode: 0,
    data: { subcommand: 'add', id, package: source, version },
  };
}

async function runPluginList(projectRoot: string): Promise<PluginCommandResult> {
  const config = await readScopedConfigRaw(projectRoot);
  const entries = config.plugins ?? [];

  const plugins: Array<{
    id: string;
    package: string;
    version?: string;
    status?: string;
    targets?: string;
  }> = [];
  for (const entry of entries) {
    let status = '✗';
    let targets = '';
    try {
      const loaded = await loadPlugin(entry, projectRoot);
      status = loaded.descriptors.length > 0 ? '✓' : '✓ (0 descriptors)';
      targets = loaded.descriptors.map((d) => d.id).join(', ');
    } catch {
      // status remains '✗'
    }
    plugins.push({
      id: entry.id,
      package: entry.source,
      version: entry.version,
      status,
      targets,
    });
  }

  return { exitCode: 0, data: { subcommand: 'list', plugins } };
}

async function runPluginRemove(args: string[], projectRoot: string): Promise<PluginCommandResult> {
  const id = args[0];
  if (!id) {
    throw new CliUsageError('Usage: agentsmesh plugin remove <id>');
  }

  const removed = await removePluginEntry(projectRoot, id);
  return { exitCode: 0, data: { subcommand: 'remove', id, found: removed } };
}

async function runPluginInfo(args: string[], projectRoot: string): Promise<PluginCommandResult> {
  const id = args[0];
  if (!id) {
    throw new CliUsageError('Usage: agentsmesh plugin info <id>');
  }

  const config = await readScopedConfigRaw(projectRoot);
  const entry = (config.plugins ?? []).find((p) => p.id === id);
  if (!entry) {
    return {
      exitCode: 1,
      data: { subcommand: 'info', id, package: '', descriptors: [] },
    };
  }

  let loaded;
  try {
    loaded = await loadPlugin(entry, projectRoot);
  } catch {
    return {
      exitCode: 1,
      data: {
        subcommand: 'info',
        id,
        package: entry.source,
        version: entry.version,
        descriptors: [],
      },
    };
  }

  const descriptors = loaded.descriptors.map((d) => ({
    id: d.id,
    description: d.emptyImportMessage,
  }));

  return {
    exitCode: 0,
    data: {
      subcommand: 'info',
      id,
      package: entry.source,
      version: entry.version,
      descriptors,
    },
  };
}

/** Strip scope (@org/) and common agentsmesh-target- prefix, then slugify. */
function derivePluginId(source: string): string {
  let s = source;
  if (s.startsWith('@')) {
    const slash = s.indexOf('/');
    if (slash !== -1) s = s.slice(slash + 1);
  }
  if (s.startsWith('agentsmesh-target-')) {
    s = s.slice('agentsmesh-target-'.length);
  }
  if (s.startsWith('file:')) {
    s = s.slice('file:'.length);
  }
  const parts = s.replace(/\\/g, '/').split('/');
  s = parts[parts.length - 1] ?? s;
  s = s.replace(/\.(js|ts)$/, '');
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'plugin';
}
