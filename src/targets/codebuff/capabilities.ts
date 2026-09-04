/** Codebuff capability declarations per scope. */

import type { TargetCapabilities } from '../catalog/target.interface.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  // Codebuff walks the project tree and loads one knowledge file per directory,
  // so scoped rules get a real `<dir>/AGENTS.md` instead of being embedded.
  additionalRules: 'native',
  // No user-authorable slash-command format; commands project as skills.
  commands: 'embedded',
  // Executable TypeScript modules, not config — agentsmesh cannot emit code.
  agents: 'partial',
  skills: 'native',
  mcp: 'native',
  // File-change hooks come from the embedding client at runtime, not a file.
  hooks: 'partial',
  ignore: 'native',
  // Only expressible as `toolNames` / `spawnableAgents` inside an agent module.
  permissions: 'partial',
};

export const globalCapabilities: TargetCapabilities = {
  ...projectCapabilities,
  // `~/.AGENTS.md` is the only knowledge file the home directory contributes
  // (`loadUserKnowledgeFiles`), so scoped rules embed into it.
  additionalRules: 'embedded',
  // `PROJECT_IGNORE_FILES` are resolved per project; there is no `~/.codebuffignore`.
  ignore: 'none',
};
