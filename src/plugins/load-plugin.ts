/**
 * Plugin loader: dynamically imports npm packages that export TargetDescriptors.
 */

import { resolve, join, sep, dirname, basename } from 'node:path';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
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
    source.startsWith('/') ||
    // Windows absolute paths: `D:\foo`, `C:/bar`, etc. `node:path`'s `resolve()` produces
    // these on win32, and they must not be misinterpreted as bare npm package names.
    /^[A-Za-z]:[/\\]/.test(source)
  );
}

/**
 * Reject local plugin sources whose resolved path escapes `projectRoot`.
 *
 * `agentsmesh.yaml` is a trust boundary — anyone who can write a `source`
 * entry there would otherwise get arbitrary code execution on the next CLI
 * invocation via a path like `../../tmp/evil.js`. Bare npm specifiers go
 * through `resolveNpmSpecifier` and are confined to `node_modules/`, which
 * itself lives inside `projectRoot`, so this check covers both paths.
 *
 * Both sides are canonicalized via `realpath` before comparison so
 * platform-level symlinks (notably macOS `/tmp -> /private/tmp`) do not
 * cause false positives, and so a symlink planted inside `projectRoot`
 * cannot redirect outside (its realpath escapes the project root).
 */
function canonicalize(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    // The full path can't be resolved (a missing tail, or a dangling symlink).
    // Walk up to the nearest existing ancestor, canonicalize THAT, then
    // re-append the unresolved tail. This stops an intermediate symlink from
    // smuggling the path past the containment prefix check via a suffix that
    // does not exist yet — falling back to the raw (non-realpathed) path would
    // otherwise let `node_modules/linked-out/missing.js` look in-root.
    let current = resolve(path);
    const tail: string[] = [];
    for (;;) {
      const parent = dirname(current);
      if (parent === current) return resolve(path);
      tail.unshift(basename(current));
      try {
        return join(realpathSync(parent), ...tail);
      } catch {
        current = parent;
      }
    }
  }
}

function assertSourceInsideProjectRoot(resolvedPath: string, projectRoot: string): void {
  const rootAbs = canonicalize(resolve(projectRoot));
  const sourceAbs = canonicalize(resolvedPath);
  if (sourceAbs === rootAbs || sourceAbs.startsWith(`${rootAbs}${sep}`)) return;
  throw new Error(`Plugin source resolves outside project root (escapes ${rootAbs}): ${sourceAbs}`);
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
    assertSourceInsideProjectRoot(resolved, projectRoot);
    importTarget = pathToFileURL(resolved).href;
  } else {
    const resolved = resolveNpmSpecifier(source, projectRoot);
    assertSourceInsideProjectRoot(resolved, projectRoot);
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
 *
 * Per-plugin errors are contained by default: a failing plugin logs a warning
 * and is skipped. When the entry sets `strict: true` (or the
 * `AGENTSMESH_STRICT_PLUGINS=1` env var is set), any failed load is rethrown
 * so CI/release pipelines fail loudly instead of silently shrinking the
 * generation matrix.
 *
 * @returns Array of successfully loaded plugins
 */
export async function loadAllPlugins(
  entries: readonly PluginEntry[],
  projectRoot: string,
): Promise<LoadedPlugin[]> {
  const results: LoadedPlugin[] = [];
  const envStrict =
    process.env.AGENTSMESH_STRICT_PLUGINS === '1' ||
    process.env.AGENTSMESH_STRICT_PLUGINS === 'true';

  const settled = await Promise.all(
    entries.map(async (entry) => {
      try {
        const loaded = await loadPlugin(entry, projectRoot);
        results.push(loaded);
        return null;
      } catch (err) {
        const message = `Plugin '${entry.source}' failed to load: ${
          err instanceof Error ? err.message : String(err)
        }`;
        if (entry.strict === true || envStrict) {
          return new Error(message);
        }
        logger.warn(message);
        return null;
      }
    }),
  );

  const fatal = settled.filter((e): e is Error => e !== null);
  if (fatal.length > 0) {
    const summary = fatal.map((e) => `  - ${e.message}`).join('\n');
    throw new Error(`agentsmesh: ${fatal.length} plugin(s) failed strict load:\n${summary}`);
  }

  return results;
}
