import type { TargetPathContract } from './types.js';

export const kiroContract: TargetPathContract = {
  generated: [
    '.kiro/agents/code-reviewer.md',
    '.kiro/agents/researcher.md',
    '.kiro/hooks/post-tool-use-1.kiro.hook',
    '.kiro/settings/mcp.json',
    '.kiro/skills/am-command-review/SKILL.md',
    '.kiro/skills/api-generator/SKILL.md',
    '.kiro/skills/api-generator/references/route-checklist.md',
    '.kiro/skills/api-generator/template.ts',
    '.kiro/steering/typescript.md',
    '.kiroignore',
    'AGENTS.md',
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
