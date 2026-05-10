import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
} from '../../../../src/targets/pi-agent/generator.js';
import {
  PI_AGENT_ROOT_FILE,
  PI_AGENT_SKILLS_DIR,
} from '../../../../src/targets/pi-agent/constants.js';

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

describe('generateRules (pi-agent)', () => {
  it('generates AGENTS.md for the root rule', () => {
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
    expect(results[0].path).toBe(PI_AGENT_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
  });

  it('embeds non-root rules in AGENTS.md', () => {
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
    expect(results[0].path).toBe(PI_AGENT_ROOT_FILE);
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

  it('includes rules explicitly targeted to pi-agent', () => {
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
          source: '/proj/.agentsmesh/rules/pi-only.md',
          root: false,
          targets: ['pi-agent'],
          description: 'Pi-specific',
          globs: [],
          body: 'Only for Pi.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Only for Pi.');
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });

  it('handles root rule with empty body', () => {
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
    // appendEmbeddedRulesBlock returns null for empty content
    expect(results).toHaveLength(0);
  });

  it('generates AGENTS.md with only non-root rules when no root exists', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TS rules',
          globs: [],
          body: 'Use strict mode.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(PI_AGENT_ROOT_FILE);
    expect(results[0].content).toContain('Use strict mode.');
  });
});

describe('generateSkills (pi-agent)', () => {
  it('generates skills to .pi/skills/', () => {
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
    const skillFile = results.find((r) => r.path === `${PI_AGENT_SKILLS_DIR}/debugging/SKILL.md`);
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('Debug workflow');
    const refFile = results.find(
      (r) => r.path === `${PI_AGENT_SKILLS_DIR}/debugging/references/checklist.md`,
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

describe('generateCommands (pi-agent)', () => {
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
    expect(results[0].path).toContain(`${PI_AGENT_SKILLS_DIR}/`);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('review');
  });

  it('returns empty when no commands exist', () => {
    const canonical = makeCanonical({ commands: [] });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateAgents (pi-agent)', () => {
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
    expect(results[0].path).toContain(`${PI_AGENT_SKILLS_DIR}/`);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('researcher');
  });

  it('returns empty when no agents exist', () => {
    const canonical = makeCanonical({ agents: [] });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(0);
  });
});
