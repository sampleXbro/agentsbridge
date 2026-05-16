/**
 * Derive the persisted name for an install entry, including reuse of an
 * existing pack name when the same source is being re-installed under a
 * different URL variant (https / ssh / `github:` shorthand).
 */

import type { ValidatedConfig } from '../../config/core/schema.js';
import type { ParsedInstallSource } from '../source/install-source-types.js';
import type { InstallManifestEntry } from './install-manifest.js';
import { suggestExtendName } from './name-generator.js';

export function selectInstallEntryName(args: {
  config: ValidatedConfig;
  parsed: Parameters<typeof suggestExtendName>[0];
  entryFeatures: ValidatedConfig['features'];
  nameOverride: string;
}): string {
  const { config, parsed, entryFeatures, nameOverride } = args;
  const used = new Set(config.extends.map((entry) => entry.name));
  return (
    nameOverride ||
    suggestExtendName(
      parsed,
      { featureHint: entryFeatures.length === 1 ? entryFeatures[0] : undefined },
      used,
    )
  );
}

/**
 * Canonical remote identity used for cross-protocol equality of install
 * sources. Returns `null` for inputs that do not name a remote git repo
 * (local paths, malformed URLs).
 *
 * Encoding: `<host-shorthand>:<org>/<repo>` lowercased, with `.git` and any
 * `@<ref>` / `#<ref>` suffix stripped. Host-shorthand is `github` or
 * `gitlab` for the two recognized public hosts and `git:<host>` for
 * generic ssh/https remotes; this last form lets self-hosted GitLab or
 * Gitea installs still de-duplicate against themselves.
 */
function canonicalRemoteIdentity(rawSource: string): string | null {
  const trimmed = rawSource.trim();

  const ghShort = trimmed.match(/^github:([^/]+)\/([^/@]+?)(?:\.git)?(?:@[^/]+)?$/i);
  if (ghShort) return `github:${ghShort[1]!.toLowerCase()}/${ghShort[2]!.toLowerCase()}`;

  const glShort = trimmed.match(/^gitlab:(.+?)\/([^/@]+?)(?:\.git)?(?:@[^/]+)?$/i);
  if (glShort) return `gitlab:${glShort[1]!.toLowerCase()}/${glShort[2]!.toLowerCase()}`;

  const httpsGh = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  if (httpsGh) return `github:${httpsGh[1]!.toLowerCase()}/${httpsGh[2]!.toLowerCase()}`;

  const httpsGl = trimmed.match(
    /^https?:\/\/gitlab\.com\/(.+?)\/([^/?#]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  if (httpsGl) return `gitlab:${httpsGl[1]!.toLowerCase()}/${httpsGl[2]!.toLowerCase()}`;

  const sshGh = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshGh) return `github:${sshGh[1]!.toLowerCase()}/${sshGh[2]!.toLowerCase()}`;

  const sshGl = trimmed.match(/^git@gitlab\.com:(.+?)\/([^/]+?)(?:\.git)?$/i);
  if (sshGl) return `gitlab:${sshGl[1]!.toLowerCase()}/${sshGl[2]!.toLowerCase()}`;

  if (trimmed.startsWith('git+')) {
    const hashIdx = trimmed.lastIndexOf('#');
    const inner = hashIdx < 0 ? trimmed.slice(4) : trimmed.slice(4, hashIdx);
    return canonicalRemoteIdentity(inner);
  }

  return null;
}

function parsedSourceIdentity(parsed: ParsedInstallSource): string | null {
  if (parsed.kind === 'github' && parsed.org && parsed.repo) {
    return `github:${parsed.org.toLowerCase()}/${parsed.repo.toLowerCase()}`;
  }
  if (parsed.kind === 'gitlab' && parsed.org && parsed.repo) {
    return `gitlab:${parsed.org.toLowerCase()}/${parsed.repo.toLowerCase()}`;
  }
  if (parsed.gitRemoteUrl) {
    return canonicalRemoteIdentity(parsed.gitRemoteUrl);
  }
  return null;
}

/**
 * Look up an existing install entry that points at the same remote
 * repository as `parsed`, regardless of protocol variance in how the user
 * spelled the source URL. Returns the entry's persisted name, or `null`
 * when no equivalent entry exists.
 */
export function findExistingInstallName(
  manifest: readonly InstallManifestEntry[],
  parsed: ParsedInstallSource,
): string | null {
  const target = parsedSourceIdentity(parsed);
  if (target === null) return null;
  for (const entry of manifest) {
    const id = canonicalRemoteIdentity(entry.source);
    if (id !== null && id === target) return entry.name;
  }
  return null;
}
