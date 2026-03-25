/**
 * Codex CLI target constants.
 * Codex uses AGENTS.md (primary instructions), .agents/skills/ (skills),
 * .codex/skills/ (fallback skills layout), and .codex/config.toml (MCP).
 */

/** Primary instructions file */
export const CODEX_MD = 'codex.md';

/** Shared GitHub Agents format — AGENTS.md is the primary per official docs */
export const AGENTS_MD = 'AGENTS.md';

/** Skills directory (repo-level, scanned from CWD up to repo root) */
export const CODEX_SKILLS_DIR = '.agents/skills';

/** Fallback skills directory used by some Codex skill libraries */
export const CODEX_SKILLS_FALLBACK_DIR = '.codex/skills';

/** Project-level config file (MCP servers and other overrides) */
export const CODEX_CONFIG_TOML = '.codex/config.toml';

/** Starlark execution rules (`.rules`) + legacy `.md` import */
export const CODEX_RULES_DIR = '.codex/rules';

/** Project custom agents (native TOML format) */
export const CODEX_AGENTS_DIR = '.codex/agents';
