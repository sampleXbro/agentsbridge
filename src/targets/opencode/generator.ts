/**
 * Generate OpenCode target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`                    — root rule
 *   - `.opencode/rules/<slug>.md`    — additional rules (with optional frontmatter)
 *   - `.opencode/commands/<name>.md` — slash commands (with optional frontmatter)
 *   - `.opencode/agents/<slug>.md`   — custom agents (with YAML frontmatter)
 *   - `.opencode/skills/`            — skill bundles
 *   - `opencode.json`               — MCP servers under `mcp` key
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import type { McpServer } from '../../core/mcp-types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  OPENCODE_TARGET,
  OPENCODE_ROOT_RULE,
  OPENCODE_RULES_DIR,
  OPENCODE_COMMANDS_DIR,
  OPENCODE_AGENTS_DIR,
  OPENCODE_SKILLS_DIR,
  OPENCODE_CONFIG_FILE,
} from './constants.js';

export interface OpenCodeOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): OpenCodeOutput[] {
  const outputs: OpenCodeOutput[] = [];
  const root = canonical.rules.find((rule) => rule.root);

  if (root) {
    outputs.push({
      path: OPENCODE_ROOT_RULE,
      content: root.body.trim() ? root.body : '',
    });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes(OPENCODE_TARGET)) continue;
    const slug = basename(rule.source, '.md');
    const frontmatter: Record<string, unknown> = {};
    if (rule.description) frontmatter.description = rule.description;
    if (rule.globs.length > 0) frontmatter.globs = rule.globs;
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, rule.body.trim() || '')
        : rule.body.trim() || '';
    outputs.push({
      path: `${OPENCODE_RULES_DIR}/${slug}.md`,
      content,
    });
  }

  return outputs;
}

export function generateCommands(canonical: CanonicalFiles): OpenCodeOutput[] {
  return canonical.commands.map((command) => {
    const frontmatter: Record<string, unknown> = {};
    if (command.description) frontmatter.description = command.description;
    return {
      path: `${OPENCODE_COMMANDS_DIR}/${command.name}.md`,
      content: serializeFrontmatter(frontmatter, command.body.trim() || ''),
    };
  });
}

export function generateAgents(canonical: CanonicalFiles): OpenCodeOutput[] {
  return canonical.agents.map((agent) => {
    const slug = basename(agent.source, '.md');
    const frontmatter: Record<string, unknown> = { mode: 'subagent' };
    if (agent.description) frontmatter.description = agent.description;
    if (agent.model) frontmatter.model = agent.model;
    if (agent.tools.length > 0) frontmatter.tools = agent.tools;
    if (agent.disallowedTools.length > 0) frontmatter.disallowedTools = agent.disallowedTools;
    return {
      path: `${OPENCODE_AGENTS_DIR}/${slug}.md`,
      content: serializeFrontmatter(frontmatter, agent.body.trim() || ''),
    };
  });
}

function toOpenCodeMcpServer(server: McpServer): Record<string, unknown> {
  if ('url' in server) {
    const entry: Record<string, unknown> = { type: 'remote', url: server.url };
    if (Object.keys(server.headers).length > 0) entry.headers = server.headers;
    if (server.description) entry.description = server.description;
    return entry;
  }
  const entry: Record<string, unknown> = {
    type: 'local',
    command: [server.command, ...server.args],
  };
  if (Object.keys(server.env).length > 0) entry.environment = server.env;
  if (server.description) entry.description = server.description;
  return entry;
}

export function generateMcp(canonical: CanonicalFiles): OpenCodeOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const mcpEntries: Record<string, Record<string, unknown>> = {};
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    mcpEntries[name] = toOpenCodeMcpServer(server);
  }
  return [
    {
      path: OPENCODE_CONFIG_FILE,
      content: JSON.stringify({ mcp: mcpEntries }, null, 2),
    },
  ];
}

export function generateSkills(canonical: CanonicalFiles): OpenCodeOutput[] {
  return generateEmbeddedSkills(canonical, OPENCODE_SKILLS_DIR);
}
