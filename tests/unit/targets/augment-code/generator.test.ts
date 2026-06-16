import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateIgnore,
  generateAgents,
} from '../../../../src/targets/augment-code/generator.js';
import {
  AUGMENT_CODE_RULES_DIR,
  AUGMENT_CODE_COMMANDS_DIR,
  AUGMENT_CODE_SKILLS_DIR,
  AUGMENT_CODE_IGNORE_FILE,
  AUGMENT_CODE_AGENTS_DIR,
} from '../../../../src/targets/augment-code/constants.js';

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

describe('generateRules (augment-code)', () => {
  it('generates _root.md with always_apply for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project defaults',
          globs: [],
          body: '# Root\n\nUse TDD.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AUGMENT_CODE_RULES_DIR}/_root.md`);
    expect(results[0].content).toContain('always_apply: true');
    expect(results[0].content).toContain('Use TDD.');
  });

  it('generates non-root rules with always_apply when no globs', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript standards',
          globs: [],
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AUGMENT_CODE_RULES_DIR}/typescript.md`);
    expect(results[0].content).toContain('always_apply: true');
    expect(results[0].content).toContain('Use strict TypeScript.');
  });

  it('generates agent_requested rules for model_decision trigger', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/security.md',
          root: false,
          targets: [],
          description: 'Security rules for auth endpoints',
          globs: [],
          trigger: 'model_decision',
          body: 'Validate all inputs.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AUGMENT_CODE_RULES_DIR}/security.md`);
    expect(results[0].content).toContain('agent_requested: true');
    expect(results[0].content).toContain('description: Security rules for auth endpoints');
  });

  it('generates agent_requested rules for glob-scoped rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/api.md',
          root: false,
          targets: [],
          description: 'API endpoint rules',
          globs: ['src/api/**/*.ts'],
          body: 'Validate all inputs.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('agent_requested: true');
    expect(results[0].content).toContain('globs:');
    expect(results[0].content).toContain('src/api/**/*.ts');
  });

  it('skips rules filtered to other targets', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/claude-only.md',
          root: false,
          targets: ['claude-code'],
          description: '',
          globs: [],
          body: 'Claude only.',
        },
      ],
    });

    expect(generateRules(canonical)).toHaveLength(0);
  });

  it('generates agent_requested rules for manual trigger', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/deploy.md',
          root: false,
          targets: [],
          description: 'Deployment checklist',
          globs: [],
          trigger: 'manual',
          body: 'Run deploy checklist.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AUGMENT_CODE_RULES_DIR}/deploy.md`);
    expect(results[0].content).toContain('agent_requested: true');
    expect(results[0].content).toContain('description: Deployment checklist');
    expect(results[0].content).not.toContain('always_apply');
  });

  it('includes rules targeting augment-code explicitly', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/augment-only.md',
          root: false,
          targets: ['augment-code'],
          description: '',
          globs: [],
          body: 'Augment only.',
        },
      ],
    });

    expect(generateRules(canonical)).toHaveLength(1);
    expect(generateRules(canonical)[0].path).toBe(`${AUGMENT_CODE_RULES_DIR}/augment-only.md`);
  });
});

describe('generateCommands (augment-code)', () => {
  it('generates command files with description frontmatter', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/review.md',
          name: 'review',
          description: 'Review code changes',
          allowedTools: [],
          body: 'Review the code: $ARGUMENTS',
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AUGMENT_CODE_COMMANDS_DIR}/review.md`);
    expect(results[0].content).toContain('description: Review code changes');
    expect(results[0].content).toContain('Review the code: $ARGUMENTS');
  });

  it('returns empty array when no commands', () => {
    expect(generateCommands(makeCanonical())).toHaveLength(0);
  });
});

describe('generateSkills (augment-code)', () => {
  it('generates skill bundles in .augment/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          name: 'api-generator',
          description: 'Generate API endpoints',
          body: '# API Generator\n\nGenerate REST endpoints.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              absolutePath: '/proj/.agentsmesh/skills/api-generator/references/checklist.md',
              content: '# Checklist\n\n- [ ] Validate inputs',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${AUGMENT_CODE_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(results[1].path).toBe(
      `${AUGMENT_CODE_SKILLS_DIR}/api-generator/references/checklist.md`,
    );
    expect(results[0].content).toContain('name: api-generator');
    expect(results[0].content).toContain('Generate API endpoints');
  });
});

describe('generateAgents (augment-code)', () => {
  it('returns empty when no agents', () => {
    expect(generateAgents(makeCanonical())).toHaveLength(0);
  });

  it('generates .augment/agents/*.md with name + description frontmatter', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/reviewer.md',
          name: 'reviewer',
          description: 'Reviews code',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You review code.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AUGMENT_CODE_AGENTS_DIR}/reviewer.md`);
    expect(results[0].content).toContain('name: reviewer');
    expect(results[0].content).toContain('description: Reviews code');
    expect(results[0].content).toContain('You review code.');
  });

  it('omits description when empty', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/minimal.md',
          name: 'minimal',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Minimal agent body.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('name: minimal');
    expect(results[0].content).not.toContain('description:');
    expect(results[0].content).toContain('Minimal agent body.');
  });
});

describe('generateIgnore (augment-code)', () => {
  it('generates .augmentignore with ignore patterns', () => {
    const results = generateIgnore(makeCanonical({ ignore: ['.env', 'dist/', 'node_modules/'] }));

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AUGMENT_CODE_IGNORE_FILE);
    expect(results[0].content).toBe('.env\ndist/\nnode_modules/');
  });

  it('returns empty array when no ignore patterns', () => {
    expect(generateIgnore(makeCanonical())).toHaveLength(0);
  });
});
