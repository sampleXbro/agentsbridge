/**
 * Warp target constants.
 *
 * Warp is an agentic development environment by Warp.dev.
 *
 *   - **Project config**: `AGENTS.md` (or legacy `WARP.md`) + `.warp/skills/` + `.warp/.mcp.json`
 *   - **Global config**: `~/.warp/skills/` + `~/.warp/.mcp.json` (rules are
 *     UI-managed, not file-based)
 *
 * Warp natively reads `AGENTS.md` for project-level instructions,
 * `.warp/skills/` for skill bundles, and `.warp/.mcp.json` (standard format)
 * for MCP servers at the project root. Globally, Warp reads `~/.warp/.mcp.json`
 * (same standard `mcpServers` JSON shape, rebased under the home dir).
 * Non-root rules are embedded in the root file.
 * `WARP.md` is a legacy root file that takes priority over `AGENTS.md`.
 *
 * Note: Warp also reads the cross-tool compatibility path `.mcp.json` (root,
 * no subdirectory) via autodiscovery for interoperability with Claude Code, but
 * `.warp/.mcp.json` is Warp's own native project-scope surface.
 */

export const WARP_TARGET = 'warp';

// Project-level paths
export const WARP_ROOT_FILE = 'AGENTS.md';
export const WARP_LEGACY_ROOT_FILE = 'WARP.md';
export const WARP_SKILLS_DIR = '.warp/skills';
// Warp's native project-level MCP config. Both project and global scopes use
// the .warp/ directory: `.warp/.mcp.json` at the project root, and
// `~/.warp/.mcp.json` globally. The agentsmesh engine rebases the path under
// the home dir for global mode.
export const WARP_MCP_FILE = '.warp/.mcp.json';

// Global-level paths (~/.warp/)
export const WARP_GLOBAL_SKILLS_DIR = '.warp/skills';
export const WARP_GLOBAL_MCP_FILE = '.warp/.mcp.json';

// Canonical paths
export const WARP_CANONICAL_RULES_DIR = '.agentsmesh/rules';
