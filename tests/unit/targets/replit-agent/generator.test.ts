import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
} from '../../../../src/targets/replit-agent/generator.js';
import {
  REPLIT_AGENT_ROOT_FILE,
  REPLIT_AGENT_SKILLS_DIR,
} from '../../../../src/targets/replit-agent/constants.js';

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

describe('generateRules (replit-agent)', () => {
  it('generates replit.md for the root rule', () => {
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
    expect(results[0].path).toBe(REPLIT_AGENT_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---\n/);
  });

  it('embeds non-root rules in replit.md', () => {
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
    expect(results[0].path).toBe(REPLIT_AGENT_ROOT_FILE);
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

  it('includes rules explicitly targeted to replit-agent', () => {
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
          source: '/proj/.agentsmesh/rules/replit-only.md',
          root: false,
          targets: ['replit-agent'],
          description: 'Replit-specific',
          globs: [],
          body: 'Only for Replit Agent.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Only for Replit Agent.');
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });

  it('returns empty when root rule has empty body and no non-root rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '',
        },
      ],
    });

    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (replit-agent)', () => {
  it('generates skills to .agents/skills/', () => {
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
      (r) => r.path === `${REPLIT_AGENT_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('name: debugging');
    expect(skillFile!.content).toContain('description: Debug workflow');
    const refFile = results.find(
      (r) => r.path === `${REPLIT_AGENT_SKILLS_DIR}/debugging/references/checklist.md`,
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

describe('generateCommands (replit-agent)', () => {
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
    expect(results[0].path).toContain(`${REPLIT_AGENT_SKILLS_DIR}/`);
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

  it('returns empty when no commands exist', () => {
    const canonical = makeCanonical({ commands: [] });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateAgents (replit-agent)', () => {
  it('projects agents as skills', () => {
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
    expect(results[0].path).toContain(`${REPLIT_AGENT_SKILLS_DIR}/`);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('researcher');
    const agent = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(agent!.content).toContain('x-agentsmesh-kind: agent');
    expect(agent!.content).toContain('x-agentsmesh-name: researcher');
    expect(agent!.content).toContain('name: am-agent-researcher');
    expect(agent!.content).toContain('description: Research agent');
    expect(agent!.content).toContain('x-agentsmesh-tools:');
    expect(agent!.content).toContain('x-agentsmesh-model: claude-sonnet');
  });

  it('returns empty when no agents exist', () => {
    const canonical = makeCanonical({ agents: [] });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(0);
  });
});
