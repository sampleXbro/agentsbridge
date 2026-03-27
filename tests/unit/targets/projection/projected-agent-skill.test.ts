import { describe, expect, it } from 'vitest';
import type { CanonicalAgent } from '../../../../src/core/types.js';
import {
  parseProjectedAgentSkillFrontmatter,
  projectedAgentSkillDirName,
  serializeImportedAgent,
  serializeProjectedAgentSkill,
} from '../../../../src/targets/projection/projected-agent-skill.js';

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '.agentsmesh/agents/reviewer.md',
    name: 'reviewer',
    description: '',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'Review code.',
    ...overrides,
  };
}

describe('projected agent skill helpers', () => {
  it('builds the projected agent skill directory name', () => {
    expect(projectedAgentSkillDirName('reviewer')).toBe('am-agent-reviewer');
  });

  it('serializes projected agent skill metadata only when values are present', () => {
    const output = serializeProjectedAgentSkill(
      makeAgent({
        description: 'Review specialist',
        tools: ['Read', 'Grep'],
        disallowedTools: ['Bash(rm -rf *)'],
        model: 'gpt-5',
        permissionMode: 'ask',
        maxTurns: 7,
        mcpServers: ['context7'],
        hooks: { PostToolUse: [{ matcher: 'Write', command: 'pnpm lint' }] },
        skills: ['qa'],
        memory: 'notes/reviewer.md',
      }),
    );

    expect(output).toContain('name: am-agent-reviewer');
    expect(output).toContain('x-agentsmesh-kind: agent');
    expect(output).toContain('x-agentsmesh-tools:');
    expect(output).toContain('x-agentsmesh-disallowed-tools:');
    expect(output).toContain('x-agentsmesh-hooks:');
    expect(output).toContain('x-agentsmesh-memory: notes/reviewer.md');
  });

  it('omits optional metadata from projected agent skills when empty', () => {
    const output = serializeProjectedAgentSkill(makeAgent());

    expect(output).toContain('name: am-agent-reviewer');
    expect(output).not.toContain('x-agentsmesh-tools:');
    expect(output).not.toContain('x-agentsmesh-model:');
    expect(output).not.toContain('x-agentsmesh-memory:');
  });

  it('returns null when projected-agent metadata kind is absent', () => {
    expect(parseProjectedAgentSkillFrontmatter({}, 'am-agent-reviewer')).toBeNull();
  });

  it('returns null when neither metadata name nor prefixed dir name can resolve the agent name', () => {
    expect(
      parseProjectedAgentSkillFrontmatter({ 'x-agentsmesh-kind': 'agent' }, 'reviewer'),
    ).toBeNull();
  });

  it('parses projected agent skill metadata from legacy prefixes and mixed value shapes', () => {
    const parsed = parseProjectedAgentSkillFrontmatter(
      {
        'x-agentsmesh-kind': 'agent',
        description: 'Review specialist',
        'x-agentsmesh-tools': 'Read, Grep',
        'x-agentsmesh-disallowed-tools': ['Bash(rm -rf *)'],
        'x-agentsmesh-model': 'gpt-5',
        'x-agentsmesh-permission-mode': 'ask',
        'x-agentsmesh-max-turns': '9',
        'x-agentsmesh-mcp-servers': 'context7, prisma',
        'x-agentsmesh-hooks': {
          PostToolUse: [
            { matcher: 'Write', command: 'pnpm lint' },
            { matcher: 42, command: 'ignored' },
            { matcher: 'Edit', prompt: 'ignored' },
          ],
          Invalid: 'skip-me',
        },
        'x-agentsmesh-skills': ['qa'],
        'x-agentsmesh-memory': 'notes/reviewer.md',
      },
      'ab-agent-reviewer',
    );

    expect(parsed).toEqual({
      name: 'reviewer',
      description: 'Review specialist',
      tools: ['Read', 'Grep'],
      disallowedTools: ['Bash(rm -rf *)'],
      model: 'gpt-5',
      permissionMode: 'ask',
      maxTurns: 9,
      mcpServers: ['context7', 'prisma'],
      hooks: { PostToolUse: [{ matcher: 'Write', command: 'pnpm lint' }] },
      skills: ['qa'],
      memory: 'notes/reviewer.md',
    });
  });

  it('prefers x-agentsmesh-name over derived directory names and falls back missing fields', () => {
    const parsed = parseProjectedAgentSkillFrontmatter(
      {
        'x-agentsmesh-kind': 'agent',
        'x-agentsmesh-name': 'explicit-reviewer',
        'x-agentsmesh-max-turns': 3,
      },
      'am-agent-ignored',
    );

    expect(parsed).toEqual({
      name: 'explicit-reviewer',
      description: '',
      tools: [],
      disallowedTools: [],
      model: '',
      permissionMode: '',
      maxTurns: 3,
      mcpServers: [],
      hooks: {},
      skills: [],
      memory: '',
    });
  });

  it('serializes imported agents with required placeholders and optional populated fields', () => {
    const output = serializeImportedAgent(
      {
        name: 'reviewer',
        description: '',
        tools: [],
        disallowedTools: ['Bash(rm -rf *)'],
        model: 'gpt-5',
        permissionMode: 'ask',
        maxTurns: 9,
        mcpServers: ['context7'],
        hooks: { PostToolUse: [{ matcher: 'Write', command: 'pnpm lint' }] },
        skills: ['qa'],
        memory: 'notes/reviewer.md',
      },
      'Review code.',
    );

    expect(output).toContain('name: reviewer');
    expect(output).toContain('description: ""');
    expect(output).toContain('tools: []');
    expect(output).toContain('disallowedTools:');
    expect(output).toContain('mcpServers:');
    expect(output).toContain('hooks:');
  });
});
