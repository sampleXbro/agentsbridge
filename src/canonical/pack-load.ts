/**
 * Load canonical resources from materialized packs in .agentsmesh/packs/.
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
import { mergeCanonicalFiles } from './merge.js';
import { filterCanonicalByFeatures } from './extends.js';
import { applyExtendPick } from './extend-pick.js';
import { listPacks } from '../install/pack-reader.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

/**
 * Load canonical files from a single pack directory.
 * Calls parsers directly — packs have no .agentsmesh/ nesting.
 *
 * @param packDir - Absolute path to the pack directory (contains rules/, commands/, etc.)
 */
export async function loadPackCanonical(packDir: string): Promise<CanonicalFiles> {
  const [rules, commands, agents, skills, mcp, permissions, hooks, ignore] = await Promise.all([
    parseRules(join(packDir, 'rules')),
    parseCommands(join(packDir, 'commands')),
    parseAgents(join(packDir, 'agents')),
    parseSkills(join(packDir, 'skills')),
    parseMcp(join(packDir, 'mcp.json')),
    parsePermissions(join(packDir, 'permissions.yaml')),
    parseHooks(join(packDir, 'hooks.yaml')),
    parseIgnore(join(packDir, 'ignore')),
  ]);
  return { ...emptyCanonical(), rules, commands, agents, skills, mcp, permissions, hooks, ignore };
}

/**
 * Load and merge canonical resources from all valid packs.
 * Scans {abDir}/packs/ for pack directories, reads each pack.yaml,
 * filters by declared features, applies pick, then merges.
 *
 * @param abDir - Absolute path containing the packs/ directory
 *                (typically the .agentsmesh/ dir, or configDir in tests)
 */
export async function loadPacksCanonical(abDir: string): Promise<CanonicalFiles> {
  const packsDir = join(abDir, 'packs');
  const packs = await listPacks(packsDir);

  let merged = emptyCanonical();
  for (const { meta, packDir } of packs) {
    const canonical = await loadPackCanonical(packDir);
    const filtered = filterCanonicalByFeatures(canonical, meta.features);
    const picked = applyExtendPick(filtered, meta.features, meta.pick, meta.name);
    merged = mergeCanonicalFiles(merged, picked);
  }
  return merged;
}
