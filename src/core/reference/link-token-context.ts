import { normalizeSeparators, stripTrailingPunctuation } from '../path-helpers.js';
import { LINE_NUMBER_SUFFIX, isRootRelativePathToken } from './link-rebaser-helpers.js';
import type { TokenContext } from './link-output-kinds.js';

function markdownBracketLabelDuplicatesDestination(
  fullContent: string,
  labelPathStart: number,
  labelPathText: string,
): boolean {
  const closeBracket = labelPathStart + labelPathText.length;
  if (fullContent[closeBracket] !== ']') return false;
  if (fullContent[closeBracket + 1] !== '(') return false;
  let j = closeBracket + 2;
  let dest = '';
  while (j < fullContent.length) {
    const c = fullContent[j];
    if (c === ')' || c === '#' || c === '?' || c === ' ' || c === '\t' || c === '\n') break;
    dest += c;
    j++;
  }
  return dest === labelPathText;
}

function isMarkdownReferenceDefinitionDestination(
  fullContent: string,
  start: number,
  end: number,
): boolean {
  const lineStart = fullContent.lastIndexOf('\n', start - 1) + 1;
  const prefix = fullContent.slice(lineStart, start);
  if (!/^\s*\[[^\]\n]+\]:\s*<?\s*$/.test(prefix)) return false;
  const after = end < fullContent.length ? fullContent[end] : '';
  return (
    after === '' ||
    after === '\n' ||
    after === '\r' ||
    after === '>' ||
    after === ' ' ||
    after === '\t' ||
    after === '"' ||
    after === "'" ||
    after === ':' ||
    after === '#' ||
    after === '?'
  );
}

/**
 * Returns the syntactic role of the token at [start, end) within `fullContent`.
 * Used to select the appropriate formatting strategy in `formatLinkPathForDestination`.
 */
export function getTokenContext(fullContent: string, start: number, end: number): TokenContext {
  const before = start > 0 ? fullContent[start - 1] : '';
  const after = end < fullContent.length ? fullContent[end] : '';
  if (before === '`' && after === '`') return { role: 'inline-code' };
  if (isMarkdownReferenceDefinitionDestination(fullContent, start, end)) {
    return { role: 'markdown-link-dest' };
  }
  if (before === '<' && after === '>') return { role: 'bracketed' };
  if ((before === "'" && after === "'") || (before === '"' && after === '"')) {
    return { role: 'quoted' };
  }
  if (before === '@') return { role: 'at-prefix' };
  if (before === '(' && fullContent[start - 2] === ']') return { role: 'markdown-link-dest' };
  if (before === '[' && after === ']') return { role: 'bracket-label' };
  return { role: 'bare-prose' };
}

/**
 * Only relativize path tokens that are unambiguous link/string references.
 * Bare path-like tokens are opt-in for generate/import round-trip rewrites.
 */
export function shouldRewritePathToken(
  fullContent: string,
  start: number,
  end: number,
  matchText: string,
  rewriteBarePathTokens: boolean,
): boolean {
  if (start < 0 || end > fullContent.length) return false;
  const { candidate: punctStripped } = stripTrailingPunctuation(matchText);
  const candidate = punctStripped.replace(LINE_NUMBER_SUFFIX, '');
  const normalizedCandidate = normalizeSeparators(candidate);
  const candidateEnd = start + candidate.length;
  const before = fullContent[start - 1];
  const after = fullContent[end];
  if (isMarkdownReferenceDefinitionDestination(fullContent, start, candidateEnd)) return true;
  if (
    (before === "'" && after === "'") ||
    (before === '"' && after === '"') ||
    (before === '`' && after === '`')
  ) {
    return true;
  }
  if (before === '<' && after === '>') return true;
  if (before === '[' && after === ']') {
    if (
      !rewriteBarePathTokens &&
      !isRootRelativePathToken(normalizedCandidate) &&
      markdownBracketLabelDuplicatesDestination(fullContent, start, matchText)
    ) {
      return false;
    }
    return true;
  }
  if (before === '@') return true;
  if (before === '(') {
    return after === ')' || after === '#' || after === '?' || after === ' ' || after === '\t';
  }
  if (!rewriteBarePathTokens) return false;
  if (isRootRelativePathToken(normalizedCandidate)) return true;
  if (normalizedCandidate.includes('/') || normalizedCandidate.includes('\\')) {
    if (normalizedCandidate.startsWith('./') || normalizedCandidate.startsWith('../')) return true;
    const segments = normalizedCandidate.split(/[\\/]/).filter(Boolean);
    const lastSegment = segments.at(-1) ?? '';
    return lastSegment.includes('.');
  }
  return false;
}
