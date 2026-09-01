/**
 * Canonical permission entry <-> Zed tool name + Rust regex.
 *
 * `docs/src/ai/tool-permissions.md` lists the tools that take patterns and what
 * each pattern is matched against: `terminal` sees the shell command string, the
 * file tools see the path, `fetch` the URL, `search_web` the query. Canonical
 * payloads are literals (commands) or globs (paths), never regexes, so they are
 * escaped and anchored — passing them through would turn `Bash(node -e "a.b()")`
 * into a pattern that matches almost nothing.
 *
 * Zed's table has no read tool, so canonical `Read`/`Read(...)` has no home here
 * and `toZedRule` returns null; `lintPermissions` names every such entry.
 */

const CANONICAL_TO_ZED_TOOL: Readonly<Record<string, string>> = {
  Bash: 'terminal',
  Edit: 'edit_file',
  Write: 'write_file',
  WebFetch: 'fetch',
  WebSearch: 'search_web',
};

/** Tool keys agentsmesh writes, and therefore rewrites on every emit. */
export const ZED_OWNED_TOOL_KEYS: readonly string[] = Object.values(CANONICAL_TO_ZED_TOOL);

const ZED_TO_CANONICAL_TOOL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CANONICAL_TO_ZED_TOOL).map(([canonical, zed]) => [zed, canonical]),
);

/** Suffix letting a command regex also match the same command plus arguments. */
const ARGS_SUFFIX = '(\\s.*)?';

export interface ZedPermissionRule {
  /** Zed tool key, e.g. `terminal`. */
  readonly tool: string;
  /** Anchored Rust regex, or `null` for a bare tool-level default. */
  readonly regex: string | null;
}

function escapeRegex(literal: string): string {
  return literal.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

/** Glob payload -> regex body. `**` crosses separators, `*`/`?` do not. */
function globToRegexBody(glob: string): string {
  let body = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === '*') {
      if (glob[i + 1] === '*') {
        body += '.*';
        i++;
      } else {
        body += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      body += '[^/]';
      continue;
    }
    body += escapeRegex(char);
  }
  return body;
}

/** Inverse of `globToRegexBody`; also un-escapes a plain literal body. */
function regexBodyToGlob(body: string): string {
  let glob = '';
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('.*', i)) {
      glob += '**';
      i += 1;
      continue;
    }
    if (body.startsWith('[^/]*', i)) {
      glob += '*';
      i += 4;
      continue;
    }
    if (body.startsWith('[^/]', i)) {
      glob += '?';
      i += 3;
      continue;
    }
    if (body[i] === '\\' && i + 1 < body.length) {
      glob += body[i + 1];
      i += 1;
      continue;
    }
    glob += body[i];
  }
  return glob;
}

/** Splits `Tool(payload)` / `Tool`; the payload capture is greedy for nested parens. */
function splitPattern(pattern: string): { name: string; payload: string | null } | null {
  const trimmed = pattern.trim();
  const withPayload = /^([A-Za-z][A-Za-z0-9_]*)\((.*)\)$/s.exec(trimmed);
  if (withPayload) return { name: withPayload[1]!, payload: withPayload[2]! };
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed) ? { name: trimmed, payload: null } : null;
}

/** Canonical entry -> Zed rule, or `null` when Zed has no surface for it. */
export function toZedRule(pattern: string): ZedPermissionRule | null {
  const split = splitPattern(pattern);
  if (!split) return null;
  const tool = CANONICAL_TO_ZED_TOOL[split.name];
  if (tool === undefined) return null;
  if (split.payload === null) return { tool, regex: null };

  const payload = split.payload.trim();
  if (payload === '') return null;

  if (tool === 'terminal') {
    const prefixOnly = payload.endsWith(':*');
    const command = (prefixOnly ? payload.slice(0, -2) : payload).trim();
    if (command === '') return null;
    return { tool, regex: `^${escapeRegex(command)}${prefixOnly ? ARGS_SUFFIX : ''}$` };
  }
  return { tool, regex: `^${globToRegexBody(payload)}$` };
}

function decodeRule(tool: string, name: string, regex: string): string | null {
  const trimmed = regex.trim();
  if (!trimmed.startsWith('^') || !trimmed.endsWith('$') || trimmed.endsWith('\\$')) return null;
  let body = trimmed.slice(1, -1);
  if (body === '') return null;

  if (tool === 'terminal') {
    const prefixOnly = body.endsWith(ARGS_SUFFIX);
    if (prefixOnly) body = body.slice(0, -ARGS_SUFFIX.length);
    const command = regexBodyToGlob(body);
    return command === '' ? null : `${name}(${command}${prefixOnly ? ':*' : ''})`;
  }
  const glob = regexBodyToGlob(body);
  return glob === '' ? null : `${name}(${glob})`;
}

/**
 * Zed rule -> canonical entry, or `null` when it is not a shape agentsmesh writes.
 *
 * The re-encode check is the whole safety net for hand-written rules. Zed stores
 * Rust regexes; canonical stores literals. Decoding `^cargo\s+(build|test)$` would
 * yield the nonsense literal `cargo s+(build|test)`, and the next generate would
 * escape it into a pattern matching nothing — the user's own rule, silently
 * disabled. Only regexes that re-encode byte for byte are imported; anything else
 * stays in `settings.json` untouched.
 */
export function fromZedRule(tool: string, regex: string | null): string | null {
  const name = ZED_TO_CANONICAL_TOOL[tool];
  if (name === undefined) return null;
  if (regex === null) return name;

  const pattern = decodeRule(tool, name, regex);
  if (pattern === null) return null;
  const reencoded = toZedRule(pattern);
  return reencoded?.tool === tool && reencoded.regex === regex.trim() ? pattern : null;
}
