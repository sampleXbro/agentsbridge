import { basename, posix } from 'node:path';
import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_AGENTS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
  DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
  DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
  DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR,
  DEEPAGENTS_CLI_GLOBAL_MCP_FILE,
} from '../../../targets/deepagents-cli/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES, AB_AGENTS } from './constants.js';

/**
 * Maps `{agentsDir}/{name}/AGENTS.md` -> canonical `.agentsmesh/agents/{name}.md`.
 * Deep Agents subagents nest one AGENTS.md per directory (unlike Claude Code /
 * Codex CLI's flat `{name}.md` / `{name}.toml`), so this is bespoke rather
 * than reusing `addSkillLikeMapping` (which only recognizes `SKILL.md`).
 */
function addAgentDirMapping(refs: Map<string, string>, relPath: string, agentsDir: string): void {
  if (!relPath.startsWith(`${agentsDir}/`)) return;
  const rest = relPath.slice(agentsDir.length + 1);
  if (basename(rest) !== 'AGENTS.md') return;
  const name = basename(posix.dirname(rest));
  if (!name || name === '.') return;
  refs.set(relPath, `${AB_AGENTS}/${name}.md`);
}

export async function buildDeepagentsCliImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(DEEPAGENTS_CLI_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR);
    }
    for (const absPath of await listFiles(projectRoot, DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR)) {
      addAgentDirMapping(refs, rel(projectRoot, absPath), DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR);
    }
    refs.set(DEEPAGENTS_CLI_GLOBAL_MCP_FILE, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(DEEPAGENTS_CLI_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, DEEPAGENTS_CLI_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), DEEPAGENTS_CLI_SKILLS_DIR);
  }
  for (const absPath of await listFiles(projectRoot, DEEPAGENTS_CLI_AGENTS_DIR)) {
    addAgentDirMapping(refs, rel(projectRoot, absPath), DEEPAGENTS_CLI_AGENTS_DIR);
  }
  refs.set(DEEPAGENTS_CLI_MCP_FILE, '.agentsmesh/mcp.json');
}
