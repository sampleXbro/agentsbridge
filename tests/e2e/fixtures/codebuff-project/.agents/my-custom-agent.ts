import type { AgentDefinition } from './types/agent-definition';

// User-authored agent module. agentsmesh does NOT generate these — Codebuff
// agents are executable TypeScript, so this file must survive every generate.
const definition = {
  id: 'migration-reviewer',
  displayName: 'Migration Reviewer',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['read_files', 'code_search', 'run_terminal_command'],
  spawnableAgents: [],
  instructionsPrompt:
    'Review Postgres migrations for destructive statements and missing rollbacks.',
} satisfies AgentDefinition;

export default definition;
