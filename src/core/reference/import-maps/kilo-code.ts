import { basename } from 'node:path';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  KILO_CODE_ROOT_RULE,
  KILO_CODE_RULES_DIR,
  KILO_CODE_COMMANDS_DIR,
  KILO_CODE_AGENTS_DIR,
  KILO_CODE_SKILLS_DIR,
  KILO_CODE_MCP_FILE,
  KILO_CODE_LEGACY_RULES_DIR,
  KILO_CODE_LEGACY_WORKFLOWS_DIR,
  KILO_CODE_LEGACY_SKILLS_DIR,
  KILO_CODE_LEGACY_MCP_FILE,
  KILO_CODE_GLOBAL_AGENTS_MD,
  KILO_CODE_GLOBAL_RULES_DIR,
  KILO_CODE_GLOBAL_COMMANDS_DIR,
  KILO_CODE_GLOBAL_AGENTS_DIR,
  KILO_CODE_GLOBAL_SKILLS_DIR,
  KILO_CODE_GLOBAL_MCP_FILE,
} from '../../../targets/kilo-code/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

/**
 * Build the canonical ↔ kilo-code path map used by reference rewriting on
 * generate (canonical → target) and import (target → canonical).
 *
 * Project scope covers BOTH new and legacy paths so links inside imported
 * legacy artifacts (`.kilocode/...`) collapse back to canonical form.
 */
export async function buildKiloCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(KILO_CODE_GLOBAL_AGENTS_MD, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, KILO_CODE_GLOBAL_RULES_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, KILO_CODE_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, KILO_CODE_GLOBAL_AGENTS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, KILO_CODE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), KILO_CODE_GLOBAL_SKILLS_DIR);
    }
    refs.set(KILO_CODE_GLOBAL_MCP_FILE, '.agentsmesh/mcp.json');
    return;
  }

  // Project scope — new layout
  refs.set(KILO_CODE_ROOT_RULE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, KILO_CODE_RULES_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KILO_CODE_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KILO_CODE_AGENTS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KILO_CODE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), KILO_CODE_SKILLS_DIR);
  }
  refs.set(KILO_CODE_MCP_FILE, '.agentsmesh/mcp.json');

  // Project scope — legacy layout (so links inside imported legacy artifacts
  // also collapse back to canonical paths).
  for (const absPath of await listFiles(projectRoot, KILO_CODE_LEGACY_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (basename(relPath) === '00-root.md') {
      refs.set(relPath, `${AB_RULES}/_root.md`);
      continue;
    }
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KILO_CODE_LEGACY_WORKFLOWS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KILO_CODE_LEGACY_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), KILO_CODE_LEGACY_SKILLS_DIR);
  }
  refs.set(KILO_CODE_LEGACY_MCP_FILE, '.agentsmesh/mcp.json');
}
