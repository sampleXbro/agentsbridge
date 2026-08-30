import type { TargetPathContract } from './types.js';

export const amazonQContract: TargetPathContract = {
  generated: [
    '.amazonq/cli-agents/code-reviewer.json',
    '.amazonq/cli-agents/researcher.json',
    '.amazonq/mcp.json',
    '.amazonq/prompts/review.md',
    '.amazonq/rules/_root.md',
    '.amazonq/rules/typescript.md',
  ],
  imported: [
    '.agentsmesh/agents/code-reviewer.md',
    '.agentsmesh/agents/researcher.md',
    '.agentsmesh/commands/review.md',
    '.agentsmesh/mcp.json',
    '.agentsmesh/rules/_root.md',
    '.agentsmesh/rules/typescript.md',
  ],
};
