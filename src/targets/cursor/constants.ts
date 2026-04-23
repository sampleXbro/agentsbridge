// Cursor target constants

export const CURSOR_TARGET = 'cursor';

export const CURSOR_COMPAT_AGENTS = 'AGENTS.md';
export const CURSOR_LEGACY_RULES = '.cursorrules';
export const CURSOR_RULES_DIR = '.cursor/rules';
export const CURSOR_GENERAL_RULE = `${CURSOR_RULES_DIR}/general.mdc`;
export const CURSOR_COMMANDS_DIR = '.cursor/commands';
export const CURSOR_AGENTS_DIR = '.cursor/agents';
export const CURSOR_SKILLS_DIR = '.cursor/skills';
export const CURSOR_MCP = '.cursor/mcp.json';
export const CURSOR_HOOKS = '.cursor/hooks.json';
export const CURSOR_SETTINGS = '.cursor/settings.json';
export const CURSOR_IGNORE = '.cursorignore';
export const CURSOR_INDEXING_IGNORE = '.cursorindexingignore';

/** Legacy global merged rules path (import still reads this when present). */
export const CURSOR_GLOBAL_EXPORT_DIR = '.agentsmesh-exports/cursor';
export const CURSOR_GLOBAL_USER_RULES = `${CURSOR_GLOBAL_EXPORT_DIR}/user-rules.md`;
/** Cross-tool aggregate under `~/.cursor/` (see docs/agent-structures/cursor-global-level-generation-strategy.md). */
export const CURSOR_DOT_CURSOR_AGENTS = '.cursor/AGENTS.md';
/** Global Cursor uses the same paths as project mode under `$HOME` for tooling Cursor loads from `~/.cursor/`. */
export const CURSOR_GLOBAL_MCP_EXPORT = CURSOR_MCP;
export const CURSOR_GLOBAL_SKILLS_DIR = CURSOR_SKILLS_DIR;
export const CURSOR_GLOBAL_AGENTS_DIR = CURSOR_AGENTS_DIR;

export const CURSOR_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const CURSOR_CANONICAL_COMMANDS_DIR = '.agentsmesh/commands';
export const CURSOR_CANONICAL_AGENTS_DIR = '.agentsmesh/agents';
export const CURSOR_CANONICAL_SKILLS_DIR = '.agentsmesh/skills';
export const CURSOR_CANONICAL_MCP = '.agentsmesh/mcp.json';
export const CURSOR_CANONICAL_PERMISSIONS = '.agentsmesh/permissions.yaml';
export const CURSOR_CANONICAL_HOOKS = '.agentsmesh/hooks.yaml';
export const CURSOR_CANONICAL_IGNORE = '.agentsmesh/ignore';
