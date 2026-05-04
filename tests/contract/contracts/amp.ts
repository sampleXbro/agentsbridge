import type { TargetPathContract } from './types.js';

export const ampContract: TargetPathContract = {
  generated: [
    '.agents/skills/am-agent-code-reviewer/SKILL.md',
    '.agents/skills/am-agent-researcher/SKILL.md',
    '.agents/skills/am-command-review/SKILL.md',
    '.agents/skills/api-generator/SKILL.md',
    '.agents/skills/api-generator/references/route-checklist.md',
    '.agents/skills/api-generator/template.ts',
    '.amp/settings.json',
    'AGENTS.md',
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
