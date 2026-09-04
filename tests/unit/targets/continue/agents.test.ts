import { describe, it, expect } from 'vitest';
import type { CanonicalAgent, CanonicalFiles } from '../../../../src/core/types.js';
import { generateAgents } from '../../../../src/targets/continue/generator.js';
import {
  continueAgentFilePath,
  serializeContinueAgentFile,
} from '../../../../src/targets/continue/agent-file.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '/proj/.agentsmesh/agents/reviewer.md',
    name: 'reviewer',
    description: 'Reviews code for quality',
    tools: ['Read', 'Grep'],
    disallowedTools: [],
    model: 'sonnet',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'You review code.',
    ...overrides,
  };
}

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('serializeContinueAgentFile (markdown agent file)', () => {
  it('writes tools as the comma-separated string Continue parses', () => {
    const { frontmatter } = parseFrontmatter(serializeContinueAgentFile(makeAgent()));
    expect(frontmatter.name).toBe('reviewer');
    expect(frontmatter.description).toBe('Reviews code for quality');
    expect(frontmatter.model).toBe('sonnet');
    expect(frontmatter.tools).toBe('Read, Grep');
  });

  it('keeps the canonical prompt as the markdown body', () => {
    const { body } = parseFrontmatter(serializeContinueAgentFile(makeAgent()));
    expect(body).toBe('You review code.');
  });

  it('omits keys Continue treats as optional when canonical has no value', () => {
    const content = serializeContinueAgentFile(
      makeAgent({ description: '', model: '', tools: [], body: '' }),
    );
    expect(parseFrontmatter(content).frontmatter).toEqual({ name: 'reviewer' });
  });

  it('preserves fields Continue ignores so the round-trip stays lossless', () => {
    const { frontmatter } = parseFrontmatter(
      serializeContinueAgentFile(
        makeAgent({
          disallowedTools: ['Bash'],
          permissionMode: 'acceptEdits',
          maxTurns: 7,
          mcpServers: ['github'],
          hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi' }] },
          skills: ['api-generator'],
          memory: 'notes.md',
        }),
      ),
    );
    expect(frontmatter.disallowedTools).toEqual(['Bash']);
    expect(frontmatter.permissionMode).toBe('acceptEdits');
    expect(frontmatter.maxTurns).toBe(7);
    expect(frontmatter.mcpServers).toEqual(['github']);
    expect(frontmatter.hooks).toEqual({ PreToolUse: [{ matcher: 'Bash', command: 'echo hi' }] });
    expect(frontmatter.skills).toEqual(['api-generator']);
    expect(frontmatter.memory).toBe('notes.md');
  });

  it('derives the path from the agent name', () => {
    expect(continueAgentFilePath('reviewer')).toBe('.continue/agents/reviewer.md');
  });
});

describe('generateAgents (continue)', () => {
  it('writes the same markdown agent file at both scopes', () => {
    for (const scope of ['project', 'global'] as const) {
      const results = generateAgents(makeCanonical({ agents: [makeAgent()] }), {
        capability: { level: 'native' },
        scope,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.path).toBe('.continue/agents/reviewer.md');
      expect(results[0]!.content).toBe(serializeContinueAgentFile(makeAgent()));
    }
  });

  it('emits markdown when no context is supplied', () => {
    const results = generateAgents(makeCanonical({ agents: [makeAgent()] }));
    expect(results.map((r) => r.path)).toEqual(['.continue/agents/reviewer.md']);
  });

  it('returns empty when no agents exist', () => {
    expect(generateAgents(makeCanonical())).toEqual([]);
  });
});
