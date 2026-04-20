import type { TargetPathContract } from './types.js';

export const rooCodeContract: TargetPathContract = {
  generated: [
    '.roo/commands/review.md',
    '.roo/mcp.json',
    '.roo/rules/00-root.md',
    '.roo/rules/typescript.md',
    '.roo/skills/api-generator/SKILL.md',
    '.roo/skills/api-generator/references/route-checklist.md',
    '.roo/skills/api-generator/template.ts',
    '.rooignore',
  ],
  imported: [
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
