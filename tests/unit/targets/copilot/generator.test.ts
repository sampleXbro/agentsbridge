import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateHooks,
  generateAgents,
  generateSkills,
} from '../../../../src/targets/copilot/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { COPILOT_PROMPTS_DIR } from '../../../../src/targets/copilot/constants.js';

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

describe('generateRules (copilot)', () => {
  it('generates .github/copilot-instructions.md from root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project rules',
          globs: [],
          body: '# Rules\n- Use TypeScript\n',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path === '.github/copilot-instructions.md')).toBe(true);
    const main = results.find((r) => r.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('# Rules');
    expect(main?.content).toContain('- Use TypeScript');
  });

  it('keeps copilot-instructions focused on rules even when commands exist', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root body',
        },
      ],
      commands: [
        {
          source: '',
          name: 'review',
          description: 'Review code',
          allowedTools: [],
          body: 'Do review.',
        },
      ],
      agents: [
        {
          source: '',
          name: 'coder',
          description: 'Coder',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Code well.',
        },
      ],
      skills: [
        { source: '', name: 'ts', description: 'TS skill', body: 'Use TS.', supportingFiles: [] },
      ],
    });
    const results = generateRules(canonical);
    const main = results.find((r) => r.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('Root body');
    expect(main?.content).not.toContain('## Commands');
    expect(main?.content).not.toContain('Do review.');
  });

  it('generates .github/instructions/*.instructions.md for non-root rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/proj/.agentsbridge/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TS rules',
          globs: ['src/**/*.ts'],
          body: 'Use strict TS.',
        },
      ],
    });
    const results = generateRules(canonical);
    const perContext = results.find(
      (r) => r.path === '.github/instructions/typescript.instructions.md',
    );
    expect(perContext).toBeDefined();
    expect(perContext?.content).toContain('applyTo');
    expect(perContext?.content).toContain('src/**/*.ts');
    expect(perContext?.content).toContain('Use strict TS.');
  });

  it('non-root rule with no description or globs strips both from frontmatter', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/proj/.agentsbridge/rules/bare.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Bare rule.',
        },
      ],
    });
    const results = generateRules(canonical);
    const contextFile = results.find((r) => r.path.includes('bare'));
    expect(contextFile).toBeUndefined();
  });

  it('generateAgents produces .github/agents/{name}.agent.md', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '',
          name: 'worker',
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
          body: 'Work hard.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.github/agents/worker.agent.md');
    expect(results[0]!.content).toContain('Work hard.');
  });

  it('generateAgents emits optional mcp-servers and skills frontmatter when present', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '',
          name: 'security-reviewer',
          description: 'Reviews for security risks',
          tools: ['read_file'],
          disallowedTools: [],
          model: 'gpt-5',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: ['context7'],
          hooks: {},
          skills: ['typescript-pro'],
          memory: '',
          body: 'Review auth and secrets handling.',
        },
      ],
    });

    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.github/agents/security-reviewer.agent.md');
    expect(results[0]!.content).toContain('name: security-reviewer');
    expect(results[0]!.content).toContain('description: Reviews for security risks');
    expect(results[0]!.content).toContain('model: gpt-5');
    expect(results[0]!.content).toContain('mcp-servers');
    expect(results[0]!.content).toContain('context7');
    expect(results[0]!.content).toContain('skills');
    expect(results[0]!.content).toContain('typescript-pro');
  });

  it('generateSkills produces .github/skills/{name}/SKILL.md', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '',
          name: 'empty-skill',
          description: '',
          body: 'Just do it.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.github/skills/empty-skill/SKILL.md');
    expect(results[0]!.content).toContain('name: empty-skill');
    expect(results[0]!.content).toContain('Just do it.');
  });

  it('skips non-root rules when targets excludes copilot', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/proj/.agentsbridge/rules/cursor-only.md',
          root: false,
          targets: ['cursor'],
          description: '',
          globs: [],
          body: 'Cursor only',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path.includes('cursor-only'))).toBe(false);
  });

  it('returns empty when only commands exist and no root rule is present', () => {
    const canonical = makeCanonical({
      commands: [
        { source: '', name: 'fix', description: 'Fix', allowedTools: [], body: 'Fix it.' },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toEqual([]);
  });

  it('returns empty when no rules and no commands/agents/skills', () => {
    const canonical = makeCanonical();
    expect(generateRules(canonical)).toEqual([]);
  });
});

describe('generateCommands (copilot)', () => {
  it('generates .github/prompts/{name}.prompt.md from canonical commands', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsbridge/commands/review.md',
          name: 'review',
          description: 'Review changes',
          allowedTools: ['Read', 'Bash(git diff)'],
          body: 'Review the current pull request.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${COPILOT_PROMPTS_DIR}/review.prompt.md`);
    expect(results[0]?.content).toContain('agent: agent');
    expect(results[0]?.content).toContain('description: Review changes');
    expect(results[0]?.content).toContain('x-agentsbridge-kind: command');
    expect(results[0]?.content).toContain('x-agentsbridge-name: review');
    expect(results[0]?.content).toContain('Bash(git diff)');
    expect(results[0]?.content).toContain('Review the current pull request.');
  });

  it('returns empty when no commands exist', () => {
    expect(generateCommands(makeCanonical())).toEqual([]);
  });
});

describe('generateRules (copilot) — .github/instructions path', () => {
  it('generates .github/instructions/{slug}.instructions.md for non-root rules with globs', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root body',
        },
        {
          source: '/p/.agentsbridge/rules/react.md',
          root: false,
          targets: [],
          description: 'React rules',
          globs: ['src/**/*.tsx'],
          body: 'Use functional components.',
        },
      ],
    });
    const results = generateRules(canonical);
    const newPath = results.find((r) => r.path === '.github/instructions/react.instructions.md');
    expect(newPath).toBeDefined();
    expect(newPath?.content).toContain('applyTo');
    expect(newPath?.content).toContain('src/**/*.tsx');
    expect(newPath?.content).toContain('Use functional components.');
  });

  it('does not generate the legacy .github/copilot/ rule path', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/p/.agentsbridge/rules/ts.md',
          root: false,
          targets: [],
          description: 'TS',
          globs: ['**/*.ts'],
          body: 'TS rules.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path === '.github/copilot/ts.instructions.md')).toBe(false);
    expect(results.some((r) => r.path === '.github/instructions/ts.instructions.md')).toBe(true);
  });

  it('does not generate .github/instructions/ for rules with no globs', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/p/.agentsbridge/rules/general.md',
          root: false,
          targets: [],
          description: 'General',
          globs: [],
          body: 'General rules.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path.startsWith('.github/instructions/'))).toBe(false);
  });
});

describe('generateHooks (copilot)', () => {
  it('generates .github/hooks/*.json config from canonical hooks', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [
          { matcher: 'Write', command: 'prettier --write $FILE_PATH', type: 'command' },
          { matcher: 'Bash', command: 'echo done', type: 'command' },
        ],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.github/hooks/agentsbridge.json');
    expect(results[0]!.content).toContain('"version": 1');
    expect(results[0]!.content).toContain('"postToolUse"');
    expect(results[0]!.content).toContain('"bash"');
    expect(results[0]!.content).toContain('"comment": "Matcher: Write"');
  });

  it('maps hook timeout milliseconds to timeoutSec with ceiling', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [{ matcher: 'Write', command: 'prettier --write $FILE_PATH', timeout: 1500 }],
      },
    });

    const results = generateHooks(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain('"timeoutSec": 2');
  });

  it('skips hook entries with empty commands', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', command: '', type: 'command' },
          { matcher: 'Edit|Write', command: 'eslint --fix', type: 'command' },
        ],
        Notification: [{ matcher: '.*', command: '', type: 'command' }],
        UserPromptSubmit: [{ matcher: '.*', command: '', type: 'command' }],
      },
    });

    const results = generateHooks(canonical);

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain('"preToolUse"');
    expect(results[0]!.content).toContain('./scripts/pretooluse-0.sh');
    expect(results[0]!.content).not.toContain('"notification"');
    expect(results[0]!.content).not.toContain('"userPromptSubmitted"');
  });

  it('returns empty when no hooks', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(generateHooks(canonical)).toEqual([]);
  });

  it('returns empty when hooks has no entries', () => {
    const canonical = makeCanonical({ hooks: {} });
    expect(generateHooks(canonical)).toEqual([]);
  });
});
