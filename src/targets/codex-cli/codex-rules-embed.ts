/**
 * Legacy embedded advisory payload inside `.rules` (import-only).
 * Current generator emits advisory rules as nested `AGENTS.md` per codex-cli-project-level-advanced.md.
 * @see https://developers.openai.com/codex/rules/
 */

import { Buffer } from 'node:buffer';

const MARKER = 'am-codex-rule:v1';
const JSON_PREFIX = '# am-json: ';
const B64_BEGIN = '# am-body-b64-begin';
const B64_END = '# am-body-b64-end';
const B64_LINE = '# am64:';

export interface EmbeddedCodexRuleMeta {
  description: string;
  globs: string[];
}

/** @deprecated Generator no longer emits this; kept so older repos still import. */
export function serializeCanonicalRuleToCodexRulesFile(rule: {
  description: string;
  globs: string[];
  body: string;
}): string {
  const meta: EmbeddedCodexRuleMeta = {
    description: rule.description ?? '',
    globs: rule.globs ?? [],
  };
  const metaJson = JSON.stringify(meta);
  const b64 = Buffer.from(rule.body.trim(), 'utf8').toString('base64');
  const lines: string[] = [
    `# ${MARKER}`,
    `${JSON_PREFIX}${metaJson}`,
    '#',
    '# Embedded canonical rule (agentsmesh) — base64 body between am-body-b64 markers.',
    '# Add active Starlark prefix_rule() calls below (uncomment/edit). Docs:',
    '# https://developers.openai.com/codex/rules/',
    '#',
    B64_BEGIN,
  ];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(`${B64_LINE}${b64.slice(i, i + 76)}`);
  }
  lines.push(B64_END);
  lines.push('');
  lines.push('# Example prefix_rule (from Codex documentation; commented — not active):');
  lines.push('# prefix_rule(');
  lines.push('#     pattern = ["gh", "pr", "view"],');
  lines.push('#     decision = "prompt",');
  lines.push('#     justification = "Viewing PRs is allowed with approval",');
  lines.push('# )');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/** If this is an agentsmesh-generated `.rules` file, return meta + body; else null. */
export function tryParseEmbeddedCanonicalFromCodexRules(content: string): {
  meta: EmbeddedCodexRuleMeta;
  body: string;
} | null {
  if (!content.includes(MARKER)) return null;
  const jsonLine = content.split('\n').find((l) => l.startsWith(JSON_PREFIX));
  if (!jsonLine) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLine.slice(JSON_PREFIX.length)) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  const description = typeof rec.description === 'string' ? rec.description : '';
  const globs = Array.isArray(rec.globs)
    ? rec.globs.filter((g): g is string => typeof g === 'string')
    : [];
  const chunks: string[] = [];
  let inB64 = false;
  for (const line of content.split('\n')) {
    const t = line.trimEnd();
    if (t === B64_BEGIN) {
      inB64 = true;
      continue;
    }
    if (t === B64_END) {
      inB64 = false;
      continue;
    }
    if (inB64 && t.startsWith(B64_LINE)) {
      chunks.push(t.slice(B64_LINE.length));
    }
  }
  if (chunks.length === 0) return null;
  try {
    const body = Buffer.from(chunks.join(''), 'base64').toString('utf8');
    return { meta: { description, globs }, body };
  } catch {
    return null;
  }
}
