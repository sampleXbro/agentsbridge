/**
 * Cline skills import helpers — imports .cline/skills into canonical .agentsmesh/skills.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, readDirRecursive, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter, serializeFrontmatter } from '../../utils/markdown.js';
import {
  parseProjectedAgentSkillFrontmatter,
  serializeImportedAgent,
} from '../projected-agent-skill.js';
import {
  CLINE_TARGET,
  CLINE_SKILLS_DIR,
  CLINE_CANONICAL_AGENTS_DIR,
  CLINE_CANONICAL_SKILLS_DIR,
} from './constants.js';

export async function importClineSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const skillsDir = join(projectRoot, CLINE_SKILLS_DIR);
  const skillDirs: { name: string; path: string }[] = [];
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const skillPath = join(skillsDir, ent.name);
      const skillMd = join(skillPath, 'SKILL.md');
      const content = await readFileSafe(skillMd);
      if (!content) continue;
      skillDirs.push({ name: ent.name, path: skillPath });
    }
  } catch {
    // no skills dir
  }

  for (const { name, path: skillPath } of skillDirs) {
    const skillMdPath = join(skillPath, 'SKILL.md');
    const content = await readFileSafe(skillMdPath);
    if (!content) continue;
    const rawParsed = parseFrontmatter(content);
    const projectedAgent = parseProjectedAgentSkillFrontmatter(rawParsed.frontmatter, name);
    if (projectedAgent) {
      const destAgentsDir = join(projectRoot, CLINE_CANONICAL_AGENTS_DIR);
      await mkdirp(destAgentsDir);
      const agentPath = join(destAgentsDir, `${projectedAgent.name}.md`);
      await writeFileAtomic(
        agentPath,
        serializeImportedAgent(projectedAgent, normalize(rawParsed.body, skillMdPath, agentPath)),
      );
      results.push({
        fromTool: CLINE_TARGET,
        fromPath: skillMdPath,
        toPath: `${CLINE_CANONICAL_AGENTS_DIR}/${projectedAgent.name}.md`,
        feature: 'agents',
      });
      continue;
    }
    const destSkillPath = join(projectRoot, CLINE_CANONICAL_SKILLS_DIR, name, 'SKILL.md');
    const normalized = normalize(content, skillMdPath, destSkillPath);
    const { frontmatter, body } = parseFrontmatter(normalized);
    const destSkillDir = join(projectRoot, CLINE_CANONICAL_SKILLS_DIR, name);
    await mkdirp(destSkillDir);
    const canonicalFm: Record<string, unknown> = {
      description:
        typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
    };
    if (canonicalFm.description === undefined) delete canonicalFm.description;
    const skillContent =
      Object.keys(canonicalFm).length > 0
        ? serializeFrontmatter(canonicalFm, body.trim() || '')
        : body.trim() || '';
    await writeFileAtomic(destSkillPath, skillContent);
    results.push({
      fromTool: CLINE_TARGET,
      fromPath: skillMdPath,
      toPath: `${CLINE_CANONICAL_SKILLS_DIR}/${name}/SKILL.md`,
      feature: 'skills',
    });

    const allFiles = await readDirRecursive(skillPath);
    for (const absPath of allFiles) {
      if (absPath === skillMdPath || absPath.endsWith('/SKILL.md')) continue;
      const relPath = absPath.slice(skillPath.length + 1).replace(/\\/g, '/');
      const supportContent = await readFileSafe(absPath);
      if (supportContent === null) continue;
      const destSupportPath = join(destSkillDir, relPath);
      await mkdirp(join(destSupportPath, '..'));
      await writeFileAtomic(destSupportPath, normalize(supportContent, absPath, destSupportPath));
      results.push({
        fromTool: CLINE_TARGET,
        fromPath: absPath,
        toPath: `${CLINE_CANONICAL_SKILLS_DIR}/${name}/${relPath}`,
        feature: 'skills',
      });
    }
  }
}
