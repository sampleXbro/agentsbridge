import { pathApi, normalizeForProject, stripTrailingPunctuation } from './path-helpers.js';
import {
  PATH_TOKEN,
  LINE_NUMBER_SUFFIX,
  resolveProjectPath,
  expandResolvedPaths,
  isGlobAdjacent,
  protectedRanges,
} from './link-rebaser-helpers.js';

export interface RewriteFileLinksInput {
  content: string;
  projectRoot: string;
  sourceFile: string;
  destinationFile: string;
  translatePath: (absolutePath: string) => string;
  pathExists: (absolutePath: string) => boolean;
}

export interface RewriteFileLinksResult {
  content: string;
  missing: string[];
}

function toProjectRootPath(
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

export function rewriteFileLinks(input: RewriteFileLinksInput): RewriteFileLinksResult {
  const missing = new Set<string>();
  const protectedRefRanges = protectedRanges(input.content);
  const content = input.content.replace(PATH_TOKEN, (match, offset, fullContent) => {
    if (protectedRefRanges.some(([start, end]) => offset >= start && offset < end)) return match;
    if (isGlobAdjacent(fullContent, offset, offset + match.length)) return match;
    const { candidate: punctStripped, suffix } = stripTrailingPunctuation(match);
    if (!punctStripped) return match;

    const lineNumMatch = LINE_NUMBER_SUFFIX.exec(punctStripped);
    const candidate = lineNumMatch ? punctStripped.slice(0, lineNumMatch.index) : punctStripped;
    const lineNumSuffix = lineNumMatch ? lineNumMatch[0] : '';
    if (!candidate) return match;

    let translatedPath: string | null = null;
    let matchedPath = false;
    for (const resolvedPath of resolveProjectPath(candidate, input.projectRoot, input.sourceFile)) {
      for (const candidatePath of expandResolvedPaths(input.projectRoot, resolvedPath)) {
        const normalizedResolvedPath = normalizeForProject(input.projectRoot, candidatePath);
        const normalizedTranslatedPath = normalizeForProject(
          input.projectRoot,
          input.translatePath(normalizedResolvedPath),
        );
        if (
          input.pathExists(normalizedResolvedPath) ||
          input.pathExists(normalizedTranslatedPath)
        ) {
          translatedPath = normalizedTranslatedPath;
          matchedPath = true;
          break;
        }
        if (!translatedPath) translatedPath = normalizedTranslatedPath;
      }
      if (matchedPath) break;
    }
    if (!matchedPath || !translatedPath) {
      if (translatedPath) missing.add(translatedPath);
      return match;
    }

    const rewritten = toProjectRootPath(input.projectRoot, translatedPath, candidate.endsWith('/'));
    if (!rewritten) return match;
    return `${rewritten}${lineNumSuffix}${suffix}`;
  });

  return { content, missing: [...missing] };
}
