/**
 * Codex CLI skills import adapter - handles command skills, agent projections, and regular skills.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { parseCommandSkillFrontmatter, serializeImportedCommand } from './command-skill.js';
import {
  parseProjectedAgentSkillFrontmatter,
  serializeImportedAgent,
} from '../projection/projected-agent-skill.js';
import { removePathIfExists } from '../import/scoped-agents-import.js';
import {
  importDirectorySkill,
  type SkillImportOptions,
} from '../import/shared/skill-import-pipeline.js';
import {
  CODEX_TARGET,
  CODEX_SKILLS_DIR,
  CODEX_SKILLS_FALLBACK_DIR,
  CODEX_CANONICAL_COMMANDS_DIR,
  CODEX_CANONICAL_AGENTS_DIR,
  CODEX_CANONICAL_SKILLS_DIR,
} from './constants.js';

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const options: SkillImportOptions = {
    projectRoot,
    sourceSkillsDir: CODEX_SKILLS_DIR,
    destCanonicalSkillsDir: CODEX_CANONICAL_SKILLS_DIR,
    targetName: CODEX_TARGET,
    normalize,
    results,
  };

  for (const skillsRoot of [CODEX_SKILLS_DIR, CODEX_SKILLS_FALLBACK_DIR]) {
    const skillsDir = join(projectRoot, skillsRoot);
    const entries = await readdir(skillsDir, {
      encoding: 'utf8',
      withFileTypes: true,
    }).catch(() => null);
    if (entries === null) continue;

    let importedAny = false;
    for (const ent of entries) {
      if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
      const skillPath = join(skillsDir, ent.name);
      const skillMdPath = join(skillPath, 'SKILL.md');
      const skillMdContent = await readFileSafe(skillMdPath);
      if (!skillMdContent) continue;
      importedAny = true;

      const skillName = ent.name;
      const destSkillPath = join(projectRoot, CODEX_CANONICAL_SKILLS_DIR, skillName, 'SKILL.md');
      const normalized = normalize(skillMdContent, skillMdPath, destSkillPath);
      const { frontmatter, body } = parseFrontmatter(normalized);

      // Check if this is a command skill
      const command = parseCommandSkillFrontmatter(frontmatter, ent.name);
      if (command) {
        await removePathIfExists(join(projectRoot, CODEX_CANONICAL_SKILLS_DIR, skillName));
        const destCommandsDir = join(projectRoot, CODEX_CANONICAL_COMMANDS_DIR);
        await mkdirp(destCommandsDir);
        const commandPath = join(destCommandsDir, `${command.name}.md`);
        await writeFileAtomic(
          commandPath,
          serializeImportedCommand(command, normalize(body, skillMdPath, commandPath)),
        );
        results.push({
          fromTool: CODEX_TARGET,
          fromPath: skillMdPath,
          toPath: `${CODEX_CANONICAL_COMMANDS_DIR}/${command.name}.md`,
          feature: 'commands',
        });
        continue;
      }

      // Check if this is a projected agent skill
      const projectedAgent = parseProjectedAgentSkillFrontmatter(frontmatter, ent.name);
      if (projectedAgent) {
        await removePathIfExists(join(projectRoot, CODEX_CANONICAL_SKILLS_DIR, skillName));
        const destAgentsDir = join(projectRoot, CODEX_CANONICAL_AGENTS_DIR);
        await mkdirp(destAgentsDir);
        const agentPath = join(destAgentsDir, `${projectedAgent.name}.md`);
        await writeFileAtomic(
          agentPath,
          serializeImportedAgent(projectedAgent, normalize(body, skillMdPath, agentPath)),
        );
        results.push({
          fromTool: CODEX_TARGET,
          fromPath: skillMdPath,
          toPath: `${CODEX_CANONICAL_AGENTS_DIR}/${projectedAgent.name}.md`,
          feature: 'agents',
        });
        continue;
      }

      // Regular skill - use shared pipeline
      await importDirectorySkill(skillName, skillPath, options);
    }

    if (importedAny) return;
  }
}
