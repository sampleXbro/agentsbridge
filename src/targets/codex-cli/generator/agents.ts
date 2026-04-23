import type { CanonicalAgent, CanonicalFiles } from '../../../core/types.js';
import { CODEX_AGENTS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${CODEX_AGENTS_DIR}/${agent.name}.toml`,
    content: serializeAgentToCodexToml(agent),
  }));
}

function serializeAgentToCodexToml(agent: CanonicalAgent): string {
  const lines: string[] = [];
  lines.push(`name = ${JSON.stringify(agent.name)}`);
  if (agent.description) {
    lines.push(`description = ${JSON.stringify(agent.description)}`);
  }
  if (agent.model) {
    lines.push(`model = ${JSON.stringify(agent.model)}`);
  }
  if (agent.permissionMode === 'read-only' || agent.permissionMode === 'deny') {
    lines.push('sandbox_mode = "read-only"');
  } else if (agent.permissionMode === 'allow') {
    lines.push('sandbox_mode = "workspace-write"');
  }
  const body = agent.body.trim() || '';
  if (body.includes("'''")) {
    const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`developer_instructions = """\n${escaped}\n"""`);
  } else {
    lines.push(`developer_instructions = '''\n${body}\n'''`);
  }
  return lines.join('\n') + '\n';
}
