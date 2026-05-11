import { describe, it, expect } from 'vitest';
import type { CanonicalAgent } from '../../../../src/core/types.js';
import { serializeDroid } from '../../../../src/targets/factory-droid/droid-serializer.js';

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '/proj/.agentsmesh/agents/test.md',
    name: 'test-agent',
    description: 'A test agent',
    body: 'Do the thing.',
    tools: [],
    disallowedTools: [],
    model: 'inherit',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    ...overrides,
  };
}

describe('serializeDroid', () => {
  it('includes description when non-empty', () => {
    const result = serializeDroid(makeAgent({ description: 'A useful agent' }));
    expect(result).toContain('description:');
  });

  it('omits description from frontmatter when description is empty string', () => {
    const result = serializeDroid(makeAgent({ description: '' }));
    expect(result).not.toContain('description:');
  });

  it('omits tools from frontmatter when tools array is empty', () => {
    const result = serializeDroid(makeAgent({ tools: [] }));
    expect(result).not.toContain('tools:');
  });

  it('includes tools in frontmatter when tools array is non-empty', () => {
    const result = serializeDroid(makeAgent({ tools: ['Bash', 'Read'] }));
    expect(result).toContain('tools:');
  });

  it('serializes correctly when body is whitespace only', () => {
    const result = serializeDroid(makeAgent({ body: '   \n  ' }));
    expect(result).toContain('name: test-agent');
    expect(result.trim()).toBeTruthy();
  });

  it('uses inherit model when model is empty string', () => {
    const result = serializeDroid(makeAgent({ model: '' }));
    expect(result).toContain('model: inherit');
  });

  it('uses provided model when model is non-empty', () => {
    const result = serializeDroid(makeAgent({ model: 'claude-3-5-sonnet' }));
    expect(result).toContain('model: claude-3-5-sonnet');
  });

  it('truncates description to 500 characters', () => {
    const longDesc = 'x'.repeat(600);
    const result = serializeDroid(makeAgent({ description: longDesc }));
    expect(result).toContain('x'.repeat(500));
    expect(result).not.toContain('x'.repeat(501));
  });
});
