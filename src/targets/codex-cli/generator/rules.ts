import type { CanonicalFiles, CanonicalRule } from '../../../core/types.js';
import { appendEmbeddedRulesBlock } from '../../projection/managed-blocks.js';
import { AGENTS_MD, CODEX_RULES_DIR } from '../constants.js';
import { codexNestedAgentsPath } from '../codex-rule-paths.js';
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

/** Non-root, non-filtered, advisory (non-execution) rules eligible for this target. */
function eligibleAdvisoryRules(canonical: CanonicalFiles): CanonicalRule[] {
  return canonical.rules.filter((rule) => {
    if (rule.root) return false;
    if (rule.codexEmit === 'execution') return false;
    return rule.targets.length === 0 || rule.targets.includes('codex-cli');
  });
}

/** Groups advisory rules by their resolved nested `AGENTS.md` path, joining bodies that collide. */
function groupByNestedPath(rules: CanonicalRule[]): Map<string, CanonicalRule[]> {
  const groups = new Map<string, CanonicalRule[]>();
  for (const rule of rules) {
    const path = codexNestedAgentsPath(rule);
    const existing = groups.get(path);
    if (existing) existing.push(rule);
    else groups.set(path, [rule]);
  }
  return groups;
}

export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const root = canonical.rules.find((r) => r.root);
  const outputs: RulesOutput[] = [];
  if (root) {
    outputs.push({ path: AGENTS_MD, content: root.body.trim() });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.codexEmit !== 'execution') continue;
    if (rule.targets.length > 0 && !rule.targets.includes('codex-cli')) continue;
    // Split on both separators: on Windows `rule.source` is a native path with
    // backslashes, so splitting on '/' alone would leave the whole absolute path
    // as the slug and emit a bogus `.codex/rules/C:\...\policy.rules` path whose
    // mkdir throws ENOENT (drive-colon mid-path).
    const slug = rule.source.split(/[\\/]/).pop()!.replace(/\.md$/i, '');
    outputs.push({
      path: `${CODEX_RULES_DIR}/${slug}.rules`,
      content: toSafeCodexRulesContent(rule.body),
    });
  }

  for (const [path, rules] of groupByNestedPath(eligibleAdvisoryRules(canonical))) {
    const content = rules
      .map((rule) => rule.body.trim())
      .filter((body) => body.length > 0)
      .join('\n\n');
    outputs.push({ path, content });
  }

  return outputs;
}

export function renderCodexGlobalInstructions(canonical: CanonicalFiles): string {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = eligibleAdvisoryRules(canonical);
  return appendEmbeddedRulesBlock(root?.body.trim() ?? '', nonRootRules);
}
