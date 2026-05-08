/**
 * Plugin loader: dynamically imports npm packages that export TargetDescriptors.
 */

import { resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
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
 * Resolve an npm bare specifier to an absolute file path via node_modules.
 * Works identically in Node.js and Bun-compiled binaries.
 */
export function resolveNpmSpecifier(source: string, projectRoot: string): string {
  const pkgDir = join(projectRoot, 'node_modules', source);
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(`Cannot find package '${source}' in ${join(projectRoot, 'node_modules')}`);
  }
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as Record<string, unknown>;
  const entry =
    (typeof pkgJson.exports === 'string' ? pkgJson.exports : null) ??
    (typeof pkgJson.main === 'string' ? pkgJson.main : null) ??
    'index.js';
  const resolved = resolve(pkgDir, entry);
  if (!existsSync(resolved)) {
    throw new Error(`Package '${source}' entry '${entry}' does not exist at ${resolved}`);
  }
  return resolved;
}

function isLocalSource(source: string): boolean {
  return (
    source.startsWith('file:') ||
    source.startsWith('./') ||
    source.startsWith('../') ||
    source.startsWith('/')
  );
}

async function importPluginModule(
  entry: PluginEntry,
  projectRoot: string,
): Promise<Record<string, unknown>> {
  const { source } = entry;
  let importTarget: string;

  if (isLocalSource(source)) {
    const raw = source.startsWith('file:') ? fileURLToPath(source) : source;
    const resolved = resolve(projectRoot, raw);
    importTarget = pathToFileURL(resolved).href;
  } else {
    const resolved = resolveNpmSpecifier(source, projectRoot);
    importTarget = pathToFileURL(resolved).href;
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
