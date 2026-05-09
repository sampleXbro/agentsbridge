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
 * No native commands, agents, skills, hooks, ignore, or permissions support.
 *
 * Reference:
 *   https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-project-rules.html
 *   https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-understanding-config.html
 */

export const AMAZON_Q_TARGET = 'amazon-q';

// Project-level paths
export const AMAZON_Q_DIR = '.amazonq';
export const AMAZON_Q_RULES_DIR = '.amazonq/rules';
export const AMAZON_Q_MCP_FILE = '.amazonq/mcp.json';

// Global-level paths (relative to user home directory: ~/.aws/amazonq/)
export const AMAZON_Q_GLOBAL_DIR = '.aws/amazonq';
export const AMAZON_Q_GLOBAL_RULES_DIR = '.aws/amazonq/rules';
export const AMAZON_Q_GLOBAL_MCP_FILE = '.aws/amazonq/mcp.json';

// Canonical paths
export const AMAZON_Q_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const AMAZON_Q_CANONICAL_MCP = '.agentsmesh/mcp.json';
