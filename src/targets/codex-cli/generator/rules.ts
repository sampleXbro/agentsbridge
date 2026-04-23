import type { CanonicalFiles } from '../../../core/types.js';
import { basename } from 'node:path';
import { appendEmbeddedRulesBlock } from '../../projection/managed-blocks.js';
import { AGENTS_MD, CODEX_RULES_DIR } from '../constants.js';
import {
  appendCodexRuleIndex,
  codexInstructionMirrorPath,
  serializeCodexInstructionMirror,
} from '../instruction-mirror.js';
import type { RulesOutput } from './types.js';

function looksLikeCodexRulesDsl(body: string): boolean {
  return /(^|\n)\s*[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(body);
}

function toCodexRulesComments(body: string): string {
  return body
    .split('\n')
    .map((line) => (line.length > 0 ? `# ${line}` : '#'))
    .join('\n');
}

function toSafeCodexRulesContent(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (looksLikeCodexRulesDsl(trimmed)) return `${trimmed}\n`;
  const lines: string[] = [
    '# agentsmesh: canonical execution rule body is not Codex DSL',
    '# The original body is preserved below as comments.',
    '# Replace with Codex rules DSL (for example prefix_rule(...)) to enforce behavior.',
    '#',
    ...toCodexRulesComments(trimmed).split('\n'),
    '#',
    '# Example template:',
    '# prefix_rule(',
    '#   pattern = ["git", "status"],',
    '#   decision = "allow",',
    '#   justification = "Allow safe status checks",',
    '# )',
  ];
  return `${lines.join('\n')}\n`;
}

export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const root = canonical.rules.find((r) => r.root);
  const outputs: RulesOutput[] = [];
  if (root) {
    outputs.push({ path: AGENTS_MD, content: appendCodexRuleIndex(root.body, canonical.rules) });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    const slug = basename(rule.source, '.md');
    if (rule.targets.length > 0 && !rule.targets.includes('codex-cli')) continue;
    if (rule.codexEmit === 'execution') {
      outputs.push({
        path: `${CODEX_RULES_DIR}/${slug}.rules`,
        content: toSafeCodexRulesContent(rule.body),
      });
    }
    outputs.push({
      path: codexInstructionMirrorPath(rule),
      content: serializeCodexInstructionMirror(rule),
    });
  }

  return outputs;
}

export function renderCodexGlobalInstructions(canonical: CanonicalFiles): string {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    if (rule.codexEmit === 'execution') return false;
    return rule.targets.length === 0 || rule.targets.includes('codex-cli');
  });

  return appendEmbeddedRulesBlock(root?.body.trim() ?? '', nonRootRules);
}
