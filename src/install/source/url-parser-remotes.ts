/**
 * GitHub / GitLab tree URL and SSH helpers for install source parsing.
 */

import { URL } from 'node:url';

/** GitHub https://github.com/org/repo/tree/ref/rest */
export function parseGithubTreeUrl(urlStr: string): {
  org: string;
  repo: string;
  ref: string;
  path: string;
} | null {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const ti = parts.indexOf('tree');
    if (ti < 2 || ti + 1 >= parts.length) return null;
    const org = parts[0];
    const repo = parts[1];
    const ref = parts[ti + 1];
    const path = parts.slice(ti + 2).join('/');
    if (!org || !repo || !ref) return null;
    return { org, repo, ref, path: path || '' };
  } catch {
    return null;
  }
}

/** GitHub https://github.com/org/repo/blob/ref/rest */
export function parseGithubBlobUrl(urlStr: string): {
  org: string;
  repo: string;
  ref: string;
  path: string;
} | null {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const bi = parts.indexOf('blob');
    if (bi < 2 || bi + 1 >= parts.length) return null;
    const org = parts[0];
    const repo = parts[1];
    const ref = parts[bi + 1];
    const path = parts.slice(bi + 2).join('/');
    if (!org || !repo || !ref || !path) return null;
    return { org, repo, ref, path };
  } catch {
    return null;
  }
}

/** GitLab https://gitlab.com/group/project/-/tree/ref/path */
export function parseGitlabTreeUrl(urlStr: string): {
  namespace: string;
  project: string;
  ref: string;
  path: string;
} | null {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'gitlab.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const ti = parts.indexOf('-');
    if (ti < 0 || parts[ti + 1] !== 'tree') return null;
    const treeIdx = ti + 1;
    if (treeIdx + 1 >= parts.length) return null;
    const ref = parts[treeIdx + 1];
    const path = parts.slice(treeIdx + 2).join('/');
    const before = parts.slice(0, ti);
    if (before.length < 2) return null;
    const project = before[before.length - 1];
    const namespace = before.slice(0, -1).join('/');
    if (!namespace || !project || !ref) return null;
    return { namespace, project, ref, path: path || '' };
  } catch {
    return null;
  }
}

/** GitLab https://gitlab.com/group/project/-/blob/ref/path */
export function parseGitlabBlobUrl(urlStr: string): {
  namespace: string;
  project: string;
  ref: string;
  path: string;
} | null {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'gitlab.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const marker = parts.indexOf('-');
    if (marker < 0 || parts[marker + 1] !== 'blob') return null;
    const blobIdx = marker + 1;
    if (blobIdx + 1 >= parts.length) return null;
    const ref = parts[blobIdx + 1];
    const path = parts.slice(blobIdx + 2).join('/');
    const before = parts.slice(0, marker);
    if (before.length < 2) return null;
    const project = before[before.length - 1];
    const namespace = before.slice(0, -1).join('/');
    if (!namespace || !project || !ref || !path) return null;
    return { namespace, project, ref, path };
  } catch {
    return null;
  }
}

/** Known GitHub route segments that indicate a non-repo URL (3+ path segments). */
const GITHUB_ROUTE_WORDS = new Set([
  'tree',
  'blob',
  'commit',
  'releases',
  'actions',
  'issues',
  'pulls',
  'settings',
  'wiki',
  'discussions',
  'security',
  'projects',
  'packages',
]);

/** GitHub bare repo: https://github.com/org/repo[.git] */
export function parseGithubRepoUrl(urlStr: string): { org: string; repo: string } | null {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname
      .split('/')
      .filter(Boolean)
      .map((s) => s.replace(/\.git$/i, ''));
    if (parts.length < 2) return null;
    if (parts.length > 2 || GITHUB_ROUTE_WORDS.has(parts[1]!)) return null;
    const org = parts[0]!;
    const repo = parts[1]!;
    return { org, repo };
  } catch {
    return null;
  }
}

/** GitLab bare repo: https://gitlab.com/namespace/project[.git] */
export function parseGitlabRepoUrl(urlStr: string): { namespace: string; project: string } | null {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'gitlab.com') return null;
    const parts = u.pathname
      .split('/')
      .filter(Boolean)
      .map((s) => s.replace(/\.git$/i, ''));
    if (parts.length < 2) return null;
    if (parts.includes('-')) return null;
    const project = parts[parts.length - 1]!;
    const namespace = parts.slice(0, -1).join('/');
    if (!namespace || !project) return null;
    return { namespace, project };
  } catch {
    return null;
  }
}

/** git@github.com:org/repo.git */
export function parseGitSshGithub(ssh: string): { org: string; repo: string } | null {
  const m = ssh.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (!m) return null;
  return { org: m[1]!, repo: m[2]!.replace(/\.git$/i, '') };
}

export function parseGitSshGitlab(ssh: string): { namespace: string; project: string } | null {
  const m = ssh.match(/^git@gitlab\.com:(.+?)(?:\.git)?$/i);
  if (!m) return null;
  const rest = m[1]!.replace(/\.git$/i, '');
  const parts = rest.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const project = parts[parts.length - 1]!;
  const namespace = parts.slice(0, -1).join('/');
  return { namespace, project };
}
