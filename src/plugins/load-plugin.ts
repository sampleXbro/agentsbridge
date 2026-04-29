/**
 * Plugin loader: dynamically imports npm packages that export TargetDescriptors.
 */

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDescriptor } from '../targets/catalog/target-descriptor.schema.js';
import { registerTargetDescriptor } from '../targets/catalog/registry.js';
import type { TargetDescriptor } from '../targets/catalog/target-descriptor.js';
import type { PluginEntry } from '../config/core/schema.js';
import { logger } from '../utils/output/logger.js';

export interface LoadedPlugin {
  entry: PluginEntry;
  descriptors: TargetDescriptor[];
}

/**
 * Import a plugin module and extract TargetDescriptors from it.
 * Priority: `export const descriptor` → `export const descriptors` → `export default`
 */
async function importPluginModule(
  entry: PluginEntry,
  projectRoot: string,
): Promise<Record<string, unknown>> {
  const { source } = entry;
  let importTarget: string;

  if (
    source.startsWith('file:') ||
    source.startsWith('./') ||
    source.startsWith('../') ||
    source.startsWith('/')
  ) {
    // Local file: resolve against project root and convert to file URL.
    // Use fileURLToPath (not URL.pathname) so Windows drive-prefixed paths
    // like `file:///C:/...` round-trip correctly — URL.pathname leaves the
    // leading slash before `C:` which is not a valid filesystem path.
    const raw = source.startsWith('file:') ? fileURLToPath(source) : source;
    const resolved = resolve(projectRoot, raw);
    importTarget = pathToFileURL(resolved).href;
  } else {
    // npm package: Node resolves from the consuming project's node_modules
    importTarget = source;
  }

  const mod = await import(importTarget);
  return mod as Record<string, unknown>;
}

function extractDescriptors(mod: Record<string, unknown>): unknown[] {
  if ('descriptor' in mod) return [mod['descriptor']];
  if ('descriptors' in mod && Array.isArray(mod['descriptors'])) return mod['descriptors'];
  if ('default' in mod) return [mod['default']];
  return [];
}

/**
 * Load a single plugin: import, validate, register, and return descriptors.
 * @throws Error if the import fails or a descriptor is invalid
 */
export async function loadPlugin(entry: PluginEntry, projectRoot: string): Promise<LoadedPlugin> {
  let mod: Record<string, unknown>;
  try {
    mod = await importPluginModule(entry, projectRoot);
  } catch (err) {
    throw new Error(
      `Plugin '${entry.source}' failed to import: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  const rawDescriptors = extractDescriptors(mod);

  const descriptors: TargetDescriptor[] = [];
  for (const raw of rawDescriptors) {
    try {
      const descriptor = validateDescriptor(raw);
      registerTargetDescriptor(descriptor);
      descriptors.push(descriptor);
    } catch (err) {
      throw new Error(
        `Plugin '${entry.source}' exported an invalid descriptor: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  return { entry, descriptors };
}

/**
 * Load all configured plugins.
 * Per-plugin errors are contained: a failing plugin logs a warning and is skipped.
 * @returns Array of successfully loaded plugins
 */
export async function loadAllPlugins(
  entries: readonly PluginEntry[],
  projectRoot: string,
): Promise<LoadedPlugin[]> {
  const results: LoadedPlugin[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      try {
        const loaded = await loadPlugin(entry, projectRoot);
        results.push(loaded);
      } catch (err) {
        logger.warn(
          `Plugin '${entry.source}' failed to load: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  return results;
}
