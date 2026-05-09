import type { TargetPathContract } from './types.js';

export const qwenCodeContract: TargetPathContract = {
  generated: [
    '.qwen/agents/code-reviewer.md',
    '.qwen/agents/researcher.md',
    '.qwen/commands/review.md',
    '.qwen/rules/typescript.md',
    '.qwen/settings.json',
    '.qwen/skills/api-generator/SKILL.md',
    '.qwen/skills/api-generator/references/route-checklist.md',
    '.qwen/skills/api-generator/template.ts',
    '.qwenignore',
    'QWEN.md',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/ignore',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/rules/typescript.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
