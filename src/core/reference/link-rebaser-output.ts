/**
 * Format rewritten file paths for markdown/docs: prefer paths relative to the
 * destination file (portable across machines) when both paths stay under projectRoot.
 */

import { dirname } from 'node:path';
import { expandResolvedPaths, resolveProjectPath } from './link-rebaser-helpers.js';
import { WINDOWS_ABSOLUTE_PATH, pathApi, normalizeForProject } from '../path-helpers.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export interface FormatLinkPathOptions {
  explicitCurrentDirLinks?: boolean;
  /** When set, `project` applies `.agentsmesh`-aware link shaping; `global` uses legacy rules only for targets under `.agentsmesh/`. */
  scope?: TargetLayoutScope;
  /** Used with `scope: 'project'` to treat a path without a trailing slash as a directory when it exists as a folder on disk. */
  pathIsDirectory?: (absolutePath: string) => boolean;
  /** Force relative formatting (legacy strategy), used for markdown link destinations. */
  forceRelative?: boolean;
  /**
   * Absolute path before `translatePath` (canonical `.agentsmesh/…` on disk). Used in project scope so
   * “inside `.agentsmesh`” is judged on canonical paths while link text still targets translated outputs.
   */
  logicalMeshSourceAbsolute?: string | null;
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

function agentsMeshRoot(projectRoot: string): string {
  const api = pathApi(projectRoot);
  return normalizeForProject(projectRoot, api.join(projectRoot, '.agentsmesh'));
}

/**
 * Path from the `.agentsmesh/` directory to a file or folder inside it (forward slashes).
 * Used for directory links in project scope so outputs look like `.claude/skills/…` or `skills/foo/`
 * rather than `.agentsmesh/.claude/…` or `.agentsmesh/skills/foo/`.
 */
function toAgentsMeshRootRelative(
  projectRoot: string,
  absolutePathUnderMesh: string,
  keepSlash: boolean,
): string | null {
  const api = pathApi(projectRoot);
  const meshRoot = agentsMeshRoot(projectRoot);
  const cand = normalizeForProject(projectRoot, absolutePathUnderMesh);
  if (!isUnderAgentsMesh(projectRoot, cand)) return null;
  const relPath = api.relative(meshRoot, cand).replace(/\\/g, '/');
  if (relPath.startsWith('..')) return null;
  if (relPath.length === 0) return null; // mesh root itself → fall through to project-root-relative
  const rewritten = relPath;
  return keepSlash && !rewritten.endsWith('/') ? `${rewritten}/` : rewritten;
}

/** True when `absolutePath` is the `.agentsmesh` directory or a path inside it. */
export function isUnderAgentsMesh(projectRoot: string, absolutePath: string): boolean {
  const api = pathApi(projectRoot);
  const meshRoot = agentsMeshRoot(projectRoot);
  const cand = normalizeForProject(projectRoot, absolutePath);
  if (cand === meshRoot) return true;
  const sep = api.sep;
  const prefix = meshRoot.endsWith(sep) ? meshRoot : `${meshRoot}${sep}`;
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
 * Legacy: relative to `destinationFile` when safe, otherwise project-root-relative.
 */
function formatLinkPathForDestinationLegacy(
  projectRoot: string,
  destinationFile: string,
  absoluteTargetPath: string,
  keepSlash: boolean,
  options: FormatLinkPathOptions,
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

/**
 * Path to embed in generated/imported markdown. In **project** scope, targets under
 * `.agentsmesh/` use file-relative links for files and mesh-root paths (no `.agentsmesh/` prefix,
 * e.g. `.claude/skills/…` or `skills/foo/`) for directories; targets outside `.agentsmesh/` use
 * project-root-relative paths. **Global** scope uses legacy rules only for targets under
 * `.agentsmesh/` (skip rewriting in the caller when the target is outside `.agentsmesh/`).
 */
export function formatLinkPathForDestination(
  projectRoot: string,
  destinationFile: string,
  absoluteTargetPath: string,
  keepSlash: boolean,
  options: FormatLinkPathOptions = {},
): string | null {
  const scope: TargetLayoutScope = options.scope ?? 'project';
  const target = normalizeForProject(projectRoot, absoluteTargetPath);

  if (options.forceRelative) {
    return formatLinkPathForDestinationLegacy(
      projectRoot,
      destinationFile,
      absoluteTargetPath,
      keepSlash,
      options,
    );
  }

  if (scope === 'global') {
    return formatLinkPathForDestinationLegacy(
      projectRoot,
      destinationFile,
      absoluteTargetPath,
      keepSlash,
      options,
    );
  }

  /** Canonical path under `.agentsmesh/…` when the link points at mesh content (see `link-rebaser.ts`). */
  const meshCanonicalForShape = (() => {
    if (isUnderAgentsMesh(projectRoot, target)) return target;
    const logical = options.logicalMeshSourceAbsolute;
    if (logical && isUnderAgentsMesh(projectRoot, normalizeForProject(projectRoot, logical))) {
      return normalizeForProject(projectRoot, logical);
    }
    return null;
  })();

  if (!meshCanonicalForShape) {
    return toProjectRootRelative(projectRoot, target, keepSlash);
  }

  const treatAsDirectory = keepSlash || (options.pathIsDirectory?.(target) ?? false);
  if (treatAsDirectory) {
    const meshRelative = toAgentsMeshRootRelative(projectRoot, meshCanonicalForShape, keepSlash);
    if (meshRelative !== null) return meshRelative;
    return toProjectRootRelative(projectRoot, meshCanonicalForShape, keepSlash);
  }

  return formatLinkPathForDestinationLegacy(
    projectRoot,
    destinationFile,
    absoluteTargetPath,
    keepSlash,
    options,
  );
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
