/**
 * Antigravity subagent frontmatter (antigravity.google/docs/subagents/ and
 * antigravity.google/docs/cli/commands/agents/).
 *
 * `name` and `description` are required; `tools`, `model`, `subagent`,
 * `mainAgent`, `commandExecutionPolicy`, `skills` and `plugins` are optional.
 * Canonical fields with no Antigravity key are still written as inert
 * frontmatter so `generate -> import` round-trips without data loss; `lintAgents`
 * names them so users know Antigravity itself ignores them.
 */

import type { CanonicalAgent } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';

/** Canonical agent fields Antigravity's frontmatter schema has no concept of. */
export const ANTIGRAVITY_DROPPED_AGENT_FIELDS: readonly (keyof CanonicalAgent)[] = [
  'disallowedTools',
  'permissionMode',
  'maxTurns',
  'mcpServers',
  'hooks',
  'memory',
];

export function hasAgentValue(agent: CanonicalAgent, field: keyof CanonicalAgent): boolean {
  const value = agent[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

export function serializeAntigravityAgent(agent: CanonicalAgent): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description,
  };
  if (agent.tools.length > 0) frontmatter.tools = agent.tools;
  if (agent.model) frontmatter.model = agent.model;
  if (agent.skills.length > 0) frontmatter.skills = agent.skills;
  for (const field of ANTIGRAVITY_DROPPED_AGENT_FIELDS) {
    if (hasAgentValue(agent, field)) frontmatter[field] = agent[field];
  }
  return serializeFrontmatter(frontmatter, agent.body.trim() || '');
}

/**
 * Canonical filename for an agent file found under a scanned agents directory.
 * Project scope is flat (`<name>.md`); global scope nests one directory per
 * agent (`<name>/agent.md`) and also accepts the flat form. Anything else in an
 * agent directory (checklists, references) is not an agent — `null` skips it.
 */
export function canonicalAgentFileName(relativePath: string): string | null {
  const segments = relativePath.split('/');
  if (segments.length === 1) return segments[0]!;
  if (segments.length === 2 && segments[1] === 'agent.md') return `${segments[0]}.md`;
  return null;
}
