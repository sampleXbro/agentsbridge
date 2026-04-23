import { basename } from 'node:path';
import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { WINDSURF_RULES_DIR, WINDSURF_AGENTS_MD } from '../constants.js';
import type { RulesOutput } from './types.js';

function ruleSlug(source: string): string {
  const name = basename(source, '.md');
  return name === '_root' ? 'root' : name;
}

function directoryScopedRuleDir(globs: string[]): string | null {
  if (globs.length === 0) return null;
  const dirs = globs
    .map((glob) => glob.split('/')[0] ?? '')
    .filter((segment) => /^[A-Za-z0-9._-]+$/.test(segment));
  if (dirs.length !== globs.length) return null;
  return dirs.every((dir) => dir === dirs[0]) ? dirs[0]! : null;
}

export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  const root = canonical.rules.find((r) => r.root);
  if (!root) return [];

  outputs.push({
    path: WINDSURF_AGENTS_MD,
    content: root.body.trim(),
  });

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('windsurf')) continue;
    const slug = ruleSlug(rule.source);
    const normalizedTrigger = rule.trigger || (rule.globs.length > 0 ? 'glob' : undefined);
    const frontmatter: Record<string, unknown> = {
      description: rule.description || undefined,
      trigger: normalizedTrigger,
      glob: rule.globs.length === 1 ? rule.globs[0] : undefined,
      globs: rule.globs.length > 1 ? rule.globs : undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, rule.body.trim() || '')
        : rule.body.trim() || '';
    outputs.push({ path: `${WINDSURF_RULES_DIR}/${slug}.md`, content });

    const dir = directoryScopedRuleDir(rule.globs);
    if (dir) {
      if (dir !== slug) {
        outputs.push({ path: `${WINDSURF_RULES_DIR}/${dir}.md`, content });
      }
      outputs.push({ path: `${dir}/AGENTS.md`, content: rule.body.trim() || '' });
    }
  }

  return outputs;
}
