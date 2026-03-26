/**
 * Load all canonical files from .agentsmesh/ into CanonicalFiles.
 */

import { join } from 'node:path';
import type { CanonicalFiles } from '../core/types.js';
import { parseRules } from './rules.js';
import { parseCommands } from './commands.js';
import { parseAgents } from './agents.js';
import { parseSkills } from './skills.js';
import { parseMcp } from './mcp.js';
import { parsePermissions } from './permissions.js';
import { parseHooks } from './hooks.js';
import { parseIgnore } from './ignore.js';

/**
 * Load all canonical files from .agentsmesh/ at the given project root.
 * Missing directories/files yield empty arrays or null as per each parser.
 *
 * @param projectRoot - Absolute path to project root (containing .agentsmesh/)
 * @returns CanonicalFiles with all parsed data
 */
export async function loadCanonicalFiles(projectRoot: string): Promise<CanonicalFiles> {
  const abDir = join(projectRoot, '.agentsmesh');

  const [rules, commands, agents, skills, mcp, permissions, hooks, ignore] = await Promise.all([
    parseRules(join(abDir, 'rules')),
    parseCommands(join(abDir, 'commands')),
    parseAgents(join(abDir, 'agents')),
    parseSkills(join(abDir, 'skills')),
    parseMcp(join(abDir, 'mcp.json')),
    parsePermissions(join(abDir, 'permissions.yaml')),
    parseHooks(join(abDir, 'hooks.yaml')),
    parseIgnore(join(abDir, 'ignore')),
  ]);

  return {
    rules,
    commands,
    agents,
    skills,
    mcp,
    permissions,
    hooks,
    ignore,
  };
}
