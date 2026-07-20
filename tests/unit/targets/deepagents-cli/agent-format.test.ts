import { describe, it, expect } from 'vitest';
import type { CanonicalAgent } from '../../../../src/core/types.js';
import type { ImportEntryContext } from '../../../../src/targets/catalog/import-descriptor.js';
import {
  serializeDeepagentsAgent,
  deepagentsCliAgentMapper,
} from '../../../../src/targets/deepagents-cli/agent-format.js';

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    name: 'researcher',
    source: '/proj/.agentsmesh/agents/researcher.md',
    description: 'Research agent',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'Research topics thoroughly.',
    ...overrides,
  };
}

describe('serializeDeepagentsAgent', () => {
  it('emits only the documented frontmatter (name, description, model)', () => {
    const content = serializeDeepagentsAgent(makeAgent({ model: 'claude-sonnet' }));
    expect(content).toContain('name: researcher');
    expect(content).toContain('description: Research agent');
    expect(content).toContain('model: claude-sonnet');
    expect(content).toContain('Research topics thoroughly.');
    expect(content).not.toContain('tools:');
    expect(content).not.toContain('permissionMode');
  });

  it('omits model when unset', () => {
    const content = serializeDeepagentsAgent(makeAgent({ model: '' }));
    expect(content).not.toContain('model:');
  });

  it('omits description when empty', () => {
    const content = serializeDeepagentsAgent(makeAgent({ description: '' }));
    expect(content).not.toContain('description:');
  });

  it('renders an empty body as an empty string when whitespace-only', () => {
    const content = serializeDeepagentsAgent(makeAgent({ body: '   \n  ' }));
    expect(content).toContain('name: researcher');
    expect(content.endsWith('---\n\n')).toBe(true);
  });
});

function makeCtx(overrides: Partial<ImportEntryContext> = {}): ImportEntryContext {
  const content = overrides.content ?? '';
  return {
    absolutePath: '/proj/.deepagents/agents/researcher/AGENTS.md',
    relativePath: 'researcher/AGENTS.md',
    content,
    destDir: '/proj/.agentsmesh/agents',
    normalizeTo: (_dest: string) => content,
    ...overrides,
  };
}

describe('deepagentsCliAgentMapper', () => {
  it('derives the canonical name from frontmatter name, writing a flat file', async () => {
    const content =
      '---\nname: researcher\ndescription: Research agent\nmodel: claude-sonnet\n---\n\nResearch topics thoroughly.';
    const mapping = await deepagentsCliAgentMapper(makeCtx({ content }));
    expect(mapping).not.toBeNull();
    expect(mapping!.toPath).toBe('.agentsmesh/agents/researcher.md');
    expect(mapping!.destPath.endsWith('researcher.md')).toBe(true);
    expect(mapping!.content).toContain('description: Research agent');
  });

  it('falls back to the parent directory name when frontmatter name is missing', async () => {
    const content = '---\ndescription: Research agent\n---\n\nResearch topics thoroughly.';
    const mapping = await deepagentsCliAgentMapper(
      makeCtx({ content, relativePath: 'researcher/AGENTS.md' }),
    );
    expect(mapping).not.toBeNull();
    expect(mapping!.toPath).toBe('.agentsmesh/agents/researcher.md');
  });

  it('returns null when neither frontmatter name nor directory name is available', async () => {
    const content = '---\ndescription: Research agent\n---\n\nBody.';
    const mapping = await deepagentsCliAgentMapper(makeCtx({ content, relativePath: 'AGENTS.md' }));
    expect(mapping).toBeNull();
  });
});
