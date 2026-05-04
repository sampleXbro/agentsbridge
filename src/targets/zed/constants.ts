/**
 * Zed target constants.
 *
 * Zed is a modern code editor with built-in AI assistant (zed.dev).
 *
 *   - **Project config**: `.rules` at project root + `.zed/settings.json`
 *   - **Global config**: `~/.config/zed/settings.json` (MCP only)
 *
 * Zed natively reads `.rules` for project-level AI instructions and
 * `.zed/settings.json` for MCP servers (`context_servers` key).
 * There is no dedicated rules directory — non-root rules are embedded
 * in the single `.rules` file. No native commands, agents, or skills.
 */

export const ZED_TARGET = 'zed';

// Project-level paths
export const ZED_ROOT_FILE = '.rules';
export const ZED_SETTINGS_FILE = '.zed/settings.json';

// Global-level paths (~/.config/zed/)
export const ZED_GLOBAL_DIR = '.config/zed';
export const ZED_GLOBAL_SETTINGS_FILE = `${ZED_GLOBAL_DIR}/settings.json`;

// Canonical paths
export const ZED_CANONICAL_RULES_DIR = '.agentsmesh/rules';
