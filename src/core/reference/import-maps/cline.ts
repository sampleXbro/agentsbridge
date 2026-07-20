import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';
import { pathApi } from '../../path-helpers.js';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  CLINE_AGENTS_DIR,
  CLINE_AGENTS_FILE,
  CLINE_GLOBAL_RULES_DIR,
  CLINE_GLOBAL_WORKFLOWS_DIR,
  CLINE_GLOBAL_SKILLS_DIR,
  CLINE_RULES_DIR,
  CLINE_SKILLS_DIR,
  CLINE_WORKFLOWS_DIR,
} from '../../../targets/cline/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

/**
 * Add import path mappings for `.cline/agents.yaml` (the combined YAML file
 * that all agents are generated into). Reads the YAML, extracts agent names,
 * and maps the combined file path to each canonical agent's `.agentsmesh/agents/<name>.md`.
 * When multiple agents exist the last entry wins in the Map — this is a
 * best-effort for cross-file link rewriting; the actual agent files are
 * materialised correctly by importClineAgents regardless.
 */
async function addClineAgentsYamlMappings(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  const agentsYamlPath = pathApi(projectRoot).join(projectRoot, CLINE_AGENTS_FILE);
  const content = await readFile(agentsYamlPath, 'utf-8').catch(() => null);
  if (content === null) return;
  let parsed: unknown;
  try {
    parsed = yamlParse(content);
  } catch {
    return;
  }
  const agents = (parsed as { agents?: unknown } | null)?.agents;
  if (!Array.isArray(agents)) return;
  for (const agent of agents) {
    if (!agent || typeof agent !== 'object') continue;
    const name = (agent as Record<string, unknown>).name;
    if (typeof name === 'string' && name) {
      refs.set(CLINE_AGENTS_FILE, `${AB_AGENTS}/${name}.md`);
    }
  }
}

export async function buildClineImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    for (const absPath of await listFiles(projectRoot, CLINE_GLOBAL_RULES_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, CLINE_GLOBAL_WORKFLOWS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, CLINE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), CLINE_GLOBAL_SKILLS_DIR);
    }
    return;
  }

  refs.set(`${CLINE_RULES_DIR}/_root.md`, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, CLINE_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (!relPath.endsWith('.md') || basename(relPath) === '_root.md') {
      continue;
    }
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, CLINE_WORKFLOWS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  // Primary agents format: combined `.cline/agents.yaml` (current)
  await addClineAgentsYamlMappings(refs, projectRoot);
  // Fallback: legacy per-agent `.cline/agents/<name>.md` directory format
  for (const absPath of await listFiles(projectRoot, CLINE_AGENTS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, CLINE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), CLINE_SKILLS_DIR);
  }
}
