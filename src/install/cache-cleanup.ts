/**
 * Remove specific cache entry after successful pack materialization.
 * Also provides automatic TTL-based sweep to prevent unbounded cache growth.
 */

import { join } from 'node:path';
import { readdir, rm, stat } from 'node:fs/promises';
import { buildCacheKey, getCacheDir } from '../config/remote-fetcher.js';
import { parseRemoteSource } from '../config/remote-source.js';

/**
 * Derive the cache key for a sourceForYaml string.
 * Returns null for local sources or unparseable strings.
 */
export function cacheKeyFromSource(source: string): string | null {
  const parsed = parseRemoteSource(source);
  if (!parsed) return null;

  if (parsed.kind === 'github') {
    return buildCacheKey('github', `${parsed.org}/${parsed.repo}`, parsed.tag);
  }
  if (parsed.kind === 'gitlab') {
    return buildCacheKey('gitlab', `${parsed.namespace}/${parsed.project}`, parsed.ref ?? 'HEAD');
  }
  // git
  return buildCacheKey('git', parsed.url, parsed.ref ?? 'HEAD');
}

/**
 * Remove the cache directory for a specific install source.
 * No-op for local sources or if cache entry does not exist.
 *
 * @param source - sourceForYaml string (e.g. "github:org/repo@sha")
 * @param cacheDir - Override cache directory (defaults to getCacheDir())
 */
export async function cleanInstallCache(source: string, cacheDir?: string): Promise<void> {
  const key = cacheKeyFromSource(source);
  if (!key) return; // local source — no cache to clean

  const dir = cacheDir ?? getCacheDir();
  const entryPath = join(dir, key);
  await rm(entryPath, { recursive: true, force: true });
}

/**
 * Remove all cache entries whose mtime is older than maxAgeMs.
 * Defaults to AGENTSMESH_CACHE_MAX_AGE_DAYS env var (default: 30 days).
 * No-op if the cache directory does not exist or is empty.
 *
 * @param cacheDir - Cache directory to sweep (defaults to getCacheDir())
 * @param maxAgeMs - Maximum age in milliseconds before an entry is considered stale
 */
export async function sweepStaleCache(cacheDir?: string, maxAgeMs?: number): Promise<void> {
  const dir = cacheDir ?? getCacheDir();
  const threshold =
    maxAgeMs ?? Number(process.env.AGENTSMESH_CACHE_MAX_AGE_DAYS ?? 30) * 86_400_000;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return; // cache dir doesn't exist yet
  }

  const now = Date.now();
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(dir, entry);
      try {
        const { mtimeMs } = await stat(entryPath);
        if (now - mtimeMs > threshold) {
          await rm(entryPath, { recursive: true, force: true });
        }
      } catch {
        // entry disappeared between readdir and stat — ignore
      }
    }),
  );
}
