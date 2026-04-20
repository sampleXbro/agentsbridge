/**
 * Format rewritten file paths for markdown/docs: prefer paths relative to the
 * destination file (portable across machines) when both paths stay under projectRoot.
 */

import { dirname } from 'node:path';
import { expandResolvedPaths, resolveProjectPath } from './link-rebaser-helpers.js';
import { WINDOWS_ABSOLUTE_PATH, pathApi, normalizeForProject } from '../path-helpers.js';

export interface FormatLinkPathOptions {
  explicitCurrentDirLinks?: boolean;
}

function isUnderProjectRoot(projectRoot: string, absolutePath: string): boolean {
  const api = pathApi(projectRoot);
  const root = normalizeForProject(projectRoot, projectRoot);
  const cand = normalizeForProject(projectRoot, absolutePath);
  if (cand === root) return true;
  const sep = api.sep;
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return cand.startsWith(prefix);
}

function toProjectRootRelative(
  projectRoot: string,
  absolutePath: string,
  keepSlash: boolean,
): string | null {
  const api = pathApi(projectRoot);
  const relPath = api
    .relative(
      normalizeForProject(projectRoot, projectRoot),
      normalizeForProject(projectRoot, absolutePath),
    )
    .replace(/\\/g, '/');
  if (relPath.startsWith('..')) return null;
  const rewritten = relPath.length > 0 ? relPath : '.';
  return keepSlash && !rewritten.endsWith('/') ? `${rewritten}/` : rewritten;
}

/**
 * Path to embed in generated/imported markdown: relative to `destinationFile` when safe,
 * otherwise relative to `projectRoot` (legacy project-root-relative).
 */
export function formatLinkPathForDestination(
  projectRoot: string,
  destinationFile: string,
  absoluteTargetPath: string,
  keepSlash: boolean,
  options: FormatLinkPathOptions = {},
): string | null {
  const api = pathApi(projectRoot);
  const root = normalizeForProject(projectRoot, projectRoot);
  const destFile = normalizeForProject(projectRoot, destinationFile);
  const target = normalizeForProject(projectRoot, absoluteTargetPath);

  if (!isUnderProjectRoot(projectRoot, target)) {
    return toProjectRootRelative(projectRoot, target, keepSlash);
  }
  const destDir = normalizeForProject(projectRoot, dirname(destFile));
  if (
    !isUnderProjectRoot(projectRoot, destDir) &&
    destDir !== normalizeForProject(projectRoot, projectRoot)
  ) {
    return toProjectRootRelative(projectRoot, target, keepSlash);
  }

  let rel = api.relative(destDir, target).replace(/\\/g, '/');
  const destDirFwd = destDir.replace(/\\/g, '/');
  const targetFwd = target.replace(/\\/g, '/');
  /** Antigravity (and similar) emit rules under `.agents/…` while canonical lives under `.agentsmesh/…`. */
  if (
    rel.startsWith('..') &&
    targetFwd.includes('/.agentsmesh/') &&
    destDirFwd.includes('/.agents/') &&
    !destDirFwd.includes('/.agentsmesh/')
  ) {
    return toProjectRootRelative(projectRoot, target, keepSlash);
  }
  if (api.isAbsolute(rel) || WINDOWS_ABSOLUTE_PATH.test(rel)) {
    return toProjectRootRelative(projectRoot, target, keepSlash);
  }

  const joined = normalizeForProject(projectRoot, api.join(destDir, rel));
  if (!isUnderProjectRoot(projectRoot, joined)) {
    return toProjectRootRelative(projectRoot, target, keepSlash);
  }

  if (rel === '' || rel === '.') {
    rel = '.';
  } else if (
    options.explicitCurrentDirLinks === true &&
    destDir !== root &&
    !rel.startsWith('../') &&
    !rel.startsWith('./')
  ) {
    rel = `./${rel}`;
  }

  if (keepSlash && !rel.endsWith('/')) return `${rel}/`;
  return rel;
}

/** Lower tier = better: same-directory `./…` before `../…`, before project-root-relative. */
function formattedLinkTier(formatted: string): number {
  if (formatted.startsWith('./')) return 0;
  if (formatted.startsWith('../')) return 1;
  return 2;
}

/** Negative if `a` is a strictly better (shorter / more local) link string than `b`. */
export function compareFormattedLinks(a: string, b: string): number {
  const ta = formattedLinkTier(a);
  const tb = formattedLinkTier(b);
  if (ta !== tb) return ta - tb;
  const ua = (a.match(/\.\.\//g) ?? []).length;
  const ub = (b.match(/\.\.\//g) ?? []).length;
  if (ua !== ub) return ua - ub;
  return a.length - b.length;
}

function linkResolvesToTarget(
  projectRoot: string,
  destinationFile: string,
  formatted: string,
  expectedAbsolute: string,
): boolean {
  const exp = normalizeForProject(projectRoot, expectedAbsolute);
  const probe = formatted.replace(/\/$/, '');
  for (const c of resolveProjectPath(probe, projectRoot, destinationFile)) {
    for (const e of expandResolvedPaths(projectRoot, c)) {
      if (normalizeForProject(projectRoot, e) === exp) return true;
    }
  }
  return false;
}

/**
 * Among absolute targets that exist on disk (or in the generate plan), pick the formatted
 * relative path that stays closest to the destination file (`./…` before long `../…` chains
 * or project-root-relative links).
 */
export function pickShortestValidatedFormattedLink(
  projectRoot: string,
  destinationFile: string,
  absoluteTargets: readonly string[],
  keepSlash: boolean,
  options: FormatLinkPathOptions,
  pathExists: (absolutePath: string) => boolean,
): string | null {
  let best: string | null = null;
  const seen = new Set<string>();

  for (const abs of absoluteTargets) {
    const norm = normalizeForProject(projectRoot, abs);
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (!pathExists(norm)) continue;

    const formatted = formatLinkPathForDestination(
      projectRoot,
      destinationFile,
      norm,
      keepSlash,
      options,
    );
    if (formatted === null) continue;
    if (!linkResolvesToTarget(projectRoot, destinationFile, formatted, norm)) continue;

    if (best === null || compareFormattedLinks(formatted, best) < 0) {
      best = formatted;
    }
  }
  return best;
}
