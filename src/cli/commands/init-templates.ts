/**
 * Template data for agentsmesh init command.
 */

import { TARGET_IDS } from '../../targets/catalog/target-ids.js';

const ALL_FEATURES = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
];

/**
 * Build agentsmesh.yaml content for the given targets.
 * @param targets - Target tool IDs to include; uses all targets if empty
 */
export function buildConfig(targets: string[]): string {
  const targetList = (targets.length > 0 ? targets : TARGET_IDS).map((t) => `  - ${t}`).join('\n');
  const featureList = ALL_FEATURES.map((f) => `  - ${f}`).join('\n');
  return `version: 1\ntargets:\n${targetList}\nfeatures:\n${featureList}\n`;
}

// ─── Canonical file templates ─────────────────────────────────────────────────

export const TEMPLATE_ROOT_RULE = `---
root: true
description: "Project rules"
---

# Project Rules

Add your project-wide instructions here.
This file is always included in AI tool context and synced to all configured tools.
`;

export const TEMPLATE_EXAMPLE_RULE = `---
description: "Example contextual rule — rename and customize"
# targets: [claude-code, cursor]   # limit to specific tools (optional)
# globs: ["src/**/*.ts"]           # activate only for matching files (optional)
---

# Example Rule

Replace this with your coding standards, conventions, or domain-specific guidelines.
`;

export const TEMPLATE_EXAMPLE_COMMAND = `---
description: "Example command — rename and customize"
# allowed-tools: [Read, Grep, Glob, Bash]
---

Describe the task for this command here.
Commands are invoked on-demand (e.g. /example) with a focused tool set.
`;

export const TEMPLATE_EXAMPLE_AGENT = `---
name: example-agent
description: "Example subagent — rename and customize"
# tools: [Read, Grep, Glob]
# model: sonnet
# permissionMode: ask
# maxTurns: 10
---

Describe this agent's role and instructions here.
Agents are specialized subagents with restricted tools and a specific purpose.
`;

export const TEMPLATE_EXAMPLE_SKILL = `---
name: example-skill
description: "Example skill — rename and customize"
---

# Example Skill

Describe the skill procedure here.
Skills are reusable multi-step procedures that commands and agents can reference.
`;

export const TEMPLATE_MCP = `{
  "mcpServers": {
    // "github": {
    //   "type": "stdio",
    //   "command": "npx",
    //   "args": ["-y", "@modelcontextprotocol/server-github"],
    //   "env": { "GITHUB_TOKEN": "$GITHUB_TOKEN" }
    // },
    // "filesystem": {
    //   "type": "stdio",
    //   "command": "npx",
    //   "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allow"]
    // }
  }
}
`;

export const TEMPLATE_HOOKS = `# Lifecycle hooks — run shell commands before/after AI tool use
# Events: PreToolUse, PostToolUse, SubagentStart, SubagentStop
# Matcher: tool name pattern (e.g. "Edit|Write", "Bash", "*")
#
# PreToolUse:
#   - matcher: Edit|Write
#     type: command
#     command: npm run lint --fix
#
# PostToolUse:
#   - matcher: Edit|Write
#     type: command
#     command: npm test --passWithNoTests
`;

export const TEMPLATE_PERMISSIONS = `# Tool permission allow/deny lists
#
# allow:
#   - Bash(npm run:*)
#   - Bash(git add:*)
#   - Bash(git commit:*)
#
# deny:
#   - Bash(rm -rf:*)
#   - Bash(git push --force:*)
allow: []
deny: []
`;

export const TEMPLATE_IGNORE = `# Patterns ignored by all configured AI tools (gitignore syntax)
#
# node_modules/
# dist/
# .env*
# *.log
# coverage/
`;

export const LOCAL_TEMPLATE = `# Personal overrides — NOT committed to git
# Uncomment and customize for your local setup:

# targets:
#   - claude-code
#   - continue
#   - junie
#   - cursor

# conversions:
#   commands_to_skills:
#     codex-cli: false
#   agents_to_skills:
#     windsurf: false
#
# overrides:
#   claude-code:
#     model: opus
`;
