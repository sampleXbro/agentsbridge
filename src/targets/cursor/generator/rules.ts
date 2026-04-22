import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { appendEmbeddedRulesBlock } from '../../projection/managed-blocks.js';
import {
  CURSOR_COMPAT_AGENTS,
  CURSOR_DOT_CURSOR_AGENTS,
  CURSOR_GENERAL_RULE,
  CURSOR_RULES_DIR,
} from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];

  const root = canonical.rules.find((r) => r.root);
  if (root) {
    const body = root.body.trim() ? root.body : '';
    outputs.push({ path: CURSOR_COMPAT_AGENTS, content: body });
    const frontmatter: Record<string, unknown> = { alwaysApply: true };
    if (root.description) frontmatter.description = root.description;
    const content = serializeFrontmatter(frontmatter, body);
    outputs.push({ path: CURSOR_GENERAL_RULE, content });
  }

  const nonRoot = canonical.rules.filter(
    (r) => !r.root && (r.targets.length === 0 || r.targets.includes('cursor')),
  );
  for (const rule of nonRoot) {
    const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
    const alwaysApply = rule.trigger === 'always_on' ? true : false;
    const frontmatter: Record<string, unknown> = { alwaysApply };
    if (rule.description) frontmatter.description = rule.description;
    if (rule.globs.length > 0) frontmatter.globs = rule.globs;
    const content = serializeFrontmatter(frontmatter, rule.body.trim() || '');
    outputs.push({ path: `${CURSOR_RULES_DIR}/${slug}.mdc`, content });
  }

  const aggregate = renderCursorGlobalUserRules(canonical);
  if (aggregate.trim()) {
    outputs.push({ path: CURSOR_DOT_CURSOR_AGENTS, content: aggregate });
  }

  return outputs;
}

export function renderCursorGlobalUserRules(canonical: CanonicalFiles): string {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter(
    (rule) => !rule.root && (rule.targets.length === 0 || rule.targets.includes('cursor')),
  );
  const sections: string[] = [];

  if (root?.body.trim()) {
    sections.push(appendEmbeddedRulesBlock(root.body, nonRootRules));
  } else if (nonRootRules.length > 0) {
    sections.push(appendEmbeddedRulesBlock('', nonRootRules));
  }

  return sections.filter(Boolean).join('\n\n');
}
