import { basename } from 'node:path';
import type { CanonicalFiles } from './types.js';
import type { ValidatedConfig } from '../config/schema.js';
import { addSkillDirectoryMappings } from './reference-map-directories.js';
import {
  ruleTargetPath,
  commandTargetPath,
  agentTargetPath,
  SKILL_DIRS,
} from './reference-map-targets.js';
import { AGENTS_MD } from '../targets/codex-cli/constants.js';
import { GEMINI_ROOT } from '../targets/gemini-cli/constants.js';
import { WINDSURF_AGENTS_MD, WINDSURF_RULES_ROOT } from '../targets/windsurf/constants.js';

export function isMarkdownLikeOutput(path: string): boolean {
  return (
    path.endsWith('.md') ||
    path.endsWith('.mdc') ||
    path === '.claude/CLAUDE.md' ||
    path === AGENTS_MD ||
    path === GEMINI_ROOT ||
    path === WINDSURF_AGENTS_MD ||
    path === WINDSURF_RULES_ROOT
  );
}

function addDirectoryMapping(refs: Map<string, string>, from: string, to: string): void {
  refs.set(from, to);
  refs.set(`${from}/`, `${to}/`);
}

export function buildReferenceMap(
  target: string,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
): Map<string, string> {
  const refs = new Map<string, string>();

  for (const rule of canonical.rules) {
    const path = ruleTargetPath(target, rule);
    if (path) refs.set(`.agentsmesh/rules/${basename(rule.source)}`, path);
  }

  for (const command of canonical.commands) {
    const path = commandTargetPath(target, command.name, config);
    if (path) refs.set(`.agentsmesh/commands/${command.name}.md`, path);
  }

  for (const agent of canonical.agents) {
    const path = agentTargetPath(target, agent.name, config);
    if (path) refs.set(`.agentsmesh/agents/${agent.name}.md`, path);
  }

  const skillDir = SKILL_DIRS[target];
  if (!skillDir) return refs;

  for (const skill of canonical.skills) {
    addDirectoryMapping(refs, `.agentsmesh/skills/${skill.name}`, `${skillDir}/${skill.name}`);
    refs.set(`.agentsmesh/skills/${skill.name}/SKILL.md`, `${skillDir}/${skill.name}/SKILL.md`);
    for (const file of skill.supportingFiles) {
      const relativePath = file.relativePath.replace(/\\/g, '/');
      const canonicalPath = `.agentsmesh/skills/${skill.name}/${relativePath}`;
      const targetPath = `${skillDir}/${skill.name}/${relativePath}`;
      refs.set(canonicalPath, targetPath);
      addSkillDirectoryMappings(refs, canonicalPath, targetPath);
    }
  }

  return refs;
}
