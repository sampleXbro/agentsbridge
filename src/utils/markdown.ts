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
