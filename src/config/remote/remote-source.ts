import { URL } from 'node:url';
import { redactUrlSecrets } from '../../utils/output/redact-url-secrets.js';

/**
 * Whether `url`'s transport is permitted for a git remote. `https`/`ssh` are
 * always allowed. `http` strips transport security (a MITM can swap cloned
 * bytes before SHA pinning) and `file` is a local-FS trust boundary (a planted
 * world-writable repo becomes priv-esc once hooks/permissions/mcp are emitted)
 * — both are gated behind explicit env opt-ins. Anything that does not parse as
 * a URL (e.g. scp-style `git@host:path`) is refused. Unknown transports such as
 * `git:`/`ext:` are never allowed.
 */
function gitProtocolOptIns(): { http: boolean; file: boolean } {
  const on = (v: string | undefined): boolean => v === '1' || v === 'true';
  return {
    http: on(process.env.AGENTSMESH_ALLOW_INSECURE_GIT),
    file: on(process.env.AGENTSMESH_ALLOW_LOCAL_GIT),
  };
}

export function isAllowedGitProtocol(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const { http, file } = gitProtocolOptIns();
  const allowed = ['https:', 'ssh:'];
  if (http) allowed.push('http:');
  if (file) allowed.push('file:');
  return allowed.includes(parsed.protocol);
}

/**
 * Colon-separated transports git itself may use, for the `GIT_ALLOW_PROTOCOL`
 * env on every spawned git process. Defense-in-depth against a remote
 * redirecting (or `insteadOf`/submodule) to a dangerous transport mid-clone
 * (e.g. `https` -> `ext::sh -c …` RCE, or `file://`). Mirrors the URL allowlist.
 */
export function gitAllowProtocolEnv(): string {
  const { http, file } = gitProtocolOptIns();
  const protos = ['https', 'ssh'];
  if (http) protos.push('http');
  if (file) protos.push('file');
  return protos.join(':');
}

/**
 * Throw if `url`'s transport is not allowed. Call this before any git network
 * operation (clone, ls-remote) reachable from an attacker-influenced source —
 * notably the `install <source>` path, which must not bypass this gate.
 */
export function assertAllowedGitUrl(url: string): void {
  if (isAllowedGitProtocol(url)) return;
  throw new Error(
    `agentsmesh refuses a git remote with a disallowed transport: "${redactUrlSecrets(url)}". ` +
      'Allowed: https, ssh. Set AGENTSMESH_ALLOW_INSECURE_GIT=1 to permit http, ' +
      'AGENTSMESH_ALLOW_LOCAL_GIT=1 to permit file.',
  );
}

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

  // Transport allowlist (https/ssh by default; http/file behind env opt-ins).
  // Shared with the install ref-resolution path via assertAllowedGitUrl so both
  // entry points enforce the same gate.
  if (!isAllowedGitProtocol(url)) return null;
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
