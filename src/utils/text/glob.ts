// Glob pattern matching

/**
 * Expand {a,b} into alternatives and test filepath against each.
 * @param filepath - Path to test
 * @param pattern - Glob pattern (minimatch-compatible)
 * @returns true if filepath matches any alternative
 */
export function globMatch(filepath: string, pattern: string): boolean {
  const alternatives = expandBraces(pattern);
  return alternatives.some((p) => matchOne(filepath, p));
}

/**
 * Filter files by glob pattern.
 * @param files - Array of file paths
 * @param pattern - Glob pattern
 * @returns Files matching the pattern
 */
export function globFilter(files: string[], pattern: string): string[] {
  return files.filter((f) => globMatch(f, pattern));
}

function expandBraces(pattern: string): string[] {
  const match = pattern.match(/^(.+)\{([^}]+)\}(.*)$/);
  if (!match) return [pattern];
  const [, pre, inner, post] = match;
  if (!inner) return [pattern];
  const opts = inner.split(',').map((s) => s.trim());
  const result: string[] = [];
  for (const opt of opts) {
    for (const rest of expandBraces(pre + opt + post)) {
      result.push(rest);
    }
  }
  return result;
}

function matchOne(filepath: string, pattern: string): boolean {
  const re = globToRegex(pattern);
  return re.test(filepath);
}

function globToRegex(pattern: string): RegExp {
  const parts: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith('**', i)) {
      const rest = pattern.slice(i + 2);
      const alone = rest.length === 0 && parts.length === 0;
      if (alone) {
        parts.push('.*');
      } else {
        // ** matches 0+ path segments. Use (?:[^/]+/)* = "seg/" repeated (no leading /), then skip
        // the trailing / from pattern so we don't double it (src/ + seg/ + filename)
        parts.push(rest.startsWith('/') ? '(?:[^/]+/)*' : '(?:/[^/]+)*?');
        if (rest.startsWith('/')) {
          i += 3; // skip ** and the /
          continue;
        }
      }
      i += 2;
      continue;
    }
    if (pattern[i] === '*') {
      parts.push('[^/]*');
      i += 1;
      continue;
    }
    if (pattern[i] === '?') {
      parts.push('[^/]');
      i += 1;
      continue;
    }
    if (pattern[i] === '{') {
      parts.push('(?:');
      i += 1;
      continue;
    }
    if (pattern[i] === '}') {
      parts.push(')');
      i += 1;
      continue;
    }
    if (pattern[i] === ',') {
      parts.push('|');
      i += 1;
      continue;
    }
    const special = '.^$+?()[]{}|\\';
    if (special.includes(pattern[i]!)) {
      parts.push('\\' + pattern[i]);
    } else {
      parts.push(pattern[i]!);
    }
    i += 1;
  }
  const reStr = '^' + parts.join('') + '$';
  return new RegExp(reStr);
}
