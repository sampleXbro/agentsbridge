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
 * There is no dedicated rules directory — non-root rules are embedded.
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
export const GOOSE_GLOBAL_SKILLS_DIR = '.agents/skills';

// Canonical paths
export const GOOSE_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const GOOSE_CANONICAL_IGNORE = '.agentsmesh/ignore';
