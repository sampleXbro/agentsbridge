/**
 * Canonical `Bash(<payload>)` <-> Warp command-list regexes.
 *
 * Warp's `agent_mode_command_execution_allowlist` / `_denylist` hold REGEXES
 * (docs.warp.dev/terminal/settings/all-settings ships `ls(\s.*)?`,
 * `curl(\s.*)?`, `find .*` as defaults), so the payload is passed through
 * verbatim as a regex fragment. Regex-escaping it turned an imported
 * `rm -rf .*` into `rm \-rf \.\*`, which matches no real command — the user's
 * own deny rule came back disabled.
 *
 * Anchoring is asymmetric on purpose. Warp does not document whether the lists
 * are full-match or substring, so each list takes the more restrictive reading
 * of both:
 *   - allowlist entries are anchored (`^…$`): identical under full-match, and
 *     under substring it stops `Bash(ls)` also auto-running `curl evil | ls`.
 *   - denylist entries stay verbatim: identical under full-match, and under
 *     substring an unanchored pattern blocks strictly more.
 * Verbatim denylist entries also round-trip byte for byte.
 */

/** Suffix making a command regex also match the same command plus arguments. */
const ARGS_SUFFIX = '(\\s.*)?';

const REGEX_METACHARACTERS = /[\\^$.*+?()[\]{}|]/;

export type WarpCommandList = 'allow' | 'deny';

function isValidRegex(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

/** `Bash(git status:*)` -> `git status(\s.*)?`; `Bash(ls)` -> `ls`. */
function commandBody(pattern: string): string | null {
  const match = /^Bash\((.*)\)$/s.exec(pattern.trim());
  if (!match) return null;
  const raw = match[1]!.trim();
  const prefixOnly = raw.endsWith(':*');
  const command = (prefixOnly ? raw.slice(0, -2) : raw).trim();
  if (!command) return null;
  return prefixOnly ? `${command}${ARGS_SUFFIX}` : command;
}

/** Canonical pattern -> Warp regex; `null` when it is not a command or not a valid regex. */
export function commandRegex(pattern: string, list: WarpCommandList): string | null {
  const body = commandBody(pattern);
  if (body === null) return null;
  const regex = list === 'allow' ? `^${body}$` : body;
  return isValidRegex(regex) ? regex : null;
}

/** Drop the anchors `commandRegex` adds; leave anything else alone. */
function stripAnchors(regex: string): string {
  if (!regex.startsWith('^') || !regex.endsWith('$') || regex.endsWith('\\$')) return regex;
  return regex.slice(1, -1);
}

/** Warp regex -> canonical pattern; `null` when no command body survives. */
export function commandPattern(regex: string, list: WarpCommandList): string | null {
  const body = list === 'allow' ? stripAnchors(regex.trim()) : regex.trim();
  if (!body) return null;
  const pattern = body.endsWith(ARGS_SUFFIX)
    ? `Bash(${body.slice(0, -ARGS_SUFFIX.length)}:*)`
    : `Bash(${body})`;
  return commandBody(pattern) === null ? null : pattern;
}

/** True when Warp reads the payload as a pattern instead of a literal command. */
export function isRegexPayload(pattern: string): boolean {
  const body = commandBody(pattern);
  if (body === null) return false;
  const literal = body.endsWith(ARGS_SUFFIX) ? body.slice(0, -ARGS_SUFFIX.length) : body;
  return REGEX_METACHARACTERS.test(literal);
}
