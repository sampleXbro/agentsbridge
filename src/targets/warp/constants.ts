/**
 * Warp target constants.
 *
 * Warp is an agentic development environment by Warp.dev.
 *
 *   - **Project config**: `AGENTS.md` (or legacy `WARP.md`) + `.warp/skills/` + `.mcp.json`
 *   - **Global config**: `~/.warp/skills/` (rules are UI-managed, not file-based)
 *
 * Warp natively reads `AGENTS.md` for project-level instructions,
 * `.warp/skills/` for skill bundles, and `.mcp.json` (standard format)
 * for MCP servers. Non-root rules are embedded in the root file.
 * `WARP.md` is a legacy root file that takes priority over `AGENTS.md`.
 */

export const WARP_TARGET = 'warp';

// Project-level paths
export const WARP_ROOT_FILE = 'AGENTS.md';
export const WARP_LEGACY_ROOT_FILE = 'WARP.md';
export const WARP_SKILLS_DIR = '.warp/skills';
export const WARP_MCP_FILE = '.mcp.json';

// Global-level paths (~/.warp/)
export const WARP_GLOBAL_SKILLS_DIR = '.warp/skills';

// Canonical paths
export const WARP_CANONICAL_RULES_DIR = '.agentsmesh/rules';
