/**
 * Continue agent files: `.continue/agents/<name>.md` — the same format at both
 * scopes. `ConfigHandler.getLocalProfiles` scans the agents folder for YAML only
 * (`fileExtType: 'yaml'`), and `getDotContinueSubDirs` adds `~/.continue/agents`
 * to that same scan under `includeGlobal`, so YAML there is an *assistant
 * profile* at every scope, not an agent. Agent files are markdown and are loaded
 * by explicit path (`AgentFileService.getAgentFile` -> `path.resolve`), which is
 * location-independent; Continue's own repo ships `.continue/agents/*.md`.
 *
 * Continue parses them with `parseAgentFile` (packages/config-yaml/src/markdown/
 * agentFiles.ts): YAML frontmatter with a required `name` plus optional
 * `description`, `model`, `tools`, `rules`, and the markdown body as the prompt.
 * `tools` and `rules` are declared `z.string()` upstream, so they must be
 * comma-separated strings — a YAML list fails validation and Continue rejects
 * the whole file.
 *
 * Continue's frontmatter schema is a non-strict zod object, so the canonical
 * fields it has no concept of survive as inert frontmatter (stripped in
 * Continue's memory, preserved on disk for a lossless round-trip). `lintAgents`
 * names them so the loss of *behavior* is never silent.
 */

import type { CanonicalAgent } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import { CONTINUE_AGENTS_DIR } from './constants.js';

export function continueAgentFilePath(name: string): string {
  return `${CONTINUE_AGENTS_DIR}/${name}.md`;
}

export function serializeContinueAgentFile(agent: CanonicalAgent): string {
  const frontmatter: Record<string, unknown> = { name: agent.name };
  if (agent.description) frontmatter.description = agent.description;
  if (agent.model) frontmatter.model = agent.model;
  if (agent.tools.length > 0) frontmatter.tools = agent.tools.join(', ');

  if (agent.disallowedTools.length > 0) frontmatter.disallowedTools = agent.disallowedTools;
  if (agent.permissionMode) frontmatter.permissionMode = agent.permissionMode;
  if (agent.maxTurns > 0) frontmatter.maxTurns = agent.maxTurns;
  if (agent.mcpServers.length > 0) frontmatter.mcpServers = agent.mcpServers;
  if (Object.keys(agent.hooks).length > 0) frontmatter.hooks = agent.hooks;
  if (agent.skills.length > 0) frontmatter.skills = agent.skills;
  if (agent.memory) frontmatter.memory = agent.memory;

  return serializeFrontmatter(frontmatter, agent.body.trim());
}
