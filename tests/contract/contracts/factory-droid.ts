import type { TargetPathContract } from './types.js';

export const factoryDroidContract: TargetPathContract = {
  generated: [
    '.factory/droids/code-reviewer.md',
    '.factory/droids/researcher.md',
    '.factory/hooks.json',
    '.factory/mcp.json',
    '.factory/skills/am-command-review/SKILL.md',
    '.factory/skills/api-generator/SKILL.md',
    '.factory/skills/api-generator/references/route-checklist.md',
    '.factory/skills/api-generator/template.ts',
    'AGENTS.md',
  ],
  imported: [
    '.agentsmesh/commands/review.md',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
