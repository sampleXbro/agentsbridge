import type { CanonicalFiles } from '../../../core/types.js';
import { appendEmbeddedRulesBlock } from '../../projection/managed-blocks.js';
import { GEMINI_ROOT, GEMINI_COMPAT_AGENTS } from '../constants.js';
import type { RulesOutput } from './types.js';

/**
 * Generate GEMINI.md from root rule and embedded non-root rule blocks.
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const root = canonical.rules.find((r) => r.root);
  const nonRootRules = canonical.rules.filter((r) => {
    if (r.root) return false;
    if (r.targets.length > 0 && !r.targets.includes('gemini-cli')) return false;
    return true;
  });

  if (!root && nonRootRules.length === 0) return [];

  const content = appendEmbeddedRulesBlock(root?.body.trim() ?? '', nonRootRules);

  const outputs: RulesOutput[] = [{ path: GEMINI_ROOT, content }];
  if (root) {
    const compatAgentsContent = root.body
      .trim()
      .replace(/\.agentsmesh\/skills\//g, '.agents/skills/');
    outputs.push({ path: GEMINI_COMPAT_AGENTS, content: compatAgentsContent });
  }
  return outputs;
}
