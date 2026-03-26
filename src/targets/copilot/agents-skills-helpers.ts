/**
 * Copilot agents and skills import helpers.
 */

import { join, basename, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, readDirRecursive, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter, serializeFrontmatter } from '../../utils/markdown.js';
import {
  COPILOT_TARGET,
  COPILOT_AGENTS_DIR,
  COPILOT_SKILLS_DIR,
  COPILOT_CANONICAL_AGENTS_DIR,
  COPILOT_CANONICAL_SKILLS_DIR,
} from './constants.js';

/**
 * Import .github/agents/*.agent.md into canonical .agentsmesh/agents/*.md.
 * Strips .agent suffix; maps mcp-servers → mcpServers for canonical compatibility.
 */
export async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const agentsDir = join(projectRoot, COPILOT_AGENTS_DIR);
  let files: string[];
  try {
    files = await readDirRecursive(agentsDir);
  } catch {
    return;
  }
  const agentFiles = files.filter((f) => f.endsWith('.agent.md'));
  const destDir = join(projectRoot, COPILOT_CANONICAL_AGENTS_DIR);
  for (const srcPath of agentFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    const base = basename(srcPath, '.agent.md');
    await mkdirp(destDir);
    const destPath = join(destDir, `${base}.md`);
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
    const canonicalFm: Record<string, unknown> = {
      name: typeof frontmatter.name === 'string' ? frontmatter.name : base,
      description:
        typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
      tools: Array.isArray(frontmatter.tools)
        ? frontmatter.tools.filter((x): x is string => typeof x === 'string')
        : typeof frontmatter.tools === 'string'
          ? [frontmatter.tools]
          : undefined,
      model: typeof frontmatter.model === 'string' ? frontmatter.model : undefined,
      mcpServers: Array.isArray(frontmatter['mcp-servers'])
        ? frontmatter['mcp-servers'].filter((x): x is string => typeof x === 'string')
        : Array.isArray(frontmatter.mcpServers)
          ? frontmatter.mcpServers.filter((x): x is string => typeof x === 'string')
          : undefined,
      skills: Array.isArray(frontmatter.skills)
        ? frontmatter.skills.filter((x): x is string => typeof x === 'string')
        : undefined,
    };
    Object.keys(canonicalFm).forEach((k) => {
      if (canonicalFm[k] === undefined) delete canonicalFm[k];
    });
    const outContent = serializeFrontmatter(canonicalFm, body.trim());
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: COPILOT_TARGET,
      fromPath: srcPath,
      toPath: `${COPILOT_CANONICAL_AGENTS_DIR}/${base}.md`,
      feature: 'agents',
    });
  }
}

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const skillFiles = await readDirRecursive(join(projectRoot, COPILOT_SKILLS_DIR)).catch(() => []);
  const skillMdFiles = skillFiles.filter((path) => path.endsWith('/SKILL.md'));
  for (const skillMdPath of skillMdFiles) {
    const content = await readFileSafe(skillMdPath);
    if (!content) continue;
    const skillName = basename(dirname(skillMdPath));
    const destSkillDir = join(projectRoot, COPILOT_CANONICAL_SKILLS_DIR, skillName);
    const allSkillFiles = await readDirRecursive(dirname(skillMdPath));
    for (const absPath of allSkillFiles) {
      const fileContent = await readFileSafe(absPath);
      if (fileContent === null) continue;
      const relPath = absPath.slice(dirname(skillMdPath).length + 1).replace(/\\/g, '/');
      const destPath = join(destSkillDir, relPath);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, normalize(fileContent, absPath, destPath));
      results.push({
        fromTool: COPILOT_TARGET,
        fromPath: absPath,
        toPath: `${COPILOT_CANONICAL_SKILLS_DIR}/${skillName}/${relPath}`,
        feature: 'skills',
      });
    }
  }
}
