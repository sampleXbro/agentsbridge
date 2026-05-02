/**
 * Format rewritten file paths for markdown/docs: prefer paths relative to the
 * destination file (portable across machines) when both paths stay under projectRoot.
 */

import { expandResolvedPaths, resolveProjectPath } from './link-rebaser-helpers.js';
import { normalizeForProject, pathApi } from '../path-helpers.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import {
  formatLinkPathForDestinationLegacy,
  isUnderAgentsMesh,
  isReadingContextOptions,
  toAgentsMeshRootRelative,
  toProjectRootReference,
  type FormatLinkPathOptions,
} from './link-rebaser-formatting.js';

export { isUnderAgentsMesh, type FormatLinkPathOptions } from './link-rebaser-formatting.js';

/**
 * Path to embed in generated/imported markdown. In **project** scope, targets under
 * `.agentsmesh/` use file-relative links for files and mesh-root paths (no `.agentsmesh/` prefix,
 * e.g. `.claude/skills/…` or `skills/foo/`) for directories; targets outside `.agentsmesh/` use
 * project-root-relative paths. **Global** scope uses the same rules when the destination is under
 * `.agentsmesh/`; generated tool outputs keep project-root-style prose links unless the caller
 * forces destination-relative markdown links.
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

  // Import-direction symmetry: when both destination and target live inside
  // `.agentsmesh/` (the canonical mesh tree) but the original token came from
  // a target-specific path (e.g. `.claude/commands/review.md`), prefer the
  // canonical anchor form `.agentsmesh/commands/review.md`. This keeps imported
  // canonical content visually consistent with hand-authored canonical content,
  // which always references other canonical files via `.agentsmesh/...`.
  if (
    isReadingContextOptions(options) &&
    isUnderAgentsMesh(projectRoot, destinationFile) &&
    isUnderAgentsMesh(projectRoot, target)
  ) {
    const api = pathApi(projectRoot);
    const root = normalizeForProject(projectRoot, projectRoot);
    const rel = api.relative(root, target).replace(/\\/g, '/');
    if (!rel.startsWith('..') && rel.length > 0) {
      return keepSlash && !rel.endsWith('/') ? `${rel}/` : rel;
    }
  }

  if (options.forceRelative) {
    return formatLinkPathForDestinationLegacy(
      projectRoot,
      destinationFile,
      absoluteTargetPath,
      keepSlash,
      options,
    );
  }

  if (scope === 'global' && !isUnderAgentsMesh(projectRoot, destinationFile)) {
    return toProjectRootReference(projectRoot, target, keepSlash)?.text ?? null;
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
    return toProjectRootReference(projectRoot, target, keepSlash)?.text ?? null;
  }

  const treatAsDirectory = keepSlash || (options.pathIsDirectory?.(target) ?? false);
  if (treatAsDirectory) {
    const meshRelative = toAgentsMeshRootRelative(projectRoot, meshCanonicalForShape, keepSlash);
    if (meshRelative !== null) return meshRelative;
    return toProjectRootReference(projectRoot, meshCanonicalForShape, keepSlash)?.text ?? null;
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
