import type { TargetPathContract } from './types.js';

export const kimiCodeContract: TargetPathContract = {
  generated: [
    '.kimi-code/agents/code-reviewer.md',
    '.kimi-code/agents/researcher.md',
    '.kimi-code/mcp.json',
    '.kimi-code/skills/am-command-review/SKILL.md',
    '.kimi-code/skills/api-generator/SKILL.md',
    '.kimi-code/skills/api-generator/references/route-checklist.md',
    '.kimi-code/skills/api-generator/template.ts',
    'AGENTS.md',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/rules/typescript.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
