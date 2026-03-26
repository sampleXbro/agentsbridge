/**
 * Legacy embedded advisory payload inside `.rules` (import-only).
 * Current generator emits advisory rules as nested `AGENTS.md` per codex-cli-project-level-advanced.md.
 * @see https://developers.openai.com/codex/rules/
 */

import { Buffer } from 'node:buffer';
import {
  CODEX_RULE_EMBED_MARKER,
  CODEX_RULE_EMBED_JSON_PREFIX,
  CODEX_RULE_EMBED_B64_BEGIN,
  CODEX_RULE_EMBED_B64_END,
  CODEX_RULE_EMBED_B64_LINE,
} from './constants.js';

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
    `# ${CODEX_RULE_EMBED_MARKER}`,
    `${CODEX_RULE_EMBED_JSON_PREFIX}${metaJson}`,
    '#',
    '# Embedded canonical rule (agentsmesh) — base64 body between am-body-b64 markers.',
    '# Add active Starlark prefix_rule() calls below (uncomment/edit). Docs:',
    '# https://developers.openai.com/codex/rules/',
    '#',
    CODEX_RULE_EMBED_B64_BEGIN,
  ];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(`${CODEX_RULE_EMBED_B64_LINE}${b64.slice(i, i + 76)}`);
  }
  lines.push(CODEX_RULE_EMBED_B64_END);
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
  if (!content.includes(CODEX_RULE_EMBED_MARKER)) return null;
  const jsonLine = content.split('\n').find((l) => l.startsWith(CODEX_RULE_EMBED_JSON_PREFIX));
  if (!jsonLine) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLine.slice(CODEX_RULE_EMBED_JSON_PREFIX.length)) as unknown;
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
    if (t === CODEX_RULE_EMBED_B64_BEGIN) {
      inB64 = true;
      continue;
    }
    if (t === CODEX_RULE_EMBED_B64_END) {
      inB64 = false;
      continue;
    }
    if (inB64 && t.startsWith(CODEX_RULE_EMBED_B64_LINE)) {
      chunks.push(t.slice(CODEX_RULE_EMBED_B64_LINE.length));
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
