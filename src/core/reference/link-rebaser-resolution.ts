import { normalizeForProject, normalizeSeparators } from '../path-helpers.js';
import { expandResolvedPaths, resolveProjectPath } from './link-rebaser-helpers.js';
import { resolveByDestinationSuffixStrip } from './link-rebaser-suffix-strip.js';

export interface ResolveLinkTargetInput {
  candidate: string;
  rawToken: string;
  projectRoot: string;
  sourceFile: string;
  destinationFile: string;
  translatePath: (absolutePath: string) => string;
  pathExists: (absolutePath: string) => boolean;
}

export interface ResolvedLinkTarget {
  translatedPath: string | null;
  resolvedBeforeTranslate: string | null;
  matchedPath: boolean;
}

export function resolveLinkTarget(input: ResolveLinkTargetInput): ResolvedLinkTarget {
  let translatedPath: string | null = null;
  let matchedPath = false;
  let resolvedBeforeTranslate: string | null = null;
  let savedFallback: string | null = null;
  let savedFallbackResolvedBeforeTranslate: string | null = null;

  for (const resolvedPath of resolveProjectPath(
    input.candidate,
    input.projectRoot,
    input.sourceFile,
  )) {
    let existingFallback: string | null = null;
    let existingFallbackResolvedBeforeTranslate: string | null = null;
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
        resolvedBeforeTranslate = normalizedResolvedPath;
        matchedPath = true;
        break;
      }
      if ((resolvedExists || translatedExists) && existingFallback === null) {
        existingFallback = normalizedTranslatedPath;
        existingFallbackResolvedBeforeTranslate = normalizedResolvedPath;
      }
      if (translatedPath === null) translatedPath = normalizedTranslatedPath;
    }
    // Save but do not commit yet: suffix-strip has higher priority.
    if (!matchedPath && existingFallback !== null && savedFallback === null) {
      savedFallback = existingFallback;
      savedFallbackResolvedBeforeTranslate = existingFallbackResolvedBeforeTranslate;
    }
    if (matchedPath) break;
  }

  if (!matchedPath) {
    const destCandidate = resolveByDestinationSuffixStrip(
      input.candidate,
      input.projectRoot,
      input.destinationFile,
      input.pathExists,
    );
    if (destCandidate !== null) {
      translatedPath = destCandidate;
      matchedPath = true;
    }
  }

  if (!matchedPath && savedFallback !== null) {
    translatedPath = savedFallback;
    if (savedFallbackResolvedBeforeTranslate !== null) {
      resolvedBeforeTranslate = savedFallbackResolvedBeforeTranslate;
    }
    matchedPath = true;
  }

  const destFwd = normalizeSeparators(input.destinationFile);
  const destInCanonicalMesh =
    destFwd.includes('/.agentsmesh/') || destFwd.startsWith('.agentsmesh/');
  if (
    !matchedPath &&
    translatedPath !== null &&
    normalizeSeparators(input.rawToken).startsWith('.agentsmesh/') &&
    destInCanonicalMesh
  ) {
    matchedPath = true;
  }

  return { translatedPath, resolvedBeforeTranslate, matchedPath };
}
