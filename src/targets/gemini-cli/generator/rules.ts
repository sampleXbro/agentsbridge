import type { CanonicalFiles } from '../../../core/types.js';
import { GEMINI_ROOT, GEMINI_COMPAT_AGENTS } from '../constants.js';
import type { RulesOutput } from './types.js';

/**
 * Generate GEMINI.md from root rule and non-root rules as ---‑separated sections.
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const root = canonical.rules.find((r) => r.root);
  const nonRootRules = canonical.rules.filter((r) => {
    if (r.root) return false;
    if (r.targets.length > 0 && !r.targets.includes('gemini-cli')) return false;
    return true;
  });

  if (!root && nonRootRules.length === 0) return [];

  const sections: string[] = [];

  if (root) {
    sections.push(root.body.trim());
  }

  for (const rule of nonRootRules) {
    const parts: string[] = [];
    if (rule.description) {
      parts.push(`## ${rule.description}`);
      parts.push('');
    }
    parts.push(rule.body.trim());
    sections.push(parts.join('\n'));
  }

  const nonEmpty = sections.filter((s) => s.length > 0);
  const content = nonEmpty.join('\n\n---\n\n');

  const outputs: RulesOutput[] = [{ path: GEMINI_ROOT, content }];
  if (root) {
    const compatAgentsContent = root.body
      .trim()
      .replace(/\.agentsmesh\/skills\//g, '.agents/skills/');
    outputs.push({ path: GEMINI_COMPAT_AGENTS, content: compatAgentsContent });
  }
  return outputs;
}
