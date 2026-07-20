/**
 * Maps canonical agent tool lists <-> OpenCode's agent `permission` object.
 *
 * OpenCode agent Markdown frontmatter has no `tools`/`disallowedTools` keys:
 * `tools` is deprecated ("Prefer the agent's permission field") and takes a
 * boolean-map shape, not a string array; `disallowedTools` does not exist at
 * all. Tool restriction is expressed via a `permission` object mapping named
 * categories (`read`, `edit`, `bash`, `glob`, `grep`, `task`, `skill`,
 * `webfetch`, `websearch`, `*`) to `'allow' | 'ask' | 'deny'`.
 * @see https://opencode.ai/docs/agents/
 * @see https://opencode.ai/docs/permissions/
 */

import type { CanonicalAgent } from '../../core/canonical-types.js';

export type OpenCodePermissionAction = 'allow' | 'ask' | 'deny';
export type OpenCodePermission = Record<string, OpenCodePermissionAction>;

const CATEGORY_KEYWORDS: readonly (readonly [string, readonly string[]])[] = [
  ['bash', ['bash', 'shell', 'command', 'execute']],
  ['edit', ['write', 'edit', 'patch']],
  ['webfetch', ['webfetch', 'fetch']],
  ['websearch', ['websearch']],
  ['grep', ['grep']],
  ['glob', ['glob']],
  ['task', ['task', 'subagent']],
  ['skill', ['skill']],
  ['read', ['read', 'view', 'list']],
];

function classifyTool(tool: string): string | null {
  const lower = tool.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return category;
  }
  return null;
}

/** Derive an OpenCode `permission` object from a canonical agent's tool lists. */
export function mapAgentToolsToOpenCodePermission(
  agent: Pick<CanonicalAgent, 'tools' | 'disallowedTools'>,
): OpenCodePermission {
  const permission: OpenCodePermission = {};
  if (agent.tools.length > 0) {
    permission['*'] = 'deny';
    for (const tool of agent.tools) {
      const category = classifyTool(tool);
      if (category) permission[category] = 'allow';
    }
  }
  for (const tool of agent.disallowedTools) {
    const category = classifyTool(tool);
    if (category) permission[category] = 'deny';
  }
  return permission;
}

/**
 * Recover approximate canonical tool lists from an imported OpenCode
 * `permission` object. Lossy by nature (categories, not original tool
 * names) but round-trips the *restriction*, which is what matters.
 */
export function mapOpenCodePermissionToAgentTools(
  value: unknown,
): Pick<CanonicalAgent, 'tools' | 'disallowedTools'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { tools: [], disallowedTools: [] };
  }
  const permission = value as Record<string, unknown>;
  const isAllowList = permission['*'] === 'deny';
  const tools: string[] = [];
  const disallowedTools: string[] = [];
  for (const [key, action] of Object.entries(permission)) {
    if (key === '*' || typeof action !== 'string') continue;
    if (action === 'deny') disallowedTools.push(key);
    else if (action === 'allow' && isAllowList) tools.push(key);
  }
  return { tools, disallowedTools };
}
