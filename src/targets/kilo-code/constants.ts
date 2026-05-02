/**
 * Kilo Code target constants.
 *
 * Kilo Code is a fork of Roo Code (which is a fork of Cline). It supports
 * two parallel layouts simultaneously:
 *
 *   - **New** (`.kilo/...` + `AGENTS.md` + optional `kilo.jsonc`) — preferred.
 *     This is what agentsmesh GENERATES.
 *   - **Legacy** (`.kilocode/...` + `.kilocodemodes` + `.kilocodeignore`) —
 *     still loaded by the CLI / VS Code extension. agentsmesh IMPORTS from
 *     this layout for users migrating from earlier kilo or Roo-era setups.
 *
 * Hooks are not supported by kilo (no user-facing lifecycle hook system).
 * Permissions are out of scope for v1 because they require generating
 * `kilo.jsonc`.
 */

export const KILO_CODE_TARGET = 'kilo-code';

// Project-level paths — new layout (generated)
export const KILO_CODE_DIR = '.kilo';
export const KILO_CODE_ROOT_RULE = 'AGENTS.md';
export const KILO_CODE_RULES_DIR = `${KILO_CODE_DIR}/rules`;
export const KILO_CODE_COMMANDS_DIR = `${KILO_CODE_DIR}/commands`;
export const KILO_CODE_AGENTS_DIR = `${KILO_CODE_DIR}/agents`;
export const KILO_CODE_SKILLS_DIR = `${KILO_CODE_DIR}/skills`;
export const KILO_CODE_MCP_FILE = `${KILO_CODE_DIR}/mcp.json`;

/** Legacy ignore filename — still the only natively-loaded ignore file in kilo. */
export const KILO_CODE_IGNORE = '.kilocodeignore';

// Project-level paths — legacy layout (imported, never generated)
export const KILO_CODE_LEGACY_DIR = '.kilocode';
export const KILO_CODE_LEGACY_RULES_DIR = `${KILO_CODE_LEGACY_DIR}/rules`;
export const KILO_CODE_LEGACY_WORKFLOWS_DIR = `${KILO_CODE_LEGACY_DIR}/workflows`;
export const KILO_CODE_LEGACY_SKILLS_DIR = `${KILO_CODE_LEGACY_DIR}/skills`;
export const KILO_CODE_LEGACY_MCP_FILE = `${KILO_CODE_LEGACY_DIR}/mcp.json`;
export const KILO_CODE_LEGACY_MODES_FILE = '.kilocodemodes';

// Global-level paths (~/.kilo/)
export const KILO_CODE_GLOBAL_DIR = '.kilo';
export const KILO_CODE_GLOBAL_AGENTS_MD = `${KILO_CODE_GLOBAL_DIR}/AGENTS.md`;
export const KILO_CODE_GLOBAL_RULES_DIR = `${KILO_CODE_GLOBAL_DIR}/rules`;
export const KILO_CODE_GLOBAL_COMMANDS_DIR = `${KILO_CODE_GLOBAL_DIR}/commands`;
export const KILO_CODE_GLOBAL_AGENTS_DIR = `${KILO_CODE_GLOBAL_DIR}/agents`;
export const KILO_CODE_GLOBAL_SKILLS_DIR = `${KILO_CODE_GLOBAL_DIR}/skills`;
export const KILO_CODE_GLOBAL_MCP_FILE = `${KILO_CODE_GLOBAL_DIR}/mcp.json`;
export const KILO_CODE_GLOBAL_IGNORE = '.kilocodeignore';

/** Cross-agent compatibility mirror for skills (suppressed when codex-cli is active). */
export const KILO_CODE_GLOBAL_AGENTS_SKILLS_DIR = '.agents/skills';

// Canonical paths
export const KILO_CODE_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const KILO_CODE_CANONICAL_COMMANDS_DIR = '.agentsmesh/commands';
export const KILO_CODE_CANONICAL_AGENTS_DIR = '.agentsmesh/agents';
export const KILO_CODE_CANONICAL_MCP = '.agentsmesh/mcp.json';
export const KILO_CODE_CANONICAL_IGNORE = '.agentsmesh/ignore';
