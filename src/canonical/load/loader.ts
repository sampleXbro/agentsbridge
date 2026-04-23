/**
 * Load all canonical files from a canonical directory into CanonicalFiles.
 */

import { join } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { parseRules } from '../features/rules.js';
import { parseCommands } from '../features/commands.js';
import { parseAgents } from '../features/agents.js';
import { parseSkills } from '../features/skills.js';
import { parseMcp } from '../features/mcp.js';
import { parsePermissions } from '../features/permissions.js';
import { parseHooks } from '../features/hooks.js';
import { parseIgnore } from '../features/ignore.js';
import { exists } from '../../utils/filesystem/fs.js';

/**
 * Load all canonical files from a canonical directory or project root.
 * Missing directories/files yield empty arrays or null as per each parser.
 *
 * @param canonicalDirOrProjectRoot - Absolute path to canonical directory or project root
 * @returns CanonicalFiles with all parsed data
 */
export async function loadCanonicalFiles(
  canonicalDirOrProjectRoot: string,
): Promise<CanonicalFiles> {
  const nestedCanonicalDir = join(canonicalDirOrProjectRoot, '.agentsmesh');
  const canonicalDir = (await exists(nestedCanonicalDir))
    ? nestedCanonicalDir
    : canonicalDirOrProjectRoot;

  const [rules, commands, agents, skills, mcp, permissions, hooks, ignore] = await Promise.all([
    parseRules(join(canonicalDir, 'rules')),
    parseCommands(join(canonicalDir, 'commands')),
    parseAgents(join(canonicalDir, 'agents')),
    parseSkills(join(canonicalDir, 'skills')),
    parseMcp(join(canonicalDir, 'mcp.json')),
    parsePermissions(join(canonicalDir, 'permissions.yaml')),
    parseHooks(join(canonicalDir, 'hooks.yaml')),
    parseIgnore(join(canonicalDir, 'ignore')),
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
