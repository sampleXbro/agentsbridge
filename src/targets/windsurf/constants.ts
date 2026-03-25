/**
 * Windsurf target constants.
 * Windsurf uses AGENTS.md (root), .windsurf/rules/*.md (modular), and .codeiumignore.
 */

/** Root rules file (flat, no frontmatter) */
export const WINDSURF_RULES_ROOT = '.windsurfrules';

/** Modular rules directory */
export const WINDSURF_RULES_DIR = '.windsurf/rules';

/** Ignore file path (agentsbridge legacy / community) */
export const WINDSURF_IGNORE = '.windsurfignore';

/** Official Windsurf/Codeium ignore file (docs.windsurf.com) */
export const CODEIUM_IGNORE = '.codeiumignore';

/** AGENTS.md root rule (shared with GitHub Agents spec) */
export const WINDSURF_AGENTS_MD = 'AGENTS.md';

/** Windsurf hooks file */
export const WINDSURF_HOOKS_FILE = '.windsurf/hooks.json';

/** Windsurf MCP example config path used for project-owned setup snippets */
export const WINDSURF_MCP_EXAMPLE_FILE = '.windsurf/mcp_config.example.json';

/** Windsurf MCP primary config path (import fallback only) */
export const WINDSURF_MCP_CONFIG_FILE = '.windsurf/mcp_config.json';

/** Workflows directory (.windsurf/workflows/*.md → canonical commands) */
export const WINDSURF_WORKFLOWS_DIR = '.windsurf/workflows';

/** Skills directory (.windsurf/skills/{name}/ → canonical skills) */
export const WINDSURF_SKILLS_DIR = '.windsurf/skills';
