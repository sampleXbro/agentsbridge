import type { TargetCapabilities } from '../catalog/target.interface.js';

/**
 * Both scopes support the same feature set: `~/.agents/` and `~/.openhands/`
 * mirror the project tree file for file, and only the root rule changes path.
 *
 * `ignore` is `none` — OpenHands publishes no ignore-file surface.
 *
 * `permissions` is `partial`. OpenHands has no allow/deny/ask file at all: the
 * only permission surface is `permission_mode` (`always_confirm`,
 * `never_confirm`, `confirm_risky` — subagent/schema.py), a per-subagent
 * confirmation policy that cannot express tool or path patterns, so a canonical
 * permission list has nowhere to go. Even the closest fit, per-agent frontmatter,
 * is off limits: `.agents/agents/<name>.md` is shared byte for byte with
 * antigravity (see constants.ts), so writing anything extra there would make the
 * two targets emit different bytes for one path and hard-fail every generate run
 * that enables both. `lintPermissions` names every dropped entry instead.
 */
export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'partial',
};

export const globalCapabilities: TargetCapabilities = { ...projectCapabilities };
