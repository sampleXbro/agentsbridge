import type { TargetPathContract } from './types.js';

export const opencodeContract: TargetPathContract = {
  generated: [
    '.opencode/agents/code-reviewer.md',
    '.opencode/agents/researcher.md',
    '.opencode/commands/review.md',
    '.opencode/rules/typescript.md',
    '.opencode/skills/api-generator/SKILL.md',
    '.opencode/skills/api-generator/references/route-checklist.md',
    '.opencode/skills/api-generator/template.ts',
    'AGENTS.md',
    'opencode.json',
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
