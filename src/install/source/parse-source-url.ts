/**
 * Pure (no I/O, no configDir) URL parser shared between the install pipeline
 * and the refresh planner. Extracts remoteUrl + ref from any install source
 * string for remote kinds; returns kind='local' without remoteUrl for local.
 *
 * Callers that need the full ParsedInstallSource (pathInRepo, localRoot, etc.)
 * should use parseInstallSource from parse-install-source.ts instead.
 */

import {
  parseGithubBlobUrl,
  parseGithubRepoUrl,
  parseGithubTreeUrl,
  parseGitlabBlobUrl,
  parseGitlabRepoUrl,
  parseGitlabTreeUrl,
  parseGitSshGithub,
  parseGitSshGitlab,
} from './url-parser-remotes.js';

export interface ParsedSourceUrl {
  kind: 'github' | 'gitlab' | 'git' | 'local';
  /** Full HTTPS remote URL (e.g. https://github.com/org/repo.git). Absent for local. */
  remoteUrl?: string;
  /** Git ref (branch, tag, SHA). Absent for local. */
  ref?: string;
}

export function parseSourceUrl(source: string): ParsedSourceUrl | null {
  const trimmed = source.trim();

  // local: prefix
  if (trimmed.startsWith('local:')) {
    return { kind: 'local' };
  }

  // git+<url>#<ref>
  if (trimmed.startsWith('git+')) {
    const hashIdx = trimmed.lastIndexOf('#');
    const base = hashIdx < 0 ? trimmed : trimmed.slice(0, hashIdx);
    const ref = hashIdx < 0 ? 'HEAD' : trimmed.slice(hashIdx + 1);
    return { kind: 'git', remoteUrl: base.slice(4), ref };
  }

  // github:<org>/<repo>@<ref>
  const ghPinned = trimmed.match(/^github:([^/]+)\/(.+?)@([^/@]+)$/);
  if (ghPinned !== null) {
    const org = ghPinned[1] as string;
    const repo = ghPinned[2] as string;
    const ref = ghPinned[3] as string;
    return { kind: 'github', remoteUrl: `https://github.com/${org}/${repo}.git`, ref };
  }

  // github:<org>/<repo>
  const ghBare = trimmed.match(/^github:([^/]+)\/([^/@]+)$/);
  if (ghBare !== null) {
    const org = ghBare[1] as string;
    const repo = ghBare[2] as string;
    return { kind: 'github', remoteUrl: `https://github.com/${org}/${repo}.git`, ref: 'HEAD' };
  }

  // gitlab:<ns>/<repo>@<ref>
  const glPinned = trimmed.match(/^gitlab:(.+)\/([^/@]+)@([^/@]+)$/);
  if (glPinned !== null) {
    const ns = glPinned[1] as string;
    const repo = glPinned[2] as string;
    const ref = glPinned[3] as string;
    return { kind: 'gitlab', remoteUrl: `https://gitlab.com/${ns}/${repo}.git`, ref };
  }

  // gitlab:<ns>/<repo>
  const glBare = trimmed.match(/^gitlab:(.+)\/([^/@]+)$/);
  if (glBare !== null) {
    const ns = glBare[1] as string;
    const repo = glBare[2] as string;
    return { kind: 'gitlab', remoteUrl: `https://gitlab.com/${ns}/${repo}.git`, ref: 'HEAD' };
  }

  // HTTPS / HTTP — delegate to URL parsers for known hosts
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    const ghDetailed = parseGithubTreeUrl(trimmed) ?? parseGithubBlobUrl(trimmed);
    if (ghDetailed !== null) {
      return {
        kind: 'github',
        remoteUrl: `https://github.com/${ghDetailed.org}/${ghDetailed.repo}.git`,
        ref: ghDetailed.ref,
      };
    }
    const ghBareUrl = parseGithubRepoUrl(trimmed);
    if (ghBareUrl !== null) {
      return {
        kind: 'github',
        remoteUrl: `https://github.com/${ghBareUrl.org}/${ghBareUrl.repo}.git`,
        ref: 'HEAD',
      };
    }
    const glDetailed = parseGitlabTreeUrl(trimmed) ?? parseGitlabBlobUrl(trimmed);
    if (glDetailed !== null) {
      return {
        kind: 'gitlab',
        remoteUrl: `https://gitlab.com/${glDetailed.namespace}/${glDetailed.project}.git`,
        ref: glDetailed.ref,
      };
    }
    const glBareUrl = parseGitlabRepoUrl(trimmed);
    if (glBareUrl !== null) {
      return {
        kind: 'gitlab',
        remoteUrl: `https://gitlab.com/${glBareUrl.namespace}/${glBareUrl.project}.git`,
        ref: 'HEAD',
      };
    }
    // Generic HTTPS git remote
    return { kind: 'git', remoteUrl: trimmed, ref: 'HEAD' };
  }

  // SCP-style SSH: git@github.com:org/repo.git
  if (trimmed.startsWith('git@github.com:')) {
    const p = parseGitSshGithub(trimmed);
    if (p === null) return null;
    return { kind: 'github', remoteUrl: `https://github.com/${p.org}/${p.repo}.git`, ref: 'HEAD' };
  }

  if (trimmed.startsWith('git@gitlab.com:')) {
    const p = parseGitSshGitlab(trimmed);
    if (p === null) return null;
    return {
      kind: 'gitlab',
      remoteUrl: `https://gitlab.com/${p.namespace}/${p.project}.git`,
      ref: 'HEAD',
    };
  }

  if (trimmed.startsWith('git@')) {
    const m = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (m === null) return null;
    const host = m[1] as string;
    const pathPart = (m[2] as string).replace(/\.git$/i, '');
    return { kind: 'git', remoteUrl: `ssh://git@${host}/${pathPart}.git`, ref: 'HEAD' };
  }

  return null;
}
