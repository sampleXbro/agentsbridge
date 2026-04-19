import {
  normalizeForProject,
  normalizeSeparators,
  stripTrailingPunctuation,
} from '../path-helpers.js';
import {
  PATH_TOKEN,
  LINE_NUMBER_SUFFIX,
  resolveProjectPath,
  expandResolvedPaths,
  isGlobAdjacent,
  protectedRanges,
  resolveByDestinationSuffixStrip,
} from './link-rebaser-helpers.js';
import { formatLinkPathForDestination } from './link-rebaser-output.js';

export interface RewriteFileLinksInput {
  content: string;
  projectRoot: string;
  sourceFile: string;
  destinationFile: string;
  translatePath: (absolutePath: string) => string;
  pathExists: (absolutePath: string) => boolean;
  explicitCurrentDirLinks?: boolean;
}

export interface RewriteFileLinksResult {
  content: string;
  missing: string[];
}

/**
 * PATH_TOKEN often does not include `~/`; rewriting only `.agentsmesh/…` or `/.agentsmesh/…` corrupts docs
 * into `~/../.agentsmesh/…` or eats the slash (`~.agentsmesh`). Skip when this token belongs to a
 * POSIX home-relative path (`~/…`).
 */
function isTildeHomeRelativePathToken(
  fullContent: string,
  matchOffset: number,
  matchText: string,
): boolean {
  // `~/…` then token begins at `.agentsmesh` / `.cursor` (after `~/`)
  if (
    matchOffset >= 2 &&
    fullContent[matchOffset - 2] === '~' &&
    fullContent[matchOffset - 1] === '/'
  ) {
    return true;
  }
  // `~/…` then token begins at `/` (`/.agentsmesh…`) — slash is included in match, offset is 1 after `~`
  if (matchOffset >= 1 && fullContent[matchOffset - 1] === '~' && matchText.startsWith('/')) {
    return true;
  }
  return false;
}

export function rewriteFileLinks(input: RewriteFileLinksInput): RewriteFileLinksResult {
  const missing = new Set<string>();
  const protectedRefRanges = protectedRanges(input.content);
  const content = input.content.replace(PATH_TOKEN, (match, offset, fullContent) => {
    if (protectedRefRanges.some(([start, end]) => offset >= start && offset < end)) return match;
    if (isTildeHomeRelativePathToken(fullContent, offset, match)) return match;
    if (isGlobAdjacent(fullContent, offset, offset + match.length)) return match;
    const { candidate: punctStripped, suffix } = stripTrailingPunctuation(match);
    if (!punctStripped) return match;

    const lineNumMatch = LINE_NUMBER_SUFFIX.exec(punctStripped);
    const candidate = lineNumMatch ? punctStripped.slice(0, lineNumMatch.index) : punctStripped;
    const lineNumSuffix = lineNumMatch ? lineNumMatch[0] : '';
    if (!candidate) return match;

    let translatedPath: string | null = null;
    let matchedPath = false;
    // Saved during the main loop but committed only after suffix-strip (priority 3).
    let savedFallback: string | null = null;
    for (const resolvedPath of resolveProjectPath(candidate, input.projectRoot, input.sourceFile)) {
      let existingFallback: string | null = null;
      for (const candidatePath of expandResolvedPaths(input.projectRoot, resolvedPath)) {
        const normalizedResolvedPath = normalizeForProject(input.projectRoot, candidatePath);
        const normalizedTranslatedPath = normalizeForProject(
          input.projectRoot,
          input.translatePath(normalizedResolvedPath),
        );
        const resolvedExists = input.pathExists(normalizedResolvedPath);
        const translatedExists = input.pathExists(normalizedTranslatedPath);
        if (translatedExists && normalizedTranslatedPath !== normalizedResolvedPath) {
          translatedPath = normalizedTranslatedPath;
          matchedPath = true;
          break;
        }
        if ((resolvedExists || translatedExists) && !existingFallback) {
          existingFallback = normalizedTranslatedPath;
        }
        if (!translatedPath) translatedPath = normalizedTranslatedPath;
      }
      // Save but do not commit yet — suffix-strip (priority 2) gets to run first.
      if (!matchedPath && existingFallback && !savedFallback) {
        savedFallback = existingFallback;
      }
      if (matchedPath) break;
    }
    // Priority 2: file exists in the destination file's directory tree.
    if (!matchedPath) {
      const destCandidate = resolveByDestinationSuffixStrip(
        candidate,
        input.projectRoot,
        input.destinationFile,
        input.pathExists,
      );
      if (destCandidate) {
        translatedPath = destCandidate;
        matchedPath = true;
      }
    }
    // Priority 3: a path was found (no translation needed) but no dest-tree match.
    if (!matchedPath && savedFallback) {
      translatedPath = savedFallback;
      matchedPath = true;
    }

    // Priority 4: project-root-relative `.agentsmesh/…` in canonical imports (`destinationFile`
    // under `.agentsmesh/`) should still relativize when `pathExists` is false mid-import.
    const destFwd = normalizeSeparators(input.destinationFile);
    const destInCanonicalMesh =
      destFwd.includes('/.agentsmesh/') || destFwd.startsWith('.agentsmesh/');
    if (
      !matchedPath &&
      translatedPath &&
      normalizeSeparators(punctStripped).startsWith('.agentsmesh/') &&
      destInCanonicalMesh
    ) {
      matchedPath = true;
    }

    if (!matchedPath || !translatedPath) {
      if (translatedPath) missing.add(translatedPath);
      return match;
    }

    const rewritten = formatLinkPathForDestination(
      input.projectRoot,
      input.destinationFile,
      translatedPath,
      candidate.endsWith('/'),
      { explicitCurrentDirLinks: input.explicitCurrentDirLinks },
    );
    if (!rewritten) return match;
    return `${rewritten}${lineNumSuffix}${suffix}`;
  });

  return { content, missing: [...missing] };
}
