import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { WINDSURF_SKILLS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateSkills(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  for (const skill of canonical.skills) {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description || undefined,
    };
    if (frontmatter.description === undefined) delete frontmatter.description;
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, skill.body.trim() || '')
        : skill.body.trim() || '';
    outputs.push({ path: `${WINDSURF_SKILLS_DIR}/${skill.name}/SKILL.md`, content });
    for (const sf of skill.supportingFiles) {
      outputs.push({
        path: `${WINDSURF_SKILLS_DIR}/${skill.name}/${sf.relativePath}`,
        content: sf.content,
      });
    }
  }
  return outputs;
}
