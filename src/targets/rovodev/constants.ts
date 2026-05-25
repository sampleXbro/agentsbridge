/**
 * Rovo Dev target constants.
 *
 * Rovo Dev is Atlassian's AI-powered coding agent, available as a CLI
 * and in Bitbucket/GitHub integrations.
 *
 *   - **Project config**: `AGENTS.md` + `.rovodev/skills/` + `.rovodev/mcp.json`
 *   - **Global config**: `~/.rovodev/AGENTS.md` + `~/.rovodev/skills/` + `~/.rovodev/mcp.json`
 *
 * Rovo Dev reads `AGENTS.md` for project-level instructions (memory),
 * `.rovodev/skills/` for skill bundles, and `.rovodev/mcp.json` for MCP
 * servers. Non-root rules are embedded in the root file.
 * Subagents live in `.rovodev/subagents/` but are projected as skills.
 */

export const ROVODEV_TARGET = 'rovodev';

// Project-level paths
export const ROVODEV_ROOT_FILE = 'AGENTS.md';
export const ROVODEV_DIR = '.rovodev';
export const ROVODEV_SKILLS_DIR = `${ROVODEV_DIR}/skills`;
export const ROVODEV_MCP_FILE = `${ROVODEV_DIR}/mcp.json`;

// Global-level paths (~/.rovodev/)
export const ROVODEV_GLOBAL_DIR = '.rovodev';
export const ROVODEV_GLOBAL_ROOT_FILE = '.rovodev/AGENTS.md';
export const ROVODEV_GLOBAL_SKILLS_DIR = '.rovodev/skills';
export const ROVODEV_GLOBAL_MCP_FILE = '.rovodev/mcp.json';

export const ROVODEV_CANONICAL_RULES_DIR = '.agentsmesh/rules';
