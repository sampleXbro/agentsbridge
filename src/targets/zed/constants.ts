/**
 * Zed target constants.
 *
 * Zed is a modern code editor with built-in AI assistant (zed.dev).
 *
 *   - **Project config**: `.rules` at project root + `.zed/settings.json`
 *   - **Global config**: `~/.config/zed/settings.json` (MCP) + `~/.agents/skills/` (skills)
 *
 * Zed natively reads `.rules` for project-level AI instructions,
 * `.zed/settings.json` for MCP servers (`context_servers` key), and
 * `.agents/skills/` for skill bundles (globally: `~/.agents/skills/`).
 * There is no dedicated rules directory — non-root rules are embedded
 * in the single `.rules` file. No native commands or agents.
 */

export const ZED_TARGET = 'zed';

// Project-level paths
export const ZED_ROOT_FILE = '.rules';
export const ZED_SETTINGS_FILE = '.zed/settings.json';
export const ZED_SKILLS_DIR = '.agents/skills';

// Global-level paths (~/.config/zed/ and ~/.agents/)
export const ZED_GLOBAL_DIR = '.config/zed';
export const ZED_GLOBAL_SETTINGS_FILE = `${ZED_GLOBAL_DIR}/settings.json`;
/** Global skills directory — Zed v1.4.0+ reads ~/.agents/skills/ for all projects. */
export const ZED_GLOBAL_SKILLS_DIR = '.agents/skills';

// Canonical paths
export const ZED_CANONICAL_RULES_DIR = '.agentsmesh/rules';
