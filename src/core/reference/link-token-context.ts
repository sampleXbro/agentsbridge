import { normalizeSeparators, stripTrailingPunctuation } from '../path-helpers.js';
import { LINE_NUMBER_SUFFIX, isRootRelativePathToken } from './link-rebaser-helpers.js';

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
  const before = fullContent[start - 1];
  const after = fullContent[end];
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
