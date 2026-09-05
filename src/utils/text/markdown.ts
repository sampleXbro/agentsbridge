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
  const split = splitFrontmatter(content);
  if (split === null) return { frontmatter: {}, body: content.trim() };
  const yamlStr = split.yaml.trim();
  const frontmatter = yamlStr === '' ? {} : ((yamlParse(yamlStr) as Record<string, unknown>) ?? {});
  return { frontmatter, body: split.body };
}

const OPENER = /^---[ \t]*\r?\n/;
const CLOSER = /^---[ \t]*\r?$/m;

export interface FrontmatterSplit {
  /** Raw YAML between the delimiters (may be empty). */
  yaml: string;
  /** Trimmed content after the closing delimiter line. */
  body: string;
  /** Byte-exact `---…---` block, for callers that re-emit it verbatim. */
  prefix: string;
}

/**
 * Locate a leading frontmatter block. Both delimiters must be lines of their
 * own: a `---` inside a value (`description: a --- b`) is content, not a close.
 * Returns null when there is no complete block.
 */
export function splitFrontmatter(content: string): FrontmatterSplit | null {
  const opener = OPENER.exec(content);
  if (opener === null) return null;
  const yamlStart = opener[0].length;
  const closer = CLOSER.exec(content.slice(yamlStart));
  if (closer === null) return null;
  const closeStart = yamlStart + closer.index;
  const closeEnd = closeStart + closer[0].length;
  return {
    yaml: content.slice(yamlStart, closeStart),
    body: content.slice(closeEnd).trim(),
    prefix: content.slice(0, closeEnd),
  };
}

export type FrontmatterParseResult =
  | { ok: true; value: ReturnType<typeof parseFrontmatter> }
  | { ok: false; error: Error; bodyFallback: string };

/**
 * Split frontmatter block from body without parsing the YAML. Used by the
 * lenient path so a YAML-parse failure can still return a clean body.
 */
function extractBody(content: string): string {
  return splitFrontmatter(content)?.body ?? content.trim();
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
