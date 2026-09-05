/** generate/diff never honoured `features`; the schemas must not advertise it. */
import { describe, it, expect } from 'vitest';
import { ORCHESTRATE_TOOL_DESCRIPTORS } from '../../../../src/mcp/tool-tables/orchestrate-tools.js';

function schemaOf(name: string) {
  const d = ORCHESTRATE_TOOL_DESCRIPTORS.find((t) => t.name === name);
  if (d === undefined) throw new Error(`no tool ${name}`);
  return d.inputSchema;
}

describe('orchestrate tool schemas', () => {
  it.each(['generate', 'diff'])('%s rejects a features filter instead of ignoring it', (name) => {
    expect(schemaOf(name).safeParse({ features: ['rules'] }).success).toBe(false);
    expect(schemaOf(name).safeParse({ targets: ['claude-code'] }).success).toBe(true);
  });
});
