import { execFile } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { URL } from 'node:url';
import { promisify } from 'node:util';
import { exists } from '../../utils/filesystem/fs.js';
import type { FetchRemoteOptions, FetchRemoteResult } from './remote-fetcher.js';
import type { ParsedGitSource, ParsedGitlabSource } from './remote-source.js';

const execFileAsync = promisify(execFile);
const REPO_DIRNAME = 'repo';

export async function fetchGitRemoteExtend(
  parsed: ParsedGitSource | ParsedGitlabSource,
  extendName: string,
  options: FetchRemoteOptions,
  cacheDir: string,
  buildCacheKey: (provider: string, identifier: string, ref: string) => string,
): Promise<FetchRemoteResult> {
  const provider = 'cloneUrl' in parsed ? 'gitlab' : 'git';
  const identifier = 'cloneUrl' in parsed ? `${parsed.namespace}/${parsed.project}` : parsed.url;
  const ref = parsed.ref ?? 'HEAD';
  const cacheKey = buildCacheKey(provider, identifier, ref);
  const cacheRoot = join(cacheDir, cacheKey);
  const cacheRepoDir = join(cacheRoot, REPO_DIRNAME);
  const stagedRoot = `${cacheRoot}.tmp`;
  const stagedRepoDir = join(stagedRoot, REPO_DIRNAME);

  if (!options.refresh && (await hasCachedRepo(cacheRepoDir))) {
    return readCachedRepo(cacheRepoDir);
  }

  try {
    await rm(stagedRoot, { recursive: true, force: true });
    await mkdir(stagedRoot, { recursive: true });
    await cloneRepo(resolveCloneUrl(parsed), stagedRepoDir);
    if (parsed.ref) await checkoutRef(stagedRepoDir, parsed.ref);
    await rm(cacheRoot, { recursive: true, force: true });
    await rename(stagedRoot, cacheRoot);
    return readCachedRepo(cacheRepoDir);
  } catch (err) {
    await rm(stagedRoot, { recursive: true, force: true });
    const allowFallback = options.allowOfflineFallback !== false;
    if (allowFallback && (await hasCachedRepo(cacheRepoDir))) {
      console.warn(
        `[agentsmesh] Remote fetch failed for ${extendName}; using cached version. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return readCachedRepo(cacheRepoDir);
    }
    throw err;
  }
}

async function readCachedRepo(repoDir: string): Promise<FetchRemoteResult> {
  return {
    resolvedPath: repoDir,
    version: await getHeadSha(repoDir),
  };
}

async function hasCachedRepo(repoDir: string): Promise<boolean> {
  return exists(repoDir);
}

function resolveCloneUrl(parsed: ParsedGitSource | ParsedGitlabSource): string {
  if ('cloneUrl' in parsed) {
    const token = process.env.AGENTSMESH_GITLAB_TOKEN;
    if (token) {
      const url = new URL(parsed.cloneUrl);
      if (url.protocol === 'https:') {
        url.username = 'oauth2';
        url.password = token;
        return url.toString();
      }
    }
    return parsed.cloneUrl;
  }
  return parsed.url;
}

async function cloneRepo(cloneUrl: string, repoDir: string): Promise<void> {
  await runGit(['clone', cloneUrl, repoDir]);
}

async function checkoutRef(repoDir: string, ref: string): Promise<void> {
  await runGit(['checkout', ref], repoDir);
}

async function getHeadSha(repoDir: string): Promise<string> {
  return runGit(['rev-parse', 'HEAD'], repoDir);
}

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return stdout.trim();
}
