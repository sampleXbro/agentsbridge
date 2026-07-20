import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
  generateMcp,
} from '../../../../src/targets/deepagents-cli/generator.js';
import {
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_AGENTS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
} from '../../../../src/targets/deepagents-cli/constants.js';

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

describe('generateRules (deepagents-cli)', () => {
  it('generates .deepagents/AGENTS.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root\n\nUse TDD and strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(DEEPAGENTS_CLI_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---\n/);
  });

  it('embeds non-root rules in .deepagents/AGENTS.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root instructions',
        },
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript standards',
          globs: ['src/**/*.ts'],
          body: 'Use strict mode.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(DEEPAGENTS_CLI_ROOT_FILE);
    expect(results[0].content).toContain('# Root instructions');
    expect(results[0].content).toContain('Use strict mode.');
  });

  it('filters rules targeted to other tools', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/cursor-only.md',
          root: false,
          targets: ['cursor'],
          description: 'Cursor-specific',
          globs: [],
          body: 'Only for Cursor.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).not.toContain('Only for Cursor.');
  });

  it('includes rules explicitly targeted to deepagents-cli', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/deepagents-only.md',
          root: false,
          targets: ['deepagents-cli'],
          description: 'Deep Agents-specific',
          globs: [],
          body: 'Only for Deep Agents.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Only for Deep Agents.');
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (deepagents-cli)', () => {
  it('generates skills to .deepagents/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'debugging',
          source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
          description: 'Debug workflow',
          body: '# Debugging\n\nReproduce first.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              content: '# Checklist\n\n- Reproduce issue',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results.length).toBeGreaterThanOrEqual(2);
    const skillFile = results.find(
      (r) => r.path === `${DEEPAGENTS_CLI_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('name: debugging');
    expect(skillFile!.content).toContain('description: Debug workflow');
    const refFile = results.find(
      (r) => r.path === `${DEEPAGENTS_CLI_SKILLS_DIR}/debugging/references/checklist.md`,
    );
    expect(refFile).toBeDefined();
    expect(refFile!.content).toContain('Reproduce issue');
  });

  it('returns empty when no skills exist', () => {
    const canonical = makeCanonical({ skills: [] });
    const results = generateSkills(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateCommands (deepagents-cli)', () => {
  it('projects commands as skills', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          source: '/proj/.agentsmesh/commands/review.md',
          description: 'Review code changes',
          body: 'Run code review.',
          allowedTools: ['Bash', 'Read'],
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain(`${DEEPAGENTS_CLI_SKILLS_DIR}/`);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('review');
    const cmd = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(cmd!.content).toContain('x-agentsmesh-kind: command');
    expect(cmd!.content).toContain('x-agentsmesh-name: review');
    expect(cmd!.content).toContain('name: am-command-review');
    expect(cmd!.content).toContain('description: Review code changes');
    expect(cmd!.content).toContain('x-agentsmesh-allowed-tools:');
    expect(cmd!.content).toContain('- Read');
  });
});

describe('generateAgents (deepagents-cli)', () => {
  it('emits a native .deepagents/agents/{name}/AGENTS.md subagent file', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'researcher',
          source: '/proj/.agentsmesh/agents/researcher.md',
          description: 'Research agent',
          body: 'Research topics thoroughly.',
          tools: ['WebSearch'],
          disallowedTools: [],
          model: 'claude-sonnet',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${DEEPAGENTS_CLI_AGENTS_DIR}/researcher/AGENTS.md`);
    expect(results[0].content).toContain('name: researcher');
    expect(results[0].content).toContain('description: Research agent');
    expect(results[0].content).toContain('model: claude-sonnet');
    expect(results[0].content).toContain('Research topics thoroughly.');
    // Only the documented frontmatter (name, description, model) is emitted —
    // the rich Claude-Code-style fields (tools, permissionMode, …) have no
    // Deep Agents equivalent and are not fabricated.
    expect(results[0].content).not.toContain('tools:');
    expect(results[0].content).not.toContain('x-agentsmesh-kind');
  });

  it('omits the model key when unset', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'reviewer',
          source: '/proj/.agentsmesh/agents/reviewer.md',
          description: 'Review agent',
          body: 'Review changes.',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${DEEPAGENTS_CLI_AGENTS_DIR}/reviewer/AGENTS.md`);
    expect(results[0].content).not.toContain('model:');
  });

  it('returns empty when no agents exist', () => {
    expect(generateAgents(makeCanonical({ agents: [] }))).toHaveLength(0);
  });
});

describe('generateMcp (deepagents-cli)', () => {
  it('generates .mcp.json with standard format', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(DEEPAGENTS_CLI_MCP_FILE);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcpServers');
    expect(parsed['mcpServers']).toHaveProperty('filesystem');
  });

  it('returns empty when no MCP config exists', () => {
    const canonical = makeCanonical({ mcp: null });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(0);
  });
});

// Hooks have no project-level generator at all (capabilities.hooks = 'none') —
// see tests/unit/targets/deepagents-cli/global-hooks.test.ts for the
// global-only `~/.deepagents/hooks.json` support wired via `scopeExtras`.
