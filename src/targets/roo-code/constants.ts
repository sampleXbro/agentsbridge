export const ROO_CODE_TARGET = 'roo-code';

// Project-level paths
export const ROO_CODE_DIR = '.roo';
export const ROO_CODE_ROOT_RULE = `${ROO_CODE_DIR}/rules/00-root.md`;
/** Flat-file fallback read during import when .roo/rules/00-root.md is absent */
export const ROO_CODE_ROOT_RULE_FALLBACK = '.roorules';
export const ROO_CODE_RULES_DIR = `${ROO_CODE_DIR}/rules`;
export const ROO_CODE_COMMANDS_DIR = `${ROO_CODE_DIR}/commands`;
export const ROO_CODE_SKILLS_DIR = `${ROO_CODE_DIR}/skills`;
export const ROO_CODE_MCP_FILE = `${ROO_CODE_DIR}/mcp.json`;
export const ROO_CODE_IGNORE = '.rooignore';

/** Project-level custom modes file (canonical agents → Roo custom modes). */
export const ROO_CODE_MODES_FILE = '.roomodes';
/** Global-level custom modes file (~/.roo/settings/custom_modes.yaml). */
export const ROO_CODE_GLOBAL_MODES_FILE = 'settings/custom_modes.yaml';

// Global-level paths (~/.roo/)
export const ROO_CODE_GLOBAL_DIR = '.roo';
export const ROO_CODE_GLOBAL_RULES_DIR = `${ROO_CODE_GLOBAL_DIR}/rules`;
export const ROO_CODE_GLOBAL_COMMANDS_DIR = `${ROO_CODE_GLOBAL_DIR}/commands`;
export const ROO_CODE_GLOBAL_SKILLS_DIR = `${ROO_CODE_GLOBAL_DIR}/skills`;
export const ROO_CODE_GLOBAL_MCP_FILE = 'mcp_settings.json';
export const ROO_CODE_GLOBAL_IGNORE = '.rooignore';
export const ROO_CODE_GLOBAL_AGENTS_MD = `${ROO_CODE_GLOBAL_DIR}/AGENTS.md`;

// Cross-agent compatibility mirror
export const ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR = '.agents/skills';

export const ROO_CODE_CANONICAL_ROOT_RULE = '.agentsmesh/rules/_root.md';
export const ROO_CODE_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const ROO_CODE_CANONICAL_COMMANDS_DIR = '.agentsmesh/commands';
export const ROO_CODE_CANONICAL_MCP = '.agentsmesh/mcp.json';
export const ROO_CODE_CANONICAL_IGNORE = '.agentsmesh/ignore';
