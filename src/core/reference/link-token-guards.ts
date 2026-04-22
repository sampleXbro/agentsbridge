import { WINDOWS_ABSOLUTE_PATH, normalizeSeparators } from '../path-helpers.js';
import { isRootRelativePathToken } from './link-rebaser-helpers.js';

export function isTildeHomeRelativePathToken(
  fullContent: string,
  matchOffset: number,
  matchText: string,
): boolean {
  if (
    matchOffset >= 2 &&
    fullContent[matchOffset - 2] === '~' &&
    fullContent[matchOffset - 1] === '/'
  ) {
    return true;
  }
  return matchOffset >= 1 && fullContent[matchOffset - 1] === '~' && matchText.startsWith('/');
}

export function isMarkdownLinkDestinationToken(
  fullContent: string,
  matchOffset: number,
  matchText: string,
): boolean {
  if (matchOffset <= 0 || fullContent[matchOffset - 1] !== '(') return false;
  const closeIndex = matchOffset + matchText.length;
  const after = fullContent[closeIndex];
  if (after !== ')' && after !== '#' && after !== '?' && after !== ' ' && after !== '\t') {
    return false;
  }
  return fullContent[matchOffset - 2] === ']';
}

export function isRelativePathToken(token: string): boolean {
  const normalizedToken = normalizeSeparators(token);
  if (normalizedToken.startsWith('./') || normalizedToken.startsWith('../')) return true;
  if (normalizedToken.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(normalizedToken)) return false;
  if (isRootRelativePathToken(normalizedToken)) return false;
  return normalizedToken.includes('/');
}
