import { statSync } from 'node:fs';
import type { GenerateResult } from '../types.js';
import { pathApi, normalizeForProject, stripTrailingPunctuation } from '../path-helpers.js';
import {
  LINE_NUMBER_SUFFIX,
  expandResolvedPaths,
  protectedRanges,
  resolveProjectPath,
} from './link-rebaser-helpers.js';
import { collectPlannedPaths } from './rewriter.js';

const INLINE_MD_LINK = /!?\[[^\]]*\]\(([^)]+)\)/g;
const REF_LINK_DEF = /^\s*\[[^\]\n]+\]:\s*(?:<([^>\n]*)>|(\S+))/gm;

function isMarkdownLikeOutput(relativePath: string): boolean {
  return relativePath.endsWith('.md') || relativePath.endsWith('.mdc');
}

function isOffsetInRanges(
  offset: number,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

/** Strip optional title and angle brackets from a markdown link destination. */
export function parseMarkdownLinkDestination(raw: string): string {
  let s = raw.trim();
  const withTitle = /^(.*?)\s+(["'])([\s\S]*?)\2\s*$/.exec(s);
  if (withTitle?.[1] !== undefined) s = withTitle[1].trim();
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim();
  return s;
}

function shouldSkipLocalValidation(pathPart: string): boolean {
  const t = pathPart.trim();
  if (!t) return true;
  if (t.startsWith('#')) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^mailto:/i.test(t)) return true;
  if (/^data:/i.test(t)) return true;
  if (/^javascript:/i.test(t)) return true;
  if (/^ftp:/i.test(t)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(t)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return true;
  return false;
}

function pathExistsForGenerate(absolutePath: string, planned: ReadonlySet<string>): boolean {
  if (planned.has(absolutePath)) return true;
  try {
    const st = statSync(absolutePath);
    return st.isFile() || st.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolves a markdown link target to absolute paths to check (same strategy as link rewriting).
 */
export function resolveMarkdownLinkTargets(
  rawDestination: string,
  projectRoot: string,
  destinationFileAbs: string,
): string[] {
  const parsed = parseMarkdownLinkDestination(rawDestination);
  const pathWithPossibleHash = parsed.split('#')[0] ?? '';
  const { candidate: punctStripped } = stripTrailingPunctuation(pathWithPossibleHash);
  let pathPart = punctStripped;
  const lineMatch = LINE_NUMBER_SUFFIX.exec(pathPart);
  if (lineMatch) pathPart = pathPart.slice(0, lineMatch.index);

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    decoded = pathPart;
  }

  if (shouldSkipLocalValidation(decoded)) return [];

  let candidates = resolveProjectPath(decoded, projectRoot, destinationFileAbs);
  if (candidates.length === 0) {
    const api = pathApi(projectRoot);
    const normalizedDest = normalizeForProject(projectRoot, destinationFileAbs);
    candidates = [
      normalizeForProject(projectRoot, api.join(api.dirname(normalizedDest), decoded)),
      normalizeForProject(projectRoot, api.join(projectRoot, decoded)),
    ];
  }

  const expanded: string[] = [];
  for (const c of candidates) {
    for (const e of expandResolvedPaths(projectRoot, c)) {
      const n = normalizeForProject(projectRoot, e);
      if (!expanded.includes(n)) expanded.push(n);
    }
  }
  return expanded;
}

export interface BrokenMarkdownLink {
  generatePath: string;
  target: string;
  rawLink: string;
  checkedPaths: string[];
}

export function findBrokenMarkdownLinks(
  results: GenerateResult[],
  projectRoot: string,
): BrokenMarkdownLink[] {
  const planned = collectPlannedPaths(projectRoot, results);
  const broken: BrokenMarkdownLink[] = [];

  for (const result of results) {
    if (!isMarkdownLikeOutput(result.path)) continue;
    const destinationAbs = normalizeForProject(
      projectRoot,
      pathApi(projectRoot).join(projectRoot, result.path),
    );
    const protectedR = protectedRanges(result.content);

    const visitDestination = (raw: string, matchIndex: number): void => {
      if (isOffsetInRanges(matchIndex, protectedR)) return;
      const checked = resolveMarkdownLinkTargets(raw, projectRoot, destinationAbs);
      if (checked.length === 0) return;
      if (checked.some((p) => pathExistsForGenerate(p, planned))) return;
      broken.push({
        generatePath: result.path,
        target: result.target,
        rawLink: raw.trim(),
        checkedPaths: checked,
      });
    };

    for (const match of result.content.matchAll(INLINE_MD_LINK)) {
      const inner = match[1];
      if (inner === undefined) continue;
      visitDestination(inner, match.index ?? 0);
    }

    for (const ref of result.content.matchAll(REF_LINK_DEF)) {
      const url = (ref[1] ?? ref[2] ?? '').trim();
      if (!url) continue;
      visitDestination(url, ref.index ?? 0);
    }
  }

  return broken;
}

/**
 * Ensures inline/reference markdown links in generated `.md`/`.mdc` outputs resolve to real files
 * or directories (or another path in the same generate batch). Remote URLs are ignored.
 */
export function validateGeneratedMarkdownLinks(
  results: GenerateResult[],
  projectRoot: string,
): void {
  const broken = findBrokenMarkdownLinks(results, projectRoot);
  if (broken.length === 0) return;

  const lines = broken.map(
    (b) =>
      `  ${b.generatePath} (${b.target}): "${b.rawLink}" → not found (tried: ${b.checkedPaths.join(', ')})`,
  );
  throw new Error(
    `Generated markdown contains broken local links:\n${lines.join('\n')}\n` +
      'Fix canonical sources or generators so every local link targets an existing file or folder.',
  );
}
