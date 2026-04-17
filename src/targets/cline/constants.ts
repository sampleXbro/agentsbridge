/**
 * Cline target constants.
 * Cline uses .clinerules (rules), .clineignore, .cline/cline_mcp_settings.json, .cline/skills (skills).
 */

export const CLINE_TARGET = 'cline';

/** Rules directory (all rules as .md) */
export const CLINE_RULES_DIR = '.clinerules';

/** Ignore file path */
export const CLINE_IGNORE = '.clineignore';

/** MCP settings (Cline-specific path) */
export const CLINE_MCP_SETTINGS = '.cline/cline_mcp_settings.json';
export const CLINE_MCP_SETTINGS_LEGACY = '.cline/mcp_settings.json';

/** Skills directory prefix */
export const CLINE_SKILLS_DIR = '.cline/skills';

/** Workflows directory (.clinerules/workflows/*.md → canonical commands) */
export const CLINE_WORKFLOWS_DIR = '.clinerules/workflows';

/** Root compatibility file (Cline cross-tool; same content as root rule) */
export const CLINE_AGENTS_MD = 'AGENTS.md';

/** Hooks directory (.clinerules/hooks/*.sh → canonical hooks) */
export const CLINE_HOOKS_DIR = '.clinerules/hooks';

/** Global rules directory: ~/Documents/Cline/Rules/ */
export const CLINE_GLOBAL_RULES_DIR = 'Documents/Cline/Rules';
/** Global workflows directory: ~/Documents/Cline/Workflows/ */
export const CLINE_GLOBAL_WORKFLOWS_DIR = 'Documents/Cline/Workflows';
/** Global hooks directory: ~/Documents/Cline/Hooks/ */
export const CLINE_GLOBAL_HOOKS_DIR = 'Documents/Cline/Hooks';

export const CLINE_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const CLINE_CANONICAL_COMMANDS_DIR = '.agentsmesh/commands';
export const CLINE_CANONICAL_IGNORE = '.agentsmesh/ignore';
export const CLINE_CANONICAL_MCP = '.agentsmesh/mcp.json';
export const CLINE_CANONICAL_AGENTS_DIR = '.agentsmesh/agents';
export const CLINE_CANONICAL_SKILLS_DIR = '.agentsmesh/skills';
