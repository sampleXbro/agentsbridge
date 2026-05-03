import type { TargetPathContract } from './types.js';

export const gooseContract: TargetPathContract = {
  generated: [
    '.agents/skills/api-generator/SKILL.md',
    '.agents/skills/api-generator/references/route-checklist.md',
    '.agents/skills/api-generator/template.ts',
    '.goosehints',
    '.gooseignore',
  ],
  imported: [
    '.agentsmesh/ignore',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
