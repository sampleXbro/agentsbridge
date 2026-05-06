import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const FRONT_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n\r?\n?([\s\S]*)$/;

export function parseMd(src: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = FRONT_RE.exec(src);
  if (!m) return { frontmatter: {}, body: src };
  return {
    frontmatter: (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>,
    body: m[2] ?? '',
  };
}

export function serializeMd(frontmatter: Record<string, unknown>, body: string): string {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = stringifyYaml(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n\n${body}`;
}
