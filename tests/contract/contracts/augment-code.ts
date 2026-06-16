import type { TargetPathContract } from './types.js';

export const augmentCodeContract: TargetPathContract = {
  generated: [
    '.augment/agents/code-reviewer.md',
    '.augment/agents/researcher.md',
    '.augment/commands/review.md',
    '.augment/rules/_root.md',
    '.augment/rules/typescript.md',
    '.augment/settings.json',
    '.augment/skills/api-generator/SKILL.md',
    '.augment/skills/api-generator/references/route-checklist.md',
    '.augment/skills/api-generator/template.ts',
    '.augmentignore',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/hooks.yaml',
    '.agentsmesh/ignore',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/rules/typescript.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
