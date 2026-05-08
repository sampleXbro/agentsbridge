import { join } from 'node:path';
import { readdir, writeFile } from 'node:fs/promises';
import { mkdir, rm } from 'node:fs/promises';
import * as tar from 'tar';
import { exists } from '../../utils/filesystem/fs.js';
import { fetchGitRemoteExtend } from './git-remote.js';
import type { FetchRemoteOptions, FetchRemoteResult } from './remote-fetcher.js';
import type { ParsedGitSource } from './remote-source.js';
import type { ParsedGithubSource } from './remote-source.js';

/**
 * Hard cap on remote tarball size. The previous unbounded `arrayBuffer()`
 * read would happily allocate hundreds of GB if a peer (or a malformed
 * release) served an oversized response, exhausting host memory. 500 MiB is
 * generous for legitimate dotfile / config repositories.
 */
export const MAX_TARBALL_BYTES = 500 * 1024 * 1024;

/**
 * Read a `Response` body into memory but abort if the running byte total
 * exceeds `maxBytes`. Honors a non-zero `Content-Length` as a fast-fail
 * before any chunk is read. Falls back to one-shot `arrayBuffer()` when the
 * response has no readable stream (rare, e.g. some test mocks).
 */
export async function readBoundedResponse(res: Response, maxBytes: number): Promise<Uint8Array> {
  // `res.headers` may be absent in mocked test responses; treat missing as no
  // declared length and fall through to the streaming/buffer paths.
  const lenHeader =
    typeof res.headers?.get === 'function' ? res.headers.get('content-length') : null;
  if (lenHeader !== null) {
    const declared = Number(lenHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`remote response declared ${declared} bytes; exceeds cap of ${maxBytes}`);
    }
  }
  const stream = res.body;
  if (!stream) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error(`remote response is ${buf.byteLength} bytes; exceeds cap of ${maxBytes}`);
    }
    return new Uint8Array(buf);
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`remote response exceeded cap of ${maxBytes} bytes during streaming`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

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

  let tarballBytes: Uint8Array;
  try {
    const res = await globalThis.fetch(tarballUrl, { headers, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    tarballBytes = await readBoundedResponse(res, MAX_TARBALL_BYTES);
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
  await writeFile(tarPath, tarballBytes);
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
