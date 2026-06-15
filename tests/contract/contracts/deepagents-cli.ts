import type { TargetPathContract } from './types.js';

export const deepagentsCliContract: TargetPathContract = {
  generated: [
    '.deepagents/AGENTS.md',
    '.deepagents/hooks.json',
    '.deepagents/skills/am-agent-code-reviewer/SKILL.md',
    '.deepagents/skills/am-agent-researcher/SKILL.md',
    '.deepagents/skills/am-command-review/SKILL.md',
    '.deepagents/skills/api-generator/SKILL.md',
    '.deepagents/skills/api-generator/references/route-checklist.md',
    '.deepagents/skills/api-generator/template.ts',
    '.mcp.json',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
