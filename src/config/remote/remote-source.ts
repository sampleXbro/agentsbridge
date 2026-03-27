import { URL } from 'node:url';

export interface ParsedGithubSource {
  org: string;
  repo: string;
  tag: string;
}

export interface ParsedGitlabSource {
  namespace: string;
  project: string;
  ref?: string;
  cloneUrl: string;
}

export interface ParsedGitSource {
  url: string;
  ref?: string;
}

export type ParsedRemoteSource =
  | ({ kind: 'github' } & ParsedGithubSource)
  | ({ kind: 'gitlab' } & ParsedGitlabSource)
  | ({ kind: 'git' } & ParsedGitSource);

function splitSourceRef(
  source: string,
  prefix: string,
  defaultRef?: string,
): [string, string?] | null {
  if (!source.startsWith(prefix)) return null;
  const rest = source.slice(prefix.length).trim();
  if (!rest) return null;
  const refIdx = rest.lastIndexOf('@');
  if (refIdx < 0) return [rest, defaultRef];
  const slug = rest.slice(0, refIdx).trim();
  const ref = rest.slice(refIdx + 1).trim();
  if (!slug || !ref) return null;
  return [slug, ref];
}

export function parseGithubSource(source: string): ParsedGithubSource | null {
  const parts = splitSourceRef(source, 'github:', 'latest');
  if (!parts) return null;
  const [slug, tag] = parts;
  const slash = slug.indexOf('/');
  if (slash < 0) return null;
  const org = slug.slice(0, slash).trim();
  const repo = slug.slice(slash + 1).trim();
  if (!org || !repo || !tag) return null;
  return { org, repo, tag };
}

export function parseGitlabSource(source: string): ParsedGitlabSource | null {
  const parts = splitSourceRef(source, 'gitlab:');
  if (!parts) return null;
  const [slug, ref] = parts;
  const slash = slug.lastIndexOf('/');
  if (slash < 0) return null;
  const namespace = slug.slice(0, slash).trim();
  const project = slug.slice(slash + 1).trim();
  if (!namespace || !project) return null;
  return {
    namespace,
    project,
    ref,
    cloneUrl: `https://gitlab.com/${namespace}/${project}.git`,
  };
}

export function parseGitSource(source: string): ParsedGitSource | null {
  if (!source.startsWith('git+')) return null;
  const rest = source.slice(4).trim();
  if (!rest) return null;
  const hashIdx = rest.lastIndexOf('#');
  const url = (hashIdx < 0 ? rest : rest.slice(0, hashIdx)).trim();
  const ref = hashIdx < 0 ? undefined : rest.slice(hashIdx + 1).trim();
  if (!url || (hashIdx >= 0 && !ref)) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  if (!['https:', 'http:', 'ssh:', 'file:'].includes(parsedUrl.protocol)) {
    return null;
  }
  return { url, ref };
}

export function parseRemoteSource(source: string): ParsedRemoteSource | null {
  const github = parseGithubSource(source);
  if (github) return { kind: 'github', ...github };

  const gitlab = parseGitlabSource(source);
  if (gitlab) return { kind: 'gitlab', ...gitlab };

  const git = parseGitSource(source);
  if (git) return { kind: 'git', ...git };

  return null;
}

export function isSupportedRemoteSource(source: string): boolean {
  return parseRemoteSource(source) !== null;
}
