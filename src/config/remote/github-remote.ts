import { join } from 'node:path';
import { readdir, writeFile } from 'node:fs/promises';
import { mkdir, rm } from 'node:fs/promises';
import * as tar from 'tar';
import { exists } from '../../utils/filesystem/fs.js';
import { fetchGitRemoteExtend } from './git-remote.js';
import type { FetchRemoteOptions, FetchRemoteResult } from './remote-fetcher.js';
import type { ParsedGitSource } from './remote-source.js';
import type { ParsedGithubSource } from './remote-source.js';

export async function resolveLatestTag(org: string, repo: string, token?: string): Promise<string> {
  const url = `https://api.github.com/repos/${org}/${repo}/releases/latest`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await globalThis.fetch(url, { headers });
  if (!res.ok) {
    throw new Error(
      `Failed to resolve latest release for ${org}/${repo}: ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { tag_name?: string };
  if (!data.tag_name || typeof data.tag_name !== 'string') {
    throw new Error(`No tag_name in releases/latest response for ${org}/${repo}`);
  }
  return data.tag_name;
}

export async function fetchGithubRemoteExtend(
  parsed: ParsedGithubSource,
  extendName: string,
  options: FetchRemoteOptions,
  cacheDir: string,
  buildCacheKey: (provider: string, identifier: string, ref: string) => string,
  allowDefaultBranchFallback = false,
): Promise<FetchRemoteResult> {
  const token = options.token ?? process.env.AGENTSMESH_GITHUB_TOKEN;
  const refresh = options.refresh === true;
  let tag = parsed.tag;
  if (tag === 'latest') {
    try {
      tag = await resolveLatestTag(parsed.org, parsed.repo, token);
    } catch (err) {
      if (!allowDefaultBranchFallback) throw err;
      return fetchGithubDefaultBranch(parsed, extendName, options, cacheDir, buildCacheKey, token);
    }
  }
  const cacheKey = buildCacheKey('github', `${parsed.org}/${parsed.repo}`, tag);
  const extractDir = join(cacheDir, cacheKey);

  if (!refresh && (await exists(extractDir))) {
    const topDir = await findExtractTopDir(extractDir);
    if (topDir) return { resolvedPath: join(extractDir, topDir), version: tag };
  }

  const tarballUrl = `https://github.com/${parsed.org}/${parsed.repo}/tarball/${tag}`;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let tarballBuffer: ArrayBuffer;
  try {
    const res = await globalThis.fetch(tarballUrl, { headers, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    tarballBuffer = await res.arrayBuffer();
  } catch (err) {
    const allowFallback = options.allowOfflineFallback !== false;
    if (allowFallback && (await exists(extractDir))) {
      const topDir = await findExtractTopDir(extractDir);
      if (topDir) {
        console.warn(
          `[agentsmesh] Network failed for ${extendName}; using cached version. Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        return { resolvedPath: join(extractDir, topDir), version: tag };
      }
    }
    throw err;
  }

  await rm(extractDir, { recursive: true, force: true });
  await mkdir(extractDir, { recursive: true });
  const tarPath = join(extractDir, 'archive.tar.gz');
  await writeFile(tarPath, new Uint8Array(tarballBuffer));
  try {
    await tar.extract({
      file: tarPath,
      cwd: extractDir,
      strict: true,
      filter: (entryPath, entry) => {
        if (isZipSlipPath(entryPath)) return false;
        if (entry && 'type' in entry && (entry.type === 'Link' || entry.type === 'SymbolicLink')) {
          return false;
        }
        return true;
      },
    });
  } finally {
    await rm(tarPath, { force: true }).catch(() => {});
  }

  const topDir = await findExtractTopDir(extractDir);
  if (!topDir) {
    throw new Error(
      `Extend "${extendName}": archive has no top-level directory. ` +
        `Expected a single top-level directory inside the archive.`,
    );
  }

  const resolvedPath = join(extractDir, topDir);
  return { resolvedPath, version: tag };
}

async function findExtractTopDir(extractDir: string): Promise<string | null> {
  const entries = await readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
  return dirs.length === 1 ? dirs[0]!.name : null;
}

function buildGithubCloneUrl(org: string, repo: string, token?: string): string {
  if (!token) return `https://github.com/${org}/${repo}.git`;
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${org}/${repo}.git`;
}

function isZipSlipPath(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, '/');
  return normalized.startsWith('/') || normalized.split('/').includes('..');
}

async function fetchGithubDefaultBranch(
  parsed: ParsedGithubSource,
  extendName: string,
  options: FetchRemoteOptions,
  cacheDir: string,
  buildCacheKey: (provider: string, identifier: string, ref: string) => string,
  token?: string,
): Promise<FetchRemoteResult> {
  const cloneUrls = token
    ? [buildGithubCloneUrl(parsed.org, parsed.repo, token)]
    : [
        buildGithubCloneUrl(parsed.org, parsed.repo),
        `ssh://git@github.com/${parsed.org}/${parsed.repo}.git`,
      ];

  let lastError: unknown;
  for (const url of cloneUrls) {
    const gitSource: ParsedGitSource = { url };
    try {
      return await fetchGitRemoteExtend(gitSource, extendName, options, cacheDir, buildCacheKey);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to clone GitHub default branch');
}
