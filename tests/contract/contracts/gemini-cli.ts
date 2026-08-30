import type { TargetPathContract } from './types.js';

export const geminiCliContract: TargetPathContract = {
  generated: [
    '.agents/skills/api-generator/SKILL.md',
    '.agents/skills/api-generator/references/route-checklist.md',
    '.agents/skills/api-generator/template.ts',
    '.gemini/agents/code-reviewer.md',
    '.gemini/agents/researcher.md',
    '.gemini/commands/review.toml',
    // No `.gemini/policies/permissions.toml`: Gemini's Workspace policy tier is
    // non-functional upstream, so permissions are emitted only at global scope.
    '.gemini/settings.json',
    '.gemini/skills/api-generator/SKILL.md',
    '.gemini/skills/api-generator/references/route-checklist.md',
    '.gemini/skills/api-generator/template.ts',
    '.geminiignore',
    'AGENTS.md',
    'GEMINI.md',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/hooks.yaml',
    '.agentsmesh/ignore',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/skills/api-generator/SKILL.md',
    '.agentsmesh/skills/api-generator/references/route-checklist.md',
    '.agentsmesh/skills/api-generator/template.ts',
  ],
};
