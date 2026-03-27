/**
 * Resolve extends (local paths plus supported remote sources).
 * Raw http/https URLs are not supported.
 */

import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ExtendPick, ValidatedConfig } from '../core/schema.js';
import { exists } from '../../utils/filesystem/fs.js';
import { fetchRemoteExtend, getCacheDir } from '../remote/remote-fetcher.js';
import { isSupportedRemoteSource } from '../remote/remote-source.js';

/** Resolved extend: source path resolved to absolute directory */
export interface ResolvedExtend {
  name: string;
  resolvedPath: string;
  features: string[];
  target?: string;
  /** Resolved version for remote extends. Undefined for local. */
  version?: string;
  /** Repo-relative path for discovery (skill packs, nested layouts). */
  path?: string;
  pick?: ExtendPick;
}

export interface ResolveExtendOptions {
  refreshCache?: boolean;
}

function isOtherRemoteSource(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

/**
 * Resolve extend sources to absolute paths.
 * Local paths (./, ../) resolved relative to configDir.
 * Supported remotes: github:, gitlab:, git+https://..., git+ssh://..., git+file://...
 *
 * @param config - Validated config with extends
 * @param configDir - Absolute path to directory containing agentsmesh.yaml
 * @returns Resolved extends with absolute paths
 * @throws Error if path does not exist or source is unsupported remote
 */
export async function resolveExtendPaths(
  config: ValidatedConfig,
  configDir: string,
  options: ResolveExtendOptions = {},
): Promise<ResolvedExtend[]> {
  if (config.extends.length === 0) {
    return [];
  }

  if (
    options.refreshCache === true &&
    config.extends.some((e) => isSupportedRemoteSource(e.source))
  ) {
    const cacheDir = getCacheDir();
    await rm(cacheDir, { recursive: true, force: true });
    await mkdir(cacheDir, { recursive: true });
  }

  const result: ResolvedExtend[] = [];

  for (const ext of config.extends) {
    if (isOtherRemoteSource(ext.source)) {
      throw new Error(
        `Remote extends (http/https) not supported: "${ext.source}" for extend "${ext.name}". ` +
          'Use github:org/repo@tag, gitlab:group/project@ref, git+https://host/org/repo.git#ref, or a local path (e.g. ./shared/).',
      );
    }

    if (isSupportedRemoteSource(ext.source)) {
      const fetched = await fetchRemoteExtend(ext.source, ext.name, {
        cacheDir: getCacheDir(),
        refresh: options.refreshCache === true,
      });
      result.push({
        name: ext.name,
        resolvedPath: fetched.resolvedPath,
        features: [...ext.features],
        target: ext.target,
        version: fetched.version,
        path: ext.path,
        pick: ext.pick,
      });
      continue;
    }

    const resolvedPath = resolve(configDir, ext.source);

    if (!(await exists(resolvedPath))) {
      throw new Error(
        `Extend "${ext.name}": path does not exist: ${resolvedPath}. ` +
          `Check extends.source in agentsmesh.yaml.`,
      );
    }

    result.push({
      name: ext.name,
      resolvedPath,
      features: [...ext.features],
      target: ext.target,
      path: ext.path,
      pick: ext.pick,
    });
  }

  return result;
}
