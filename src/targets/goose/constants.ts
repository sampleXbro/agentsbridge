/**
 * Goose target constants.
 *
 * Goose is an open-source AI coding agent by Block (goose-docs.ai).
 *
 *   - **Project config**: `.goosehints` at project root + `.agents/skills/`
 *   - **Global config**: `~/.config/goose/` (.goosehints, .gooseignore)
 *
 * Goose natively reads `.goosehints` (and `AGENTS.md`) for project-level
 * instructions, `.gooseignore` for file exclusion, and `.agents/skills/`
 * for skill bundles. MCP extensions are global-only in `config.yaml`.
 * Lifecycle hooks follow the Open Plugin Specification: a `hooks/hooks.json`
 * inside a plugin dir under `.agents/plugins/<name>/` (auto-discovered in both
 * project and global scope). There is no dedicated rules directory — non-root
 * rules are embedded.
 */

export const GOOSE_TARGET = 'goose';

// Project-level paths
export const GOOSE_ROOT_FILE = '.goosehints';
export const GOOSE_SKILLS_DIR = '.agents/skills';
export const GOOSE_IGNORE = '.gooseignore';

// Global-level paths (~/.config/goose/)
export const GOOSE_GLOBAL_DIR = '.config/goose';
export const GOOSE_GLOBAL_ROOT_FILE = `${GOOSE_GLOBAL_DIR}/.goosehints`;
export const GOOSE_GLOBAL_IGNORE = `${GOOSE_GLOBAL_DIR}/.gooseignore`;
export const GOOSE_GLOBAL_CONFIG = `${GOOSE_GLOBAL_DIR}/config.yaml`;
export const GOOSE_GLOBAL_SKILLS_DIR = '.agents/skills';
// Tool permissions — global-only YAML map keyed by category (agentsmesh owns
// the `user` block; the runtime `smart_approve` cache is merge-preserved).
export const GOOSE_GLOBAL_PERMISSIONS = `${GOOSE_GLOBAL_DIR}/permission.yaml`;

// Open Plugin Specification hooks — `hooks/hooks.json` inside an agentsmesh
// plugin dir. Same relative path in both scopes (`.agents/plugins/...`),
// rebased under the home dir in global mode (like `.agents/skills`).
export const GOOSE_HOOKS_FILE = '.agents/plugins/agentsmesh/hooks/hooks.json';

// Canonical paths
export const GOOSE_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const GOOSE_CANONICAL_IGNORE = '.agentsmesh/ignore';
export const GOOSE_CANONICAL_HOOKS = '.agentsmesh/hooks.yaml';
export const GOOSE_CANONICAL_PERMISSIONS = '.agentsmesh/permissions.yaml';
