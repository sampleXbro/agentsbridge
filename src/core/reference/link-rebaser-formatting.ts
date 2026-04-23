import { dirname } from 'node:path';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import {
  WINDOWS_ABSOLUTE_PATH,
  normalizeForProject,
  normalizeSeparators,
  pathApi,
} from '../path-helpers.js';
import type { RewrittenLink, TokenContext } from './link-output-kinds.js';

export interface FormatLinkPathOptions {
  explicitCurrentDirLinks?: boolean;
  scope?: TargetLayoutScope;
  pathIsDirectory?: (absolutePath: string) => boolean;
  forceRelative?: boolean;
  tokenContext?: TokenContext;
  originalToken?: string;
  logicalMeshSourceAbsolute?: string | null;
}

function isReadingContext(context: TokenContext | undefined): boolean {
  return (
    context === undefined ||
    context.role === 'inline-code' ||
    context.role === 'bracketed' ||
    context.role === 'quoted' ||
    context.role === 'at-prefix' ||
    context.role === 'bracket-label' ||
    context.role === 'bare-prose'
  );
}

export function isUnderProjectRoot(projectRoot: string, absolutePath: string): boolean {
  const api = pathApi(projectRoot);
  const root = normalizeForProject(projectRoot, projectRoot);
  const cand = normalizeForProject(projectRoot, absolutePath);
  if (cand === root) return true;
  const prefix = root.endsWith(api.sep) ? root : `${root}${api.sep}`;
  return cand.startsWith(prefix);
}

function agentsMeshRoot(projectRoot: string): string {
  const api = pathApi(projectRoot);
  return normalizeForProject(projectRoot, api.join(projectRoot, '.agentsmesh'));
}

export function isUnderAgentsMesh(projectRoot: string, absolutePath: string): boolean {
  const api = pathApi(projectRoot);
  const meshRoot = agentsMeshRoot(projectRoot);
  const cand = normalizeForProject(projectRoot, absolutePath);
  if (cand === meshRoot) return true;
  const prefix = meshRoot.endsWith(api.sep) ? meshRoot : `${meshRoot}${api.sep}`;
  return cand.startsWith(prefix);
}

export function toAgentsMeshRootRelative(
  projectRoot: string,
  absolutePathUnderMesh: string,
  keepSlash: boolean,
): string | null {
  const api = pathApi(projectRoot);
  const meshRoot = agentsMeshRoot(projectRoot);
  const cand = normalizeForProject(projectRoot, absolutePathUnderMesh);
  if (!isUnderAgentsMesh(projectRoot, cand)) return null;
  const relPath = api.relative(meshRoot, cand).replace(/\\/g, '/');
  if (relPath.startsWith('..') || relPath.length === 0) return null;
  return keepSlash && !relPath.endsWith('/') ? `${relPath}/` : relPath;
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

export function shouldPreserveAgentsMeshAnchor(
  _projectRoot: string,
  _destinationFile: string,
  options: FormatLinkPathOptions,
): boolean {
  if (!isReadingContext(options.tokenContext)) return false;
  if (options.originalToken === undefined) return false;
  return normalizeSeparators(options.originalToken).startsWith('.agentsmesh/');
}

export function toProjectRootReference(
  projectRoot: string,
  absolutePath: string,
  keepSlash: boolean,
): RewrittenLink | null {
  const formatted = toProjectRootRelative(projectRoot, absolutePath, keepSlash);
  if (formatted === null) return null;
  return { kind: 'projectRoot', rest: formatted, text: formatted };
}

export function formatLinkPathForDestinationLegacy(
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
    return toProjectRootReference(projectRoot, target, keepSlash)?.text ?? null;
  }
  const destDir = normalizeForProject(projectRoot, dirname(destFile));
  if (!isUnderProjectRoot(projectRoot, destDir) && destDir !== root) {
    return toProjectRootReference(projectRoot, target, keepSlash)?.text ?? null;
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
