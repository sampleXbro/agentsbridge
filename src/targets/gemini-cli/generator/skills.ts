import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { GEMINI_SKILLS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateSkills(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  for (const skill of canonical.skills) {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description || undefined,
    };
    if (frontmatter.description === undefined) delete frontmatter.description;
    const skillContent = serializeFrontmatter(frontmatter, skill.body.trim() || '');
    outputs.push({
      path: `${GEMINI_SKILLS_DIR}/${skill.name}/SKILL.md`,
      content: skillContent,
    });
    for (const file of skill.supportingFiles) {
      const relPath = file.relativePath.replace(/\\/g, '/');
      outputs.push({
        path: `${GEMINI_SKILLS_DIR}/${skill.name}/${relPath}`,
        content: file.content,
      });
    }
  }
  return outputs;
}
