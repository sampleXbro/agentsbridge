// Shipped by `codebuff init` so agent modules typecheck. Trimmed to the fields
// the fixture uses; the real file lives in the Freebuff repo under
// common/src/templates/initial-agents-dir/types/agent-definition.ts.
export interface AgentDefinition {
  id: string;
  displayName: string;
  model: string;
  toolNames: string[];
  spawnableAgents: string[];
  instructionsPrompt: string;
}
