/**
 * Cline target constants.
 * Cline uses .clinerules (rules), .clineignore, .cline/mcp_settings.json, .cline/skills (skills).
 */

/** Rules directory (all rules as .md) */
export const CLINE_RULES_DIR = '.clinerules';

/** Ignore file path */
export const CLINE_IGNORE = '.clineignore';

/** MCP settings (Cline-specific path) */
export const CLINE_MCP_SETTINGS = '.cline/mcp_settings.json';

/** Skills directory prefix */
export const CLINE_SKILLS_DIR = '.cline/skills';

/** Workflows directory (.clinerules/workflows/*.md → canonical commands) */
export const CLINE_WORKFLOWS_DIR = '.clinerules/workflows';

/** Root compatibility file (Cline cross-tool; same content as root rule) */
export const CLINE_AGENTS_MD = 'AGENTS.md';

/** Hooks directory (.clinerules/hooks/*.sh → canonical hooks) */
export const CLINE_HOOKS_DIR = '.clinerules/hooks';
