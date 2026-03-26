/**
 * Windsurf workflows and skills import helpers.
 */

import { join, basename } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, readDirRecursive, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedCommandWithFallback } from '../import-metadata.js';
import {
  parseProjectedAgentSkillFrontmatter,
  serializeImportedAgent,
} from '../projected-agent-skill.js';
import { removePathIfExists } from '../scoped-agents-import.js';
import { WINDSURF_WORKFLOWS_DIR, WINDSURF_SKILLS_DIR } from './constants.js';

const AGENTSMESH_COMMANDS = '.agentsmesh/commands';
const AGENTSMESH_AGENTS = '.agentsmesh/agents';
const AGENTSMESH_SKILLS = '.agentsmesh/skills';

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export async function importWorkflows(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const workflowsDir = join(projectRoot, WINDSURF_WORKFLOWS_DIR);
  const workflowFiles = await readDirRecursive(workflowsDir);
  const workflowMdFiles = workflowFiles.filter((f) => f.endsWith('.md'));
  const destCommandsDir = join(projectRoot, AGENTSMESH_COMMANDS);
  for (const srcPath of workflowMdFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    const name = basename(srcPath, '.md');
    await mkdirp(destCommandsDir);
    const destPath = join(destCommandsDir, `${name}.md`);
    const normalized = normalize(content, srcPath, destPath);
    const { frontmatter, body } = parseFrontmatter(normalized);
    const outContent = await serializeImportedCommandWithFallback(
      destPath,
      {
        description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
        hasDescription: Object.prototype.hasOwnProperty.call(frontmatter, 'description'),
        allowedTools: (() => {
          const fromCamel = toStringArray(frontmatter.allowedTools);
          return fromCamel.length > 0 ? fromCamel : toStringArray(frontmatter['allowed-tools']);
        })(),
        hasAllowedTools:
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowedTools') ||
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowed-tools'),
      },
      body,
    );
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'windsurf',
      fromPath: srcPath,
      toPath: `${AGENTSMESH_COMMANDS}/${name}.md`,
      feature: 'commands',
    });
  }
}

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const windsurfSkillsBaseDir = join(projectRoot, WINDSURF_SKILLS_DIR);
  try {
    const skillEntries = await readdir(windsurfSkillsBaseDir, { withFileTypes: true });
    for (const ent of skillEntries) {
      if (!ent.isDirectory()) continue;
      const skillPath = join(windsurfSkillsBaseDir, ent.name);
      const skillMdPath = join(skillPath, 'SKILL.md');
      const skillContent = await readFileSafe(skillMdPath);
      if (!skillContent) continue;
      const rawParsed = parseFrontmatter(skillContent);
      const projectedAgent = parseProjectedAgentSkillFrontmatter(rawParsed.frontmatter, ent.name);
      if (projectedAgent) {
        await removePathIfExists(join(projectRoot, AGENTSMESH_SKILLS, ent.name));
        const destAgentsDir = join(projectRoot, AGENTSMESH_AGENTS);
        await mkdirp(destAgentsDir);
        const agentPath = join(destAgentsDir, `${projectedAgent.name}.md`);
        await writeFileAtomic(
          agentPath,
          serializeImportedAgent(projectedAgent, normalize(rawParsed.body, skillMdPath, agentPath)),
        );
        results.push({
          fromTool: 'windsurf',
          fromPath: skillMdPath,
          toPath: `${AGENTSMESH_AGENTS}/${projectedAgent.name}.md`,
          feature: 'agents',
        });
        continue;
      }
      const destSkillDir = join(projectRoot, AGENTSMESH_SKILLS, ent.name);
      const destSkillPath = join(destSkillDir, 'SKILL.md');
      const normalized = normalize(skillContent, skillMdPath, destSkillPath);
      await mkdirp(destSkillDir);
      await writeFileAtomic(destSkillPath, normalized);
      results.push({
        fromTool: 'windsurf',
        fromPath: skillMdPath,
        toPath: `${AGENTSMESH_SKILLS}/${ent.name}/SKILL.md`,
        feature: 'skills',
      });
      const allSkillFiles = await readDirRecursive(skillPath);
      for (const absPath of allSkillFiles) {
        if (absPath === skillMdPath) continue;
        const relPath = absPath.slice(skillPath.length + 1).replace(/\\/g, '/');
        const supportContent = await readFileSafe(absPath);
        if (supportContent === null) continue;
        const destSupportPath = join(destSkillDir, relPath);
        await mkdirp(join(destSupportPath, '..'));
        await writeFileAtomic(destSupportPath, normalize(supportContent, absPath, destSupportPath));
        results.push({
          fromTool: 'windsurf',
          fromPath: absPath,
          toPath: `${AGENTSMESH_SKILLS}/${ent.name}/${relPath}`,
          feature: 'skills',
        });
      }
    }
  } catch {
    // .windsurf/skills/ doesn't exist — skip
  }
}
