/**
 * Windsurf skills import adapter - handles projected agent skills and regular skills.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  parseProjectedAgentSkillFrontmatter,
  serializeImportedAgent,
} from '../projection/projected-agent-skill.js';
import { removePathIfExists } from '../import/scoped-agents-import.js';
import {
  findDirectorySkills,
  importDirectorySkill,
  type SkillImportOptions,
} from '../import/shared/skill-import-pipeline.js';
import {
  WINDSURF_SKILLS_DIR,
  WINDSURF_CANONICAL_AGENTS_DIR,
  WINDSURF_CANONICAL_SKILLS_DIR,
} from './constants.js';

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  skillsRelDir: string = WINDSURF_SKILLS_DIR,
): Promise<void> {
  const skillsDir = join(projectRoot, skillsRelDir);
  const directorySkills = await findDirectorySkills(skillsDir);

  const options: SkillImportOptions = {
    projectRoot,
    sourceSkillsDir: skillsRelDir,
    destCanonicalSkillsDir: WINDSURF_CANONICAL_SKILLS_DIR,
    targetName: 'windsurf',
    normalize,
    results,
  };

  // Check each skill to see if it's a projected agent skill
  for (const [skillName, skillDir] of directorySkills) {
    const skillMdPath = join(skillDir, 'SKILL.md');
    const content = await readFileSafe(skillMdPath);
    if (!content) continue;

    const rawParsed = parseFrontmatter(content);
    const projectedAgent = parseProjectedAgentSkillFrontmatter(rawParsed.frontmatter, skillName);

    if (projectedAgent) {
      // Import as agent, not skill
      await removePathIfExists(join(projectRoot, WINDSURF_CANONICAL_SKILLS_DIR, skillName));
      const destAgentsDir = join(projectRoot, WINDSURF_CANONICAL_AGENTS_DIR);
      await mkdirp(destAgentsDir);
      const agentPath = join(destAgentsDir, `${projectedAgent.name}.md`);
      await writeFileAtomic(
        agentPath,
        serializeImportedAgent(projectedAgent, normalize(rawParsed.body, skillMdPath, agentPath)),
      );
      results.push({
        fromTool: 'windsurf',
        fromPath: skillMdPath,
        toPath: `${WINDSURF_CANONICAL_AGENTS_DIR}/${projectedAgent.name}.md`,
        feature: 'agents',
      });
      continue;
    }

    // Regular skill - use shared pipeline
    await importDirectorySkill(skillName, skillDir, options);
  }
}
