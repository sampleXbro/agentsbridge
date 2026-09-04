/**
 * Gemini CLI layouts for both scopes.
 *
 * Project writes into the repo (`GEMINI.md`, `.gemini/…`); global rewrites the
 * same relative paths under `~/.gemini/`. `.geminiignore` is project-only, so the
 * global layout suppresses it; user-tier policies ARE loaded by the engine and
 * keep their path.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import {
  GEMINI_ROOT,
  GEMINI_COMPAT_AGENTS,
  GEMINI_COMMANDS_DIR,
  GEMINI_AGENTS_DIR,
  GEMINI_GLOBAL_ROOT,
  GEMINI_GLOBAL_COMPAT_AGENTS,
  GEMINI_GLOBAL_SETTINGS,
  GEMINI_GLOBAL_COMMANDS_DIR,
  GEMINI_GLOBAL_SKILLS_DIR,
  GEMINI_GLOBAL_AGENTS_DIR,
  GEMINI_GLOBAL_POLICIES_FILE,
  GEMINI_SETTINGS,
} from './constants.js';

/** Namespaced command files nest under their `:`-separated segments. */
function commandPathIn(dir: string, name: string): string {
  if (!name.includes(':')) return `${dir}/${name}.toml`;
  const parts = name.split(':').filter(Boolean);
  const fileBase = parts.pop() ?? name;
  return `${dir}/${parts.join('/')}/${fileBase}.toml`;
}

export const projectLayout: TargetLayout = {
  rootInstructionPath: GEMINI_ROOT,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [GEMINI_COMPAT_AGENTS] },
  ],
  extraRuleOutputPaths() {
    return [GEMINI_COMPAT_AGENTS];
  },
  skillDir: '.gemini/skills',
  managedOutputs: {
    dirs: ['.gemini/agents', '.gemini/commands', '.gemini/skills', '.agents/skills'],
    files: ['AGENTS.md', 'GEMINI.md', '.geminiignore'],
    // Gemini CLI's own settings file (theme, auth, context.fileName);
    // agentsmesh owns only mcpServers / hooks / experimental / context.
    // `.gemini/policies/` is the tool's own policy dir: agentsmesh owns only the
    // `[[rule]]` blocks it marked, so the file is never deleted or rewritten
    // whole — including the workspace-tier copy an older agentsmesh emitted.
    coOwnedFiles: ['.gemini/settings.json', '.gemini/policies/permissions.toml'],
  },
  // `AGENTS.md` rewrites skill links to `.agents/skills/…` for cross-tool compatibility; mirror
  // project skills there so link validation and consumers see real files (same as global layout).
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, '.gemini/skills', activeTargets);
  },
  paths: {
    rulePath(_slug, _rule) {
      return GEMINI_ROOT;
    },
    commandPath(name, _config) {
      return commandPathIn(GEMINI_COMMANDS_DIR, name);
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'gemini-cli')
        ? `.gemini/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : `${GEMINI_AGENTS_DIR}/${name}.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: GEMINI_GLOBAL_ROOT,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [GEMINI_GLOBAL_COMPAT_AGENTS] },
  ],
  extraRuleOutputPaths() {
    return [GEMINI_GLOBAL_COMPAT_AGENTS];
  },
  skillDir: GEMINI_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [GEMINI_GLOBAL_COMMANDS_DIR, GEMINI_GLOBAL_SKILLS_DIR, GEMINI_GLOBAL_AGENTS_DIR],
    files: [GEMINI_GLOBAL_ROOT, GEMINI_GLOBAL_COMPAT_AGENTS],
    coOwnedFiles: [GEMINI_GLOBAL_SETTINGS, GEMINI_GLOBAL_POLICIES_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === GEMINI_ROOT) return GEMINI_GLOBAL_ROOT;
    if (path === GEMINI_COMPAT_AGENTS) return GEMINI_GLOBAL_COMPAT_AGENTS;
    if (path === GEMINI_SETTINGS) return GEMINI_GLOBAL_SETTINGS;
    if (path.startsWith(`${GEMINI_COMMANDS_DIR}/`)) {
      return path.replace(`${GEMINI_COMMANDS_DIR}/`, `${GEMINI_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith('.gemini/skills/')) {
      return path.replace('.gemini/skills/', `${GEMINI_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${GEMINI_AGENTS_DIR}/`)) {
      return path.replace(`${GEMINI_AGENTS_DIR}/`, `${GEMINI_GLOBAL_AGENTS_DIR}/`);
    }
    // User-tier policies ARE loaded by the engine globally; only ignore is suppressed.
    if (path === '.geminiignore') return null;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, GEMINI_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(_slug, _rule) {
      // Global mode uses single instructions file, not per-rule files
      return GEMINI_GLOBAL_ROOT;
    },
    commandPath(name, _config) {
      return commandPathIn(GEMINI_GLOBAL_COMMANDS_DIR, name);
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'gemini-cli')
        ? `${GEMINI_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`
        : `${GEMINI_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};
