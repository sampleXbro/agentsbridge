/**
 * Resource URI templates (`agentsmesh://skills/{name}/files/{path}`). Every
 * placeholder binds one path segment except the last, which may span nested
 * paths so skill supporting files under `references/` are reachable.
 */
const PLACEHOLDER = /\{([^}]+)\}/g;

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchResourceTemplate(
  template: string,
  actual: string,
): Record<string, string> | null {
  const keys = [...template.matchAll(PLACEHOLDER)].map((m) => m[1]!);
  const parts = template.split(/\{[^}]+\}/g);
  let source = '^';
  parts.forEach((literal, i) => {
    source += escapeRegex(literal);
    if (i < keys.length) source += i === keys.length - 1 ? '(.+)' : '([^/]+)';
  });
  const match = new RegExp(`${source}$`).exec(actual);
  if (match === null) return null;
  return Object.fromEntries(keys.map((key, i) => [key, match[i + 1]!]));
}
