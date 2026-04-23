/**
 * Claude Code global ~/.claude/CLAUDE.md framing (strategy doc §1).
 */

import type { CanonicalFiles } from '../../core/types.js';

function ruleSectionTitle(rule: { description: string; source: string }): string {
  const d = rule.description.trim();
  if (d) return d;
  const base = rule.source.split('/').pop() ?? 'rule';
  return base.replace(/\.md$/i, '') || 'Rule';
}

/**
 * Render primary global instructions: root body under "# Global Instructions" with a section heading.
 */
export function renderClaudeGlobalPrimaryInstructions(canonical: CanonicalFiles): string {
  const root = canonical.rules.find((r) => r.root);
  const body = (root?.body ?? '').trim();
  if (!body) return '';
  const title = root ? ruleSectionTitle(root) : 'Guidance';
  return `# Global Instructions\n\n## ${title}\n\n${body}\n`;
}
