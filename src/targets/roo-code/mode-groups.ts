/**
 * Maps canonical agent tool lists to Roo Code custom-mode `groups`.
 *
 * Roo Code's `modeConfigSchema` (packages/types/src/mode.ts) requires
 * `groups: groupEntryArraySchema` — there is no default, and
 * `CustomModesManager.loadModesFromFile()` drops ALL modes in `.roomodes` (or
 * `custom_modes.yaml`) when the file fails schema validation. Every generated
 * mode MUST carry a valid `groups` array.
 *
 * Current valid groups (packages/types/src/tool.ts `toolGroups`): read, edit,
 * command, mcp, modes. `browser` was removed and is now silently stripped by
 * Roo's schema preprocessing, so it is intentionally excluded here.
 */

import type { CanonicalAgent } from '../../core/canonical-types.js';

export type RooModeGroup = 'read' | 'edit' | 'command' | 'mcp' | 'modes';

/** Roo Code's own built-in "code" mode (general-purpose default) groups —
 * used as the safe default when canonical data gives no tool restriction. */
export const ROO_CODE_DEFAULT_MODE_GROUPS: readonly RooModeGroup[] = [
  'read',
  'edit',
  'command',
  'mcp',
];

const GROUP_ORDER: readonly RooModeGroup[] = ['read', 'edit', 'command', 'mcp', 'modes'];

const READ_KEYWORDS = ['read', 'grep', 'glob', 'list', 'search'];
const EDIT_KEYWORDS = ['write', 'edit', 'apply_diff', 'apply_patch', 'notebookedit'];
const COMMAND_KEYWORDS = ['bash', 'shell', 'command', 'execute'];
const MCP_KEYWORDS = ['mcp'];
const MODE_KEYWORDS = ['switch_mode', 'switchmode', 'new_task'];

function classifyTool(tool: string): RooModeGroup | null {
  const lower = tool.toLowerCase();
  if (MCP_KEYWORDS.some((k) => lower.includes(k))) return 'mcp';
  if (MODE_KEYWORDS.some((k) => lower.includes(k))) return 'modes';
  if (COMMAND_KEYWORDS.some((k) => lower.includes(k))) return 'command';
  if (EDIT_KEYWORDS.some((k) => lower.includes(k))) return 'edit';
  if (READ_KEYWORDS.some((k) => lower.includes(k))) return 'read';
  return null;
}

/**
 * Derive a Roo Code `groups` array from a canonical agent's `tools`. Falls
 * back to Roo's own built-in "code" mode default groups when the agent
 * specifies no tools, or when none of its tools map to a known group.
 */
export function mapAgentToolsToRooGroups(agent: Pick<CanonicalAgent, 'tools'>): RooModeGroup[] {
  if (agent.tools.length === 0) return [...ROO_CODE_DEFAULT_MODE_GROUPS];
  const mapped = new Set<RooModeGroup>();
  for (const tool of agent.tools) {
    const group = classifyTool(tool);
    if (group) mapped.add(group);
  }
  if (mapped.size === 0) return [...ROO_CODE_DEFAULT_MODE_GROUPS];
  return GROUP_ORDER.filter((g) => mapped.has(g));
}
