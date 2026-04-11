/**
 * Canonical scaffold writers for agentsmesh init.
 */

import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { exists, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import {
  TEMPLATE_ROOT_RULE,
  TEMPLATE_EXAMPLE_RULE,
  TEMPLATE_EXAMPLE_COMMAND,
  TEMPLATE_EXAMPLE_AGENT,
  TEMPLATE_EXAMPLE_SKILL,
  TEMPLATE_MCP,
  TEMPLATE_HOOKS,
  TEMPLATE_PERMISSIONS,
  TEMPLATE_IGNORE,
} from './init-templates.js';

function ab(projectRoot: string, rel: string): string {
  return join(projectRoot, '.agentsmesh', rel);
}

async function countMdFiles(dir: string): Promise<number> {
  if (!(await exists(dir))) return 0;
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.md')).length;
}

async function hasAnyImportedSkill(projectRoot: string): Promise<boolean> {
  const skillsRoot = ab(projectRoot, 'skills');
  if (!(await exists(skillsRoot))) return false;
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (await exists(join(skillsRoot, e.name, 'SKILL.md'))) return true;
  }
  return false;
}

/**
 * Write full example scaffold (fresh init, no prior import).
 */
export async function writeScaffoldFull(projectRoot: string): Promise<void> {
  const rulesDir = ab(projectRoot, 'rules');
  await mkdirp(rulesDir);
  await writeFileAtomic(join(rulesDir, '_root.md'), TEMPLATE_ROOT_RULE);
  logger.success('Created .agentsmesh/rules/_root.md');
  await writeFileAtomic(join(rulesDir, 'example.md'), TEMPLATE_EXAMPLE_RULE);
  logger.success('Created .agentsmesh/rules/example.md');

  const commandsDir = ab(projectRoot, 'commands');
  await mkdirp(commandsDir);
  await writeFileAtomic(join(commandsDir, 'example.md'), TEMPLATE_EXAMPLE_COMMAND);
  logger.success('Created .agentsmesh/commands/example.md');

  const agentsDir = ab(projectRoot, 'agents');
  await mkdirp(agentsDir);
  await writeFileAtomic(join(agentsDir, 'example.md'), TEMPLATE_EXAMPLE_AGENT);
  logger.success('Created .agentsmesh/agents/example.md');

  const skillDir = ab(projectRoot, join('skills', 'example'));
  await mkdirp(skillDir);
  await writeFileAtomic(join(skillDir, 'SKILL.md'), TEMPLATE_EXAMPLE_SKILL);
  logger.success('Created .agentsmesh/skills/example/SKILL.md');

  await writeFileAtomic(ab(projectRoot, 'mcp.json'), TEMPLATE_MCP);
  logger.success('Created .agentsmesh/mcp.json');
  await writeFileAtomic(ab(projectRoot, 'hooks.yaml'), TEMPLATE_HOOKS);
  logger.success('Created .agentsmesh/hooks.yaml');
  await writeFileAtomic(ab(projectRoot, 'permissions.yaml'), TEMPLATE_PERMISSIONS);
  logger.success('Created .agentsmesh/permissions.yaml');
  await writeFileAtomic(ab(projectRoot, 'ignore'), TEMPLATE_IGNORE);
  logger.success('Created .agentsmesh/ignore');
}

/**
 * After `init --yes` import: add template files only where import left a category empty.
 */
export async function writeScaffoldGapFill(projectRoot: string): Promise<void> {
  const rulesDir = ab(projectRoot, 'rules');
  const rulesMd = await countMdFiles(rulesDir);
  const rootPath = join(rulesDir, '_root.md');
  const hasRoot = await exists(rootPath);
  await mkdirp(rulesDir);
  if (rulesMd === 0) {
    await writeFileAtomic(rootPath, TEMPLATE_ROOT_RULE);
    logger.success('Created .agentsmesh/rules/_root.md');
    await writeFileAtomic(join(rulesDir, 'example.md'), TEMPLATE_EXAMPLE_RULE);
    logger.success('Created .agentsmesh/rules/example.md');
  } else if (!hasRoot) {
    await writeFileAtomic(rootPath, TEMPLATE_ROOT_RULE);
    logger.success('Created .agentsmesh/rules/_root.md');
  }

  const commandsDir = ab(projectRoot, 'commands');
  if ((await countMdFiles(commandsDir)) === 0) {
    await mkdirp(commandsDir);
    await writeFileAtomic(join(commandsDir, 'example.md'), TEMPLATE_EXAMPLE_COMMAND);
    logger.success('Created .agentsmesh/commands/example.md');
  }

  const agentsDir = ab(projectRoot, 'agents');
  if ((await countMdFiles(agentsDir)) === 0) {
    await mkdirp(agentsDir);
    await writeFileAtomic(join(agentsDir, 'example.md'), TEMPLATE_EXAMPLE_AGENT);
    logger.success('Created .agentsmesh/agents/example.md');
  }

  if (!(await hasAnyImportedSkill(projectRoot))) {
    const skillDir = ab(projectRoot, join('skills', 'example'));
    await mkdirp(skillDir);
    await writeFileAtomic(join(skillDir, 'SKILL.md'), TEMPLATE_EXAMPLE_SKILL);
    logger.success('Created .agentsmesh/skills/example/SKILL.md');
  }

  const mcpPath = ab(projectRoot, 'mcp.json');
  if (!(await exists(mcpPath))) {
    await writeFileAtomic(mcpPath, TEMPLATE_MCP);
    logger.success('Created .agentsmesh/mcp.json');
  }
  const hooksPath = ab(projectRoot, 'hooks.yaml');
  if (!(await exists(hooksPath))) {
    await writeFileAtomic(hooksPath, TEMPLATE_HOOKS);
    logger.success('Created .agentsmesh/hooks.yaml');
  }
  const permsPath = ab(projectRoot, 'permissions.yaml');
  if (!(await exists(permsPath))) {
    await writeFileAtomic(permsPath, TEMPLATE_PERMISSIONS);
    logger.success('Created .agentsmesh/permissions.yaml');
  }
  const ignorePath = ab(projectRoot, 'ignore');
  if (!(await exists(ignorePath))) {
    await writeFileAtomic(ignorePath, TEMPLATE_IGNORE);
    logger.success('Created .agentsmesh/ignore');
  }
}
