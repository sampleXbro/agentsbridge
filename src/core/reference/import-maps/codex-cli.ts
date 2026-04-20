import {
  addScopedAgentsMappings,
  addSimpleFileMapping,
  addSkillLikeMapping,
  listFiles,
  rel,
} from '../import-map-shared.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_RULES } from './constants.js';

export async function buildCodexCliImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set('.codex/AGENTS.md', `${AB_RULES}/_root.md`);
    refs.set('.codex/AGENTS.override.md', `${AB_RULES}/_root.md`);
  } else {
    refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
    refs.set('codex.md', `${AB_RULES}/_root.md`);
    await addScopedAgentsMappings(refs, projectRoot);
  }
  if (scope === 'project') {
    for (const absPath of await listFiles(projectRoot, '.codex/instructions')) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
  }
  for (const absPath of await listFiles(projectRoot, '.codex/rules')) {
    const relPath = rel(projectRoot, absPath);
    if (relPath.endsWith('.rules')) {
      addSimpleFileMapping(refs, relPath, AB_RULES, '.rules');
    } else if (relPath.endsWith('.md')) {
      addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
    }
  }
  for (const absPath of await listFiles(projectRoot, '.codex/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.toml');
  }
  for (const absPath of await listFiles(projectRoot, '.agents/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.agents/skills');
  }
}
