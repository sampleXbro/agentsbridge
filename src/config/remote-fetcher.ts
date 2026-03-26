/**
 * Remote extend fetcher — dispatches to supported remote source providers.
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import { fetchGitRemoteExtend } from './git-remote.js';
import { fetchGithubRemoteExtend, resolveLatestTag } from './github-remote.js';
import {
  parseGitSource,
  parseGitlabSource,
  parseGithubSource,
  parseRemoteSource,
} from './remote-source.js';
import { sweepStaleCache } from '../install/cache-cleanup.js';

export { parseGitSource, parseGitlabSource, parseGithubSource, resolveLatestTag };

/** Result of fetching a remote extend */
export interface FetchRemoteResult {
  resolvedPath: string;
  version: string;
}

/** Options for fetchRemoteExtend */
export interface FetchRemoteOptions {
  cacheDir?: string;
  token?: string;
  refresh?: boolean;
  /** When false, network failure does not fall back to cached tarball (install flow). */
  allowOfflineFallback?: boolean;
}

export function buildCacheKey(provider: string, identifier: string, ref: string): string {
  const safe = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (provider === 'github') {
    const [org, repo] = identifier.split('/', 2);
    if (org && repo) return `${safe(org)}-${safe(repo)}-${safe(ref)}`;
  }
  return `${safe(provider)}_${safe(identifier)}_${safe(ref)}`;
}

/**
 * Get default cache directory (~/.agentsmesh/cache or AGENTSMESH_CACHE).
 */
export function getCacheDir(): string {
  const env = process.env.AGENTSMESH_CACHE;
  if (env) return env;
  return join(homedir(), '.agentsmesh', 'cache');
}

/**
 * Fetch remote extend, supporting GitHub tarballs and Git-backed providers.
 */
export async function fetchRemoteExtend(
  source: string,
  extendName: string,
  options: FetchRemoteOptions = {},
): Promise<FetchRemoteResult> {
  const parsed = parseRemoteSource(source);
  if (!parsed) {
    if (source.startsWith('github:')) {
      throw new Error(`Invalid github: source: "${source}" for extend "${extendName}"`);
    }
    if (source.startsWith('gitlab:')) {
      throw new Error(`Invalid gitlab: source: "${source}" for extend "${extendName}"`);
    }
    if (source.startsWith('git+')) {
      throw new Error(`Invalid git+ source: "${source}" for extend "${extendName}"`);
    }
    throw new Error(
      `Invalid remote source: "${source}" for extend "${extendName}". ` +
        'Use github:org/repo@tag, gitlab:group/project@ref, or git+https://host/org/repo.git#ref.',
    );
  }

  const cacheDir = options.cacheDir ?? getCacheDir();

  // Fire-and-forget: sweep entries older than AGENTSMESH_CACHE_MAX_AGE_DAYS (default 30d)
  // so the cache does not grow unboundedly without user intervention.
  void sweepStaleCache(cacheDir).catch(() => {});

  if (parsed.kind === 'github') {
    return fetchGithubRemoteExtend(
      parsed,
      extendName,
      options,
      cacheDir,
      buildCacheKey,
      !source.includes('@'),
    );
  }
  return fetchGitRemoteExtend(parsed, extendName, options, cacheDir, buildCacheKey);
}
