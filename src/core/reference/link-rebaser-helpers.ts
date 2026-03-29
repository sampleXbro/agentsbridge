import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, win32 } from 'node:path';
import {
  WINDOWS_ABSOLUTE_PATH,
  pathApi,
  normalizeSeparators,
  normalizeForProject,
  isAbsoluteForProject,
  rootFallbackPath,
} from '../path-helpers.js';

const ROOT_RELATIVE_PREFIXES = [
  '.agentsmesh/',
  '.claude/',
  '.cursor/',
  '.github/',
  '.continue/',
  '.junie/',
  '.gemini/',
  '.clinerules/',
  '.cline/',
  '.agents/',
  '.windsurf/',
  '.roo/',
];
const NON_REWRITABLE_BARE_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'codex.md',
  '.windsurfrules',
  '.cursorrules',
]);
const EXTERNAL_REF_PATTERNS = [
  /\b[A-Za-z][A-Za-z0-9+.-]+:[^\s<>()\]]+/g,
  /\b[\w.-]+@[\w.-]+:[^\s<>()\]]+/g,
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
  /\/\/[A-Za-z0-9][\w.-]*\.[A-Za-z]{2,}[^\s<>()\]]*/g,
];
const FENCED_CODE_BLOCK = /^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)/gm;

export const PATH_TOKEN =
  /(?:\.\.[\\/]|\.\/|\.\\|\/[A-Za-z0-9._-]|[A-Za-z]:[\\/][A-Za-z0-9._-]|\.agentsmesh[\\/]|\.claude[\\/]|\.cursor[\\/]|\.github[\\/]|\.continue[\\/]|\.junie[\\/]|\.gemini[\\/]|\.clinerules[\\/]|\.cline[\\/]|\.agents[\\/]|\.windsurf[\\/]|\.roo[\\/]|(?:[A-Za-z0-9._-]+[\\/])+|[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+)[A-Za-z0-9._@%+~:\\/-]*/g;
export const LINE_NUMBER_SUFFIX = /(?::(\d+)){1,2}$/;

export function resolveProjectPath(
  token: string,
  projectRoot: string,
  sourceFile: string,
): string[] {
  const api = pathApi(projectRoot);
  const normalizedProjectRoot = normalizeForProject(projectRoot, projectRoot);
  const normalizedSourceFile = normalizeForProject(projectRoot, sourceFile);
  const normalizedToken = normalizeSeparators(token);

  if (WINDOWS_ABSOLUTE_PATH.test(token)) {
    const windowsToken = normalizeForProject(projectRoot, token);
    if (api === win32 || windowsToken.startsWith(`${normalizedProjectRoot}${api.sep}`)) {
      return [windowsToken];
    }
    return [windowsToken];
  }
  if (isAbsolute(token)) {
    const absoluteToken = normalizeForProject(projectRoot, token);
    if (absoluteToken.startsWith(normalizedProjectRoot) || existsSync(token))
      return [absoluteToken];
    return [normalizeForProject(projectRoot, api.join(projectRoot, token))];
  }
  if (normalizedToken.startsWith('./') || normalizedToken.startsWith('../')) {
    const sourceRelativePath = normalizeForProject(
      projectRoot,
      api.join(api.dirname(normalizedSourceFile), normalizedToken),
    );
    const fallbackPath = rootFallbackPath(normalizedToken, normalizedProjectRoot);
    const relativeToRoot = api.relative(normalizedProjectRoot, sourceRelativePath);
    return relativeToRoot.startsWith('..') && fallbackPath && fallbackPath !== sourceRelativePath
      ? [sourceRelativePath, fallbackPath]
      : [sourceRelativePath];
  }
  if (ROOT_RELATIVE_PREFIXES.some((prefix) => normalizedToken.startsWith(prefix))) {
    return [normalizeForProject(projectRoot, api.join(normalizedProjectRoot, normalizedToken))];
  }
  if (normalizedToken.includes('/')) {
    return [
      normalizeForProject(projectRoot, api.join(normalizedProjectRoot, normalizedToken)),
      normalizeForProject(
        projectRoot,
        api.join(api.dirname(normalizedSourceFile), normalizedToken),
      ),
    ];
  }
  if (NON_REWRITABLE_BARE_FILES.has(normalizedToken)) return [];
  if (normalizedToken.includes('.')) {
    return [
      normalizeForProject(
        projectRoot,
        api.join(api.dirname(normalizedSourceFile), normalizedToken),
      ),
    ];
  }
  return [];
}

export function expandResolvedPaths(projectRoot: string, resolvedPath: string): string[] {
  const expanded = [resolvedPath];
  if (!isAbsoluteForProject(projectRoot, resolvedPath) || !existsSync(resolvedPath))
    return expanded;
  try {
    const realPaths = [realpathSync(resolvedPath), realpathSync.native(resolvedPath)];
    for (const realPath of realPaths) {
      if (realPath !== resolvedPath && !expanded.includes(realPath)) {
        expanded.unshift(realPath);
      }
    }
  } catch {
    // Keep the original path when realpath lookup fails.
  }
  return expanded;
}

export function isGlobAdjacent(content: string, start: number, end: number): boolean {
  const prev = start > 0 ? content.at(start - 1) : '';
  const next = end < content.length ? content.at(end) : '';
  return prev === '*' || next === '*';
}

export function protectedRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const pattern of EXTERNAL_REF_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      ranges.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
    }
  }
  for (const match of content.matchAll(FENCED_CODE_BLOCK)) {
    ranges.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
  }
  return ranges;
}
