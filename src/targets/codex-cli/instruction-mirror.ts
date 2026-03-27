import { basename } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/markdown.js';
import {
  CODEX_INSTRUCTIONS_DIR,
  CODEX_RULE_INDEX_END,
  CODEX_RULE_INDEX_START,
  CODEX_RULES_DIR,
} from './constants.js';

function ruleSlug(source: string): string {
  return basename(source, '.md');
}

export function codexInstructionMirrorPath(rule: Pick<CanonicalRule, 'source'>): string {
  return `${CODEX_INSTRUCTIONS_DIR}/${ruleSlug(rule.source)}.md`;
}

export function serializeCodexInstructionMirror(rule: CanonicalRule): string {
  const frontmatter: Record<string, unknown> = {
    root: rule.root,
    description: rule.description || undefined,
    globs: rule.globs.length > 0 ? rule.globs : undefined,
    targets: rule.targets.length > 0 ? rule.targets : undefined,
    codex_emit: rule.codexEmit || undefined,
    codex_instruction:
      rule.codexInstructionVariant && rule.codexInstructionVariant !== 'default'
        ? rule.codexInstructionVariant
        : undefined,
  };
  Object.keys(frontmatter).forEach((key) => {
    if (frontmatter[key] === undefined) delete frontmatter[key];
  });
  return serializeFrontmatter(frontmatter, rule.body.trim() || '');
}

function summarizeRule(rule: CanonicalRule): string {
  const scopes: string[] = [];
  if (rule.root) {
    scopes.push('Applies to the whole project.');
  } else if (rule.globs.length > 0) {
    scopes.push(`Applies to ${rule.globs.map((glob) => `\`${glob}\``).join(', ')}.`);
  } else {
    scopes.push('General guidance with no file glob restriction.');
  }

  if (rule.codexInstructionVariant === 'override') {
    scopes.push('Override guidance when this rule conflicts with broader instructions.');
  }
  if (rule.codexEmit === 'execution') {
    scopes.push(`Enforced in \`${CODEX_RULES_DIR}/${ruleSlug(rule.source)}.rules\`.`);
  }
  if (rule.targets.length > 0) {
    scopes.push(`Targeted to ${rule.targets.map((target) => `\`${target}\``).join(', ')}.`);
  }

  return scopes.join(' ');
}

export function appendCodexRuleIndex(rootBody: string, rules: CanonicalRule[]): string {
  const trimmed = rootBody.trim();
  const additionalRules = rules.filter((rule) => !rule.root);
  if (additionalRules.length === 0) return trimmed;

  const entries = additionalRules.map((rule) => {
    const label = rule.description || ruleSlug(rule.source);
    return `- [${label}](${codexInstructionMirrorPath(rule)}): ${summarizeRule(rule)}`;
  });

  const section = [
    CODEX_RULE_INDEX_START,
    '## Additional Rule Files',
    ...entries,
    CODEX_RULE_INDEX_END,
  ].join('\n');

  return trimmed ? `${trimmed}\n\n${section}` : section;
}

export function stripCodexRuleIndex(content: string): string {
  const escapedStart = CODEX_RULE_INDEX_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = CODEX_RULE_INDEX_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content
    .replace(new RegExp(`\\n?${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'g'), '\n')
    .trim();
}
