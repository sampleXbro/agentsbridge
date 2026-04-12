import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
} from '../../../../src/targets/kiro/generator.js';
import {
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_MCP_FILE,
  KIRO_HOOKS_DIR,
  KIRO_IGNORE,
} from '../../../../src/targets/kiro/constants.js';

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

describe('generateRules (kiro)', () => {
  it('generates AGENTS.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Workspace defaults',
          globs: [],
          body: '# Root\n\nUse TDD.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(KIRO_AGENTS_MD);
    expect(results[0].content).toContain('Use TDD.');
  });

  it('generates non-root rules in .kiro/steering with Kiro inclusion frontmatter', () => {
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
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript rules',
          globs: ['src/**/*.ts'],
          trigger: 'glob',
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);
    const steeringRule = results.find(
      (result) => result.path === `${KIRO_STEERING_DIR}/typescript.md`,
    );

    expect(steeringRule).toBeDefined();
    expect(steeringRule?.content).toContain('inclusion: fileMatch');
    expect(steeringRule?.content).toContain('fileMatchPattern: src/**/*.ts');
    expect(steeringRule?.content).toContain('description: TypeScript rules');
    expect(steeringRule?.content).toContain('Use strict TypeScript.');
  });

  it('maps manual rules to manual steering files', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/review.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          trigger: 'manual',
          body: 'Review carefully.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results[0]?.content).toContain('inclusion: manual');
    expect(results[0]?.path).toBe(`${KIRO_STEERING_DIR}/review.md`);
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

    expect(generateRules(canonical)).toEqual([]);
  });
});

describe('generateSkills (kiro)', () => {
  it('generates Kiro skill folders with supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
          name: 'debugging',
          description: 'Debug production failures',
          body: '# Debugging\n\nStart with logs.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              absolutePath: '/proj/.agentsmesh/skills/debugging/references/checklist.md',
              content: '# Checklist',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results.some((result) => result.path === `${KIRO_SKILLS_DIR}/debugging/SKILL.md`)).toBe(
      true,
    );
    expect(
      results.some(
        (result) => result.path === `${KIRO_SKILLS_DIR}/debugging/references/checklist.md`,
      ),
    ).toBe(true);
  });
});

describe('generateMcp (kiro)', () => {
  it('generates .kiro/settings/mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          github: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {},
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(KIRO_MCP_FILE);
    expect(JSON.parse(results[0].content)).toHaveProperty('mcpServers.github');
  });
});

describe('generateHooks (kiro)', () => {
  it('generates askAgent hooks for prompt entries and shell hooks for command entries', () => {
    const canonical = makeCanonical({
      hooks: {
        UserPromptSubmit: [
          { matcher: '*', prompt: 'Capture intent before acting.', type: 'prompt' },
        ],
        PreToolUse: [{ matcher: 'write', command: 'pnpm lint', type: 'command' }],
      },
    });

    const results = generateHooks(canonical);
    const promptHook = results.find(
      (result) => result.path === `${KIRO_HOOKS_DIR}/user-prompt-submit-1.kiro.hook`,
    );
    const toolHook = results.find(
      (result) => result.path === `${KIRO_HOOKS_DIR}/pre-tool-use-1.kiro.hook`,
    );

    expect(promptHook).toBeDefined();
    expect(toolHook).toBeDefined();
    expect(JSON.parse(promptHook!.content)).toMatchObject({
      version: '1',
      when: { type: 'promptSubmit' },
      then: { type: 'askAgent', prompt: 'Capture intent before acting.' },
    });
    expect(JSON.parse(toolHook!.content)).toMatchObject({
      version: '1',
      when: { type: 'preToolUse', tools: ['write'] },
      then: { type: 'shellCommand', command: 'pnpm lint' },
    });
  });
});

describe('generateIgnore (kiro)', () => {
  it('generates .kiroignore', () => {
    const results = generateIgnore(makeCanonical({ ignore: ['.env', 'dist/'] }));

    expect(results).toEqual([{ path: KIRO_IGNORE, content: '.env\ndist/' }]);
  });
});
