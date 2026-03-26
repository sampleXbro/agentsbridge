/**
 * Parse install sources: GitHub/GitLab tree URLs, git SSH/HTTPS, local paths.
 */

import { resolve, relative, sep } from 'node:path';
import { exists } from '../utils/fs.js';
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

export {
  parseGithubBlobUrl,
  parseGithubRepoUrl,
  parseGithubTreeUrl,
  parseGitlabBlobUrl,
  parseGitlabRepoUrl,
  parseGitlabTreeUrl,
  parseGitSshGithub,
  parseGitSshGitlab,
};

export type InstallSourceKind = 'github' | 'gitlab' | 'git' | 'local';

export interface ParsedInstallSource {
  kind: InstallSourceKind;
  /** Branch/tag name before pinning (GitHub/GitLab) or SHA for git+. */
  rawRef: string;
  org?: string;
  repo?: string;
  /** Clone URL for git ls-remote / generic git. */
  gitRemoteUrl?: string;
  /** Parsed git+ source without fragment (caller resolves SHA). */
  gitPlusBase?: string;
  /** Path inside repo (POSIX). Empty = repo root. */
  pathInRepo: string;
  /** Local project root (directory containing .agentsmesh or repo root). */
  localRoot?: string;
  /** Relative source string for agentsmesh.yaml (local paths). */
  localSourceForYaml?: string;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/**
 * Parse user input into structured source. `configDir` is used to resolve relative locals.
 * `explicitPath` is CLI --path (overrides URL path when set).
 */
export async function parseInstallSource(
  raw: string,
  configDir: string,
  explicitPath?: string,
): Promise<ParsedInstallSource> {
  const trimmed = raw.trim();
  const pathFlag = explicitPath?.trim().replace(/\\/g, '/') ?? '';

  if (trimmed.startsWith('git+')) {
    const hashIdx = trimmed.lastIndexOf('#');
    const base = hashIdx < 0 ? trimmed : trimmed.slice(0, hashIdx);
    const ref = hashIdx < 0 ? 'HEAD' : trimmed.slice(hashIdx + 1);
    const rest = base.slice(4);
    return {
      kind: 'git',
      rawRef: ref,
      gitPlusBase: rest,
      gitRemoteUrl: rest,
      pathInRepo: pathFlag,
    };
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    const ghDetailed = parseGithubTreeUrl(trimmed) ?? parseGithubBlobUrl(trimmed);
    if (ghDetailed) {
      return {
        kind: 'github',
        rawRef: ghDetailed.ref,
        org: ghDetailed.org,
        repo: ghDetailed.repo,
        gitRemoteUrl: `https://github.com/${ghDetailed.org}/${ghDetailed.repo}.git`,
        pathInRepo: pathFlag || ghDetailed.path,
      };
    }
    const ghBare = parseGithubRepoUrl(trimmed);
    if (ghBare) {
      return {
        kind: 'github',
        rawRef: 'HEAD',
        org: ghBare.org,
        repo: ghBare.repo,
        gitRemoteUrl: `https://github.com/${ghBare.org}/${ghBare.repo}.git`,
        pathInRepo: pathFlag,
      };
    }
    const glDetailed = parseGitlabTreeUrl(trimmed) ?? parseGitlabBlobUrl(trimmed);
    if (glDetailed) {
      return {
        kind: 'gitlab',
        rawRef: glDetailed.ref,
        org: glDetailed.namespace,
        repo: glDetailed.project,
        gitRemoteUrl: `https://gitlab.com/${glDetailed.namespace}/${glDetailed.project}.git`,
        pathInRepo: pathFlag || glDetailed.path,
      };
    }
    const glBare = parseGitlabRepoUrl(trimmed);
    if (glBare) {
      return {
        kind: 'gitlab',
        rawRef: 'HEAD',
        org: glBare.namespace,
        repo: glBare.project,
        gitRemoteUrl: `https://gitlab.com/${glBare.namespace}/${glBare.project}.git`,
        pathInRepo: pathFlag,
      };
    }
  }

  if (trimmed.startsWith('git@github.com:')) {
    const p = parseGitSshGithub(trimmed);
    if (!p) throw new Error(`Invalid GitHub SSH URL: ${trimmed}`);
    return {
      kind: 'github',
      rawRef: 'HEAD',
      org: p.org,
      repo: p.repo,
      gitRemoteUrl: `https://github.com/${p.org}/${p.repo}.git`,
      pathInRepo: pathFlag,
    };
  }

  if (trimmed.startsWith('git@gitlab.com:')) {
    const p = parseGitSshGitlab(trimmed);
    if (!p) throw new Error(`Invalid GitLab SSH URL: ${trimmed}`);
    return {
      kind: 'gitlab',
      rawRef: 'HEAD',
      gitRemoteUrl: `https://gitlab.com/${p.namespace}/${p.project}.git`,
      pathInRepo: pathFlag,
    };
  }

  if (trimmed.startsWith('git@')) {
    const m = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (!m) throw new Error(`Invalid SSH git URL: ${trimmed}`);
    const host = m[1];
    const pathPart = m[2]!.replace(/\.git$/i, '');
    return {
      kind: 'git',
      rawRef: 'HEAD',
      gitRemoteUrl: `ssh://git@${host}/${pathPart}.git`,
      pathInRepo: pathFlag,
    };
  }

  const githubSource = trimmed.match(/^github:([^/]+)\/(.+?)@([^/@]+)$/);
  if (githubSource) {
    const org = githubSource[1]!;
    const repo = githubSource[2]!;
    const ref = githubSource[3]!;
    return {
      kind: 'github',
      rawRef: ref,
      org,
      repo,
      gitRemoteUrl: `https://github.com/${org}/${repo}.git`,
      pathInRepo: pathFlag,
    };
  }

  const gitlabSource = trimmed.match(/^gitlab:(.+)\/([^/@]+)@([^/@]+)$/);
  if (gitlabSource) {
    const namespace = gitlabSource[1]!;
    const project = gitlabSource[2]!;
    const ref = gitlabSource[3]!;
    return {
      kind: 'gitlab',
      rawRef: ref,
      org: namespace,
      repo: project,
      gitRemoteUrl: `https://gitlab.com/${namespace}/${project}.git`,
      pathInRepo: pathFlag,
    };
  }

  const absLocal = resolve(configDir, trimmed);
  if (!(await exists(absLocal))) {
    throw new Error(`Path does not exist: ${absLocal}`);
  }

  const abMarker = `${sep}.agentsmesh${sep}`;
  const idx = absLocal.indexOf(abMarker);
  if (idx >= 0) {
    const root = absLocal.slice(0, idx);
    const after = absLocal.slice(idx + abMarker.length);
    const pathFromAb = toPosix(after.replace(/\\/g, '/')).replace(/^\/+/, '');
    const localSource = relative(configDir, root) || '.';
    return {
      kind: 'local',
      rawRef: '',
      pathInRepo: pathFlag || pathFromAb.replace(/\.md$/i, '').replace(/\/$/, ''),
      localRoot: root,
      localSourceForYaml: localSource.startsWith('..')
        ? localSource
        : `./${localSource}`.replace(/^\.\/\./, '.'),
    };
  }

  const localSource = relative(configDir, absLocal) || '.';
  return {
    kind: 'local',
    rawRef: '',
    pathInRepo: pathFlag,
    localRoot: absLocal,
    localSourceForYaml: localSource.startsWith('..')
      ? localSource
      : `./${localSource}`.replace(/^\.\/\./, '.'),
  };
}
