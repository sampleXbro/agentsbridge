/**
 * Factory Droid target constants.
 *
 * Factory Droid is an enterprise AI coding agent by Factory AI (factory.ai).
 *
 *   - **Project config**: `AGENTS.md` at project root + `.factory/droids/`,
 *     `.factory/skills/`, `.factory/mcp.json`
 *   - **Global config**: `~/.factory/` (AGENTS.md, droids/, skills/, mcp.json)
 *
 * Factory Droid reads `AGENTS.md` for project-level instructions (with search
 * up the directory tree), `.factory/droids/` for custom sub-agents (Markdown
 * with YAML frontmatter), `.factory/skills/` for skill bundles, and
 * `.factory/mcp.json` for MCP servers.
 *
 * There is no dedicated rules directory — non-root rules are embedded in the
 * root file. Commands are merged into skills. Hooks live in settings.json
 * (not a standalone file). No `.factoryignore` — relies on `.gitignore`.
 * Permissions are CLI-flag-only (`--skip-permissions-unsafe`).
 *
 * Assumptions (documented from official docs at docs.factory.ai):
 *   - Droids use `.md` files with YAML frontmatter in `.factory/droids/`
 *   - Skills use `SKILL.md` format in `.factory/skills/{name}/`
 *   - MCP uses standard JSON format in `.factory/mcp.json`
 *   - Legacy path: `.agent/skills/` is a backward-compat skill directory
 *   - Legacy path: `.droid.yaml` was an earlier configuration format
 */

export const FACTORY_DROID_TARGET = 'factory-droid';

// Project-level paths
export const FACTORY_DROID_ROOT_FILE = 'AGENTS.md';
export const FACTORY_DROID_SKILLS_DIR = '.factory/skills';
export const FACTORY_DROID_DROIDS_DIR = '.factory/droids';
export const FACTORY_DROID_MCP_FILE = '.factory/mcp.json';

export const FACTORY_DROID_GLOBAL_ROOT_FILE = '.factory/AGENTS.md';
export const FACTORY_DROID_GLOBAL_SKILLS_DIR = '.factory/skills';
export const FACTORY_DROID_GLOBAL_DROIDS_DIR = '.factory/droids';
export const FACTORY_DROID_GLOBAL_MCP_FILE = '.factory/mcp.json';

export const FACTORY_DROID_HOOKS_FILE = '.factory/hooks.json';
export const FACTORY_DROID_GLOBAL_HOOKS_FILE = '.factory/hooks.json';

// Canonical paths
export const FACTORY_DROID_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const FACTORY_DROID_CANONICAL_AGENTS_DIR = '.agentsmesh/agents';
