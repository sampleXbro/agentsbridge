import type { TargetPathContract } from './types.js';

export const copilotContract: TargetPathContract = {
  generated: [
    '.github/agents/code-reviewer.agent.md',
    '.github/agents/researcher.agent.md',
    '.github/copilot-instructions.md',
    '.github/hooks/agentsmesh.json',
    '.github/hooks/scripts/posttooluse-0.sh',
    '.github/instructions/typescript.instructions.md',
    '.github/prompts/review.prompt.md',
    '.github/skills/api-generator/SKILL.md',
    '.github/skills/api-generator/references/route-checklist.md',
    '.github/skills/api-generator/template.ts',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/hooks.yaml',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/rules/typescript.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
