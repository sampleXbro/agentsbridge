/**
 * Deep Agents CLI target constants.
 *
 * Deep Agents CLI is a coding agent by LangChain, built on LangGraph.
 *
 *   - **Project config**: `.deepagents/AGENTS.md` + `.deepagents/skills/` + `.mcp.json`
 *   - **Global config**: `~/.deepagents/` (config.toml, hooks.json, .mcp.json, agent dirs)
 *
 * Deep Agents reads both `.deepagents/AGENTS.md` and root `AGENTS.md` for
 * project instructions (combining them, with `.deepagents/AGENTS.md` first).
 * We generate to `.deepagents/AGENTS.md` to avoid collision with Amp/Codex/Warp
 * which also use root `AGENTS.md`.
 *
 * Skills are stored in `.deepagents/skills/` (project) or
 * `~/.deepagents/<agent>/skills/` (global, per-agent).
 * MCP uses standard `.mcp.json` format at project root.
 */

export const DEEPAGENTS_CLI_TARGET = 'deepagents-cli';

// Project-level paths
export const DEEPAGENTS_CLI_ROOT_FILE = '.deepagents/AGENTS.md';
export const DEEPAGENTS_CLI_SKILLS_DIR = '.deepagents/skills';
export const DEEPAGENTS_CLI_MCP_FILE = '.mcp.json';

export const DEEPAGENTS_CLI_GLOBAL_ROOT_FILE = '.deepagents/AGENTS.md';
export const DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR = '.deepagents/skills';
export const DEEPAGENTS_CLI_GLOBAL_MCP_FILE = '.deepagents/.mcp.json';

// Canonical paths
export const DEEPAGENTS_CLI_CANONICAL_RULES_DIR = '.agentsmesh/rules';
