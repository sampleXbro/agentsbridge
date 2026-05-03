/**
 * OpenCode target constants.
 *
 * OpenCode is an open-source AI coding agent (CLI/TUI) at opencode.ai.
 *
 *   - **Project config**: `.opencode/` + `opencode.json` at project root + `AGENTS.md`
 *   - **Global config**: `~/.config/opencode/` + `opencode.json`
 *
 * OpenCode natively supports commands, agents, and skills in `.opencode/`.
 * Additional rules are generated to `.opencode/rules/` — users reference them
 * via the `instructions` array in `opencode.json`.
 *
 * MCP is configured in `opencode.json` under the `mcp` key.
 * Hooks are plugin-based (TypeScript/JavaScript), not config-based.
 * Permissions live in `opencode.json` but are not generated in v1.
 */

export const OPENCODE_TARGET = 'opencode';

// Project-level paths
export const OPENCODE_DIR = '.opencode';
export const OPENCODE_ROOT_RULE = 'AGENTS.md';
export const OPENCODE_RULES_DIR = `${OPENCODE_DIR}/rules`;
export const OPENCODE_COMMANDS_DIR = `${OPENCODE_DIR}/commands`;
export const OPENCODE_AGENTS_DIR = `${OPENCODE_DIR}/agents`;
export const OPENCODE_SKILLS_DIR = `${OPENCODE_DIR}/skills`;
export const OPENCODE_CONFIG_FILE = 'opencode.json';

// Global-level paths (~/.config/opencode/)
export const OPENCODE_GLOBAL_DIR = '.config/opencode';
export const OPENCODE_GLOBAL_AGENTS_MD = `${OPENCODE_GLOBAL_DIR}/AGENTS.md`;
export const OPENCODE_GLOBAL_RULES_DIR = `${OPENCODE_GLOBAL_DIR}/rules`;
export const OPENCODE_GLOBAL_COMMANDS_DIR = `${OPENCODE_GLOBAL_DIR}/commands`;
export const OPENCODE_GLOBAL_AGENTS_DIR = `${OPENCODE_GLOBAL_DIR}/agents`;
export const OPENCODE_GLOBAL_SKILLS_DIR = `${OPENCODE_GLOBAL_DIR}/skills`;
export const OPENCODE_GLOBAL_CONFIG_FILE = `${OPENCODE_GLOBAL_DIR}/opencode.json`;

/** Cross-agent compatibility mirror for skills. */
export const OPENCODE_GLOBAL_AGENTS_SKILLS_DIR = '.agents/skills';

// Canonical paths
export const OPENCODE_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const OPENCODE_CANONICAL_COMMANDS_DIR = '.agentsmesh/commands';
export const OPENCODE_CANONICAL_AGENTS_DIR = '.agentsmesh/agents';
export const OPENCODE_CANONICAL_MCP = '.agentsmesh/mcp.json';
