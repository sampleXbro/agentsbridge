// Frontmatter parsing

import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

/**
 * Parse YAML frontmatter and body from markdown/MDC content.
 * @param content - Raw content with optional --- delimited frontmatter
 * @returns Parsed frontmatter object and trimmed body
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const open = content.indexOf('---');
  if (open !== 0) {
    return { frontmatter: {}, body: content.trim() };
  }
  const close = content.indexOf('---', 3);
  if (close === -1) {
    return { frontmatter: {}, body: content.trim() };
  }
  const yamlStr = content.slice(3, close).trim();
  const body = content.slice(close + 3).trim();
  const frontmatter = yamlStr === '' ? {} : ((yamlParse(yamlStr) as Record<string, unknown>) ?? {});
  return { frontmatter, body };
}

export type FrontmatterParseResult =
  | { ok: true; value: ReturnType<typeof parseFrontmatter> }
  | { ok: false; error: Error; bodyFallback: string };

/**
 * Split frontmatter block from body without parsing the YAML. Used by the
 * lenient path so a YAML-parse failure can still return a clean body.
 */
function extractBody(content: string): string {
  if (content.indexOf('---') !== 0) return content.trim();
  const close = content.indexOf('---', 3);
  if (close === -1) return content.trim();
  return content.slice(close + 3).trim();
}

/**
 * Lenient frontmatter parser. Returns a result object instead of throwing.
 * On failure, `bodyFallback` carries the markdown body after the closing `---`
 * so callers can still proceed with body-only content if they choose.
 */
export function tryParseFrontmatter(content: string, filePath: string): FrontmatterParseResult {
  try {
    return { ok: true, value: parseFrontmatter(content) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(`Failed to parse frontmatter in ${filePath}: ${message}`, {
      cause: err,
    });
    return { ok: false, error: wrapped, bodyFallback: extractBody(content) };
  }
}

/**
 * Parse frontmatter for a file, attributing errors to the path.
 *
 * Default (no `onError`): throws on YAML parse failure — the strict mode used
 * by `generate`/`lint`/`check` for user-authored canonical content.
 *
 * With `onError`: swallows the parse error, invokes the callback, and returns
 * an empty-frontmatter result so the caller can continue with the body. Used
 * by the install path to skip individual broken third-party files instead of
 * aborting the whole run.
 */
export function parseFrontmatterForPath(
  content: string,
  filePath: string,
  onError?: (err: Error, filePath: string) => void,
): ReturnType<typeof parseFrontmatter> {
  const result = tryParseFrontmatter(content, filePath);
  if (result.ok) return result.value;
  if (onError) {
    onError(result.error, filePath);
    return { frontmatter: {}, body: result.bodyFallback };
  }
  throw result.error;
}

/**
 * Parse-or-skip helper shared by every canonical entity parser. Centralises
 * the install-vs-strict branching so the parsers stay declarative.
 *
 * - Strict (no `onParseError`): re-throws the wrapped error verbatim, matching
 *   the long-standing `parseFrontmatterForPath` contract.
 * - Lenient (`onParseError` provided): invokes the callback and returns
 *   `null`, signalling to the caller that this file should be skipped.
 */
export function parseOrSkipFrontmatter(
  content: string,
  filePath: string,
  onParseError: ((err: Error, filePath: string) => void) | undefined,
): ReturnType<typeof parseFrontmatter> | null {
  const result = tryParseFrontmatter(content, filePath);
  if (result.ok) return result.value;
  if (onParseError) {
    onParseError(result.error, filePath);
    return null;
  }
  throw result.error;
}

/**
 * Serialize frontmatter and body back to string.
 * @param frontmatter - Key-value pairs for YAML
 * @param body - Markdown body content
 * @returns Full content with --- delimiters when frontmatter has keys
 */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) return body;
  const yamlStr = yamlStringify(frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${yamlStr}\n---\n\n${body}`;
}
