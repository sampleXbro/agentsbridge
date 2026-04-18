/**
 * Format rewritten file paths for markdown/docs: prefer paths relative to the
 * destination file (portable across machines) when both paths stay under projectRoot.
 */

import { dirname } from 'node:path';
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
