/**
 * Auto-generate extends entry names for install.
 */

import { URL } from 'node:url';
import type { ParsedInstallSource } from '../source/url-parser.js';

function sanitize(base: string): string {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function gitUrlLastSegments(url: string): string {
  try {
    const u = new URL(url.replace(/^git\+/, 'https://').replace(/^ssh:\/\/git@/, 'https://'));
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length === 0) return 'repo';
    const last = segs[segs.length - 1]!.replace(/\.git$/i, '');
    if (segs.length >= 2) {
      const prev = segs[segs.length - 2]!.replace(/\.git$/i, '');
      return `${prev}-${last}`;
    }
    return last;
  } catch {
    return 'repo';
  }
}

export function suggestExtendName(
  parsed: ParsedInstallSource,
  opts: { featureHint?: string },
  usedNames: Set<string>,
): string {
  let base: string;
  if (parsed.kind === 'local') {
    const root = parsed.localRoot ?? 'local';
    const parts = root.split(/[/\\]/).filter(Boolean);
    base = parts[parts.length - 1] ?? 'local';
  } else if (parsed.kind === 'github' && parsed.org && parsed.repo) {
    base = `${parsed.org}-${parsed.repo}`;
  } else if (parsed.kind === 'gitlab' && parsed.org && parsed.repo) {
    base = `${parsed.org.replace(/\//g, '-')}-${parsed.repo}`;
  } else if (parsed.gitRemoteUrl) {
    base = gitUrlLastSegments(parsed.gitRemoteUrl);
  } else {
    base = 'extend';
  }

  if (opts.featureHint) {
    base = `${base}-${opts.featureHint}`;
  } else {
    base = `${base}-pack`;
  }

  const baseName = sanitize(base) || 'extend';
  if (!usedNames.has(baseName)) return baseName;
  let n = 2;
  while (usedNames.has(`${baseName}-${n}`)) n++;
  return `${baseName}-${n}`;
}
