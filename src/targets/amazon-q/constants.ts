/**
 * Amazon Q Developer target constants.
 *
 * Amazon Q Developer is AWS's AI coding assistant with rules-based customization.
 *
 *   - **Project rules dir**: `.amazonq/rules/*.md` — directory of Markdown rule files
 *   - **Project MCP config**: `.amazonq/mcp.json`
 *   - **Global config dir**: `~/.aws/amazonq/` (user-home AWS config)
 *   - **Global rules dir**: `.aws/amazonq/rules/*.md` (relative to home dir)
 *   - **Global MCP config**: `.aws/amazonq/mcp.json` (relative to home dir)
 *
 * No native commands, skills, or ignore support. Hooks (PreToolUse/PostToolUse/UserPromptSubmit)
 * and permissions (allow) are embedded inside each generated agent JSON.
 *
 * Reference:
 *   https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-project-rules.html
 *   https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-understanding-config.html
 */

export const AMAZON_Q_TARGET = 'amazon-q';

export const AMAZON_Q_RULES_DIR = '.amazonq/rules';
export const AMAZON_Q_MCP_FILE = '.amazonq/mcp.json';
export const AMAZON_Q_AGENTS_DIR = '.amazonq/cli-agents';
/** `/prompts` reads flat `<name>.md` files from here (paths.rs `workspace::PROMPTS_DIR`). */
export const AMAZON_Q_PROMPTS_DIR = '.amazonq/prompts';

export const AMAZON_Q_GLOBAL_RULES_DIR = '.aws/amazonq/rules';
export const AMAZON_Q_GLOBAL_MCP_FILE = '.aws/amazonq/mcp.json';
export const AMAZON_Q_GLOBAL_AGENTS_DIR = '.aws/amazonq/cli-agents';
/** paths.rs `global::PROMPTS_DIR`; a local prompt of the same name wins. */
export const AMAZON_Q_GLOBAL_PROMPTS_DIR = '.aws/amazonq/prompts';

// Canonical paths
export const AMAZON_Q_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const AMAZON_Q_CANONICAL_MCP = '.agentsmesh/mcp.json';
export const AMAZON_Q_CANONICAL_AGENTS_DIR = '.agentsmesh/agents';
export const AMAZON_Q_CANONICAL_COMMANDS_DIR = '.agentsmesh/commands';
