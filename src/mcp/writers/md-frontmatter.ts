import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const FRONT_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n\r?\n?([\s\S]*)$/;

export function parseMd(src: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = FRONT_RE.exec(src);
  if (!m) return { frontmatter: {}, body: src };
  // Regex groups 1 and 2 are non-optional captures, so on match they're
  // always strings. `parseYaml('')` returns undefined → fall back to {}.
  const [, fmRaw, body] = m as RegExpExecArray & [string, string, string];
  return {
    frontmatter: (parseYaml(fmRaw) ?? {}) as Record<string, unknown>,
    body,
  };
}

export function serializeMd(frontmatter: Record<string, unknown>, body: string): string {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = stringifyYaml(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n\n${body}`;
}
