import type { TargetPathContract } from './types.js';

export const piAgentContract: TargetPathContract = {
  generated: [
    '.pi/skills/am-agent-code-reviewer/SKILL.md',
    '.pi/skills/am-agent-researcher/SKILL.md',
    '.pi/skills/am-command-review/SKILL.md',
    '.pi/skills/api-generator/SKILL.md',
    '.pi/skills/api-generator/references/route-checklist.md',
    '.pi/skills/api-generator/template.ts',
    'AGENTS.md',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
