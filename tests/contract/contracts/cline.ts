import type { TargetPathContract } from './types.js';

export const clineContract: TargetPathContract = {
  generated: [
    '.cline/cline_mcp_settings.json',
    '.cline/skills/am-agent-code-reviewer/SKILL.md',
    '.cline/skills/am-agent-researcher/SKILL.md',
    '.cline/skills/api-generator/SKILL.md',
    '.cline/skills/api-generator/references/route-checklist.md',
    '.cline/skills/api-generator/template.ts',
    '.clineignore',
    '.clinerules/hooks/posttooluse-0.sh',
    '.clinerules/typescript.md',
    '.clinerules/workflows/review.md',
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
