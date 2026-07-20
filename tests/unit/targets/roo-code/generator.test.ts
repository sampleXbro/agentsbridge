import { describe, it, expect } from 'vitest';
import { parse as yamlParse } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateMcp,
  generateIgnore,
  generateSkills,
  generateAgents,
  generatePermissions,
} from '../../../../src/targets/roo-code/generator.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_MODES_FILE,
  ROO_CODE_VSCODE_SETTINGS,
  ROO_CODE_ALLOWED_COMMANDS_KEY,
  ROO_CODE_DENIED_COMMANDS_KEY,
} from '../../../../src/targets/roo-code/constants.js';

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

describe('generateRules (roo-code)', () => {
  it('generates root rule as .roo/rules/00-root.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Root instructions',
          globs: [],
          body: '# Root\n\nUse TDD.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_ROOT_RULE);
    expect(results[0].content).toContain('Use TDD.');
  });

  it('generates non-root rules as .roo/rules/{slug}.md', () => {
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
          description: '',
          globs: [],
          body: 'Use strict TypeScript.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(2);
    const tsRule = results.find((r) => r.path === `${ROO_CODE_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule?.content).toContain('Use strict TypeScript.');
  });

  it('skips rules filtered to other targets', () => {
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
          source: '/proj/.agentsmesh/rules/claude-only.md',
          root: false,
          targets: ['claude-code'],
          description: '',
          globs: [],
          body: 'Claude only rule.',
        },
        {
          source: '/proj/.agentsmesh/rules/roo-only.md',
          root: false,
          targets: ['roo-code'],
          description: '',
          globs: [],
          body: 'Roo only rule.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(2);
    expect(results.some((r) => r.path.includes('claude-only'))).toBe(false);
    expect(results.some((r) => r.path.includes('roo-only'))).toBe(true);
  });

  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toEqual([]);
  });

  it('emits empty content for a root rule with a blank body', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '   \n  ',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_ROOT_RULE);
    expect(results[0].content).toBe('');
  });

  it('emits empty content for a non-root rule with a blank body', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/empty.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: '\n\n',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${ROO_CODE_RULES_DIR}/empty.md`);
    expect(results[0].content).toBe('');
  });
});

describe('generateCommands (roo-code)', () => {
  it('generates command files in .roo/commands/', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/review.md',
          name: 'review',
          description: 'Review the code',
          allowedTools: ['Read', 'Grep'],
          body: 'Review all changed files.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${ROO_CODE_COMMANDS_DIR}/review.md`);
    expect(results[0].content).toContain('Review all changed files.');
  });

  it('includes description in command frontmatter', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/test.md',
          name: 'test',
          description: 'Run tests',
          allowedTools: [],
          body: 'Run all tests.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results[0].content).toContain('description: Run tests');
  });

  it('omits description frontmatter when empty', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/commit.md',
          name: 'commit',
          description: '',
          allowedTools: [],
          body: 'Commit changes.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results[0].content).not.toContain('description:');
    expect(results[0].content).toContain('Commit changes.');
  });

  it('emits empty body when command body is blank', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/noop.md',
          name: 'noop',
          description: 'Does nothing',
          allowedTools: [],
          body: '   \n  ',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${ROO_CODE_COMMANDS_DIR}/noop.md`);
    expect(results[0].content).toContain('description: Does nothing');
  });

  it('returns empty array when no commands', () => {
    expect(generateCommands(makeCanonical())).toEqual([]);
  });
});

describe('generateMcp (roo-code)', () => {
  it('generates .roo/mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          'my-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: {},
          },
        },
      },
    });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_MCP_FILE);
    const parsed = JSON.parse(results[0].content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['my-server']).toBeDefined();
  });

  it('returns empty array when mcp is null', () => {
    expect(generateMcp(makeCanonical())).toEqual([]);
  });

  it('returns empty array when mcpServers is empty', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});

describe('generateIgnore (roo-code)', () => {
  it('generates .rooignore', () => {
    const canonical = makeCanonical({ ignore: ['.env', 'node_modules/'] });
    const results = generateIgnore(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_IGNORE);
    expect(results[0].content).toBe('.env\nnode_modules/');
  });

  it('returns empty array when no ignore patterns', () => {
    expect(generateIgnore(makeCanonical())).toEqual([]);
  });

  it('emits nothing in global scope (Roo Code has no home-directory ignore concept)', () => {
    const canonical = makeCanonical({ ignore: ['.env'] });
    expect(generateIgnore(canonical, { capability: { level: 'none' }, scope: 'global' })).toEqual(
      [],
    );
  });
});

describe('generateAgents (roo-code)', () => {
  it('converts agents to customModes YAML in .roomodes', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/code-reviewer.md',
          name: 'Code Reviewer',
          description: 'Reviews code for quality',
          body: 'You are an expert code reviewer.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_MODES_FILE);
    const parsed = yamlParse(results[0].content) as { customModes: Array<Record<string, unknown>> };
    expect(Array.isArray(parsed.customModes)).toBe(true);
    expect(parsed.customModes).toHaveLength(1);
    expect(parsed.customModes[0].slug).toBe('code-reviewer');
    expect(parsed.customModes[0].name).toBe('Code Reviewer');
    expect(parsed.customModes[0].description).toBe('Reviews code for quality');
    expect(parsed.customModes[0].roleDefinition).toBe('You are an expert code reviewer.');
    // Roo Code's modeConfigSchema requires `groups` (no default) — omitting it
    // makes CustomModesManager.loadModesFromFile() drop ALL modes in the file.
    expect(Array.isArray(parsed.customModes[0].groups)).toBe(true);
    expect((parsed.customModes[0].groups as string[]).length).toBeGreaterThan(0);
  });

  it('always emits a non-empty roleDefinition (schema requires min length 1)', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/blank-body.md',
          name: 'Blank Body',
          description: 'Has no body',
          body: '   \n  ',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    const parsed = yamlParse(results[0].content) as { customModes: Array<Record<string, unknown>> };
    expect(String(parsed.customModes[0].roleDefinition ?? '').length).toBeGreaterThan(0);
  });

  it('defaults groups to the safe permissive set when the agent specifies no tools', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/generalist.md',
          name: 'Generalist',
          description: '',
          body: 'Do everything.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    const parsed = yamlParse(results[0].content) as { customModes: Array<Record<string, unknown>> };
    expect(parsed.customModes[0].groups).toEqual(['read', 'edit', 'command', 'mcp']);
  });

  it('maps canonical tools to a restricted groups subset', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/read-only.md',
          name: 'Read Only',
          description: '',
          body: 'Read only.',
          tools: ['Read', 'Grep'],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    const parsed = yamlParse(results[0].content) as { customModes: Array<Record<string, unknown>> };
    expect(parsed.customModes[0].groups).toEqual(['read']);
  });

  it('produces slug from source basename without extension', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/test-writer.md',
          name: 'Test Writer',
          description: '',
          body: 'Write tests.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    const content = results[0].content;
    expect(content).toContain('slug: test-writer');
  });

  it('omits description when empty', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/helper.md',
          name: 'Helper',
          description: '',
          body: 'Help.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results[0].content).not.toContain('description:');
  });

  it('returns empty array when no agents', () => {
    expect(generateAgents(makeCanonical())).toEqual([]);
  });

  it('converts multiple agents to multiple customModes', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/reviewer.md',
          name: 'Reviewer',
          description: 'Reviews',
          body: 'Review code.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
        {
          source: '/proj/.agentsmesh/agents/writer.md',
          name: 'Writer',
          description: 'Writes',
          body: 'Write code.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('reviewer');
    expect(results[0].content).toContain('writer');
  });
});

describe('generateSkills (roo-code)', () => {
  it('generates skill SKILL.md in .roo/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/typescript-pro/SKILL.md',
          name: 'typescript-pro',
          description: 'Advanced TypeScript patterns',
          body: '# TypeScript Pro\n\nUse advanced types.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.some((r) => r.path === `${ROO_CODE_SKILLS_DIR}/typescript-pro/SKILL.md`)).toBe(
      true,
    );
  });

  it('includes supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/typescript-pro/SKILL.md',
          name: 'typescript-pro',
          description: 'Advanced TypeScript patterns',
          body: '# TypeScript Pro',
          supportingFiles: [
            {
              relativePath: 'references/advanced-types.md',
              absolutePath: '/proj/.agentsmesh/skills/typescript-pro/references/advanced-types.md',
              content: '# Advanced Types',
            },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(
      results.some(
        (r) => r.path === `${ROO_CODE_SKILLS_DIR}/typescript-pro/references/advanced-types.md`,
      ),
    ).toBe(true);
  });
});

describe('generatePermissions (roo-code)', () => {
  it('emits .vscode/settings.json with roo-cline.allowedCommands/deniedCommands', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash(git diff)'], deny: ['Bash(rm -rf)'], ask: ['WebSearch'] },
    });
    const results = generatePermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_VSCODE_SETTINGS);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed[ROO_CODE_ALLOWED_COMMANDS_KEY]).toEqual(['Bash(git diff)']);
    expect(parsed[ROO_CODE_DENIED_COMMANDS_KEY]).toEqual(['Bash(rm -rf)']);
    // "ask" has no Roo Code equivalent — never projected.
    expect(parsed).not.toHaveProperty('ask');
  });

  it('omits deniedCommands key when deny is empty', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Read'], deny: [] } });
    const parsed = JSON.parse(generatePermissions(canonical)[0]!.content) as Record<
      string,
      unknown
    >;
    expect(parsed[ROO_CODE_ALLOWED_COMMANDS_KEY]).toEqual(['Read']);
    expect(parsed).not.toHaveProperty(ROO_CODE_DENIED_COMMANDS_KEY);
  });

  it('emits no files when permissions are null', () => {
    expect(generatePermissions(makeCanonical())).toEqual([]);
  });

  it('emits no files when allow and deny are both empty', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: [], ask: ['WebSearch'] } });
    expect(generatePermissions(canonical)).toEqual([]);
  });

  it('emits nothing in global scope (no deterministic VS Code user-settings path)', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Read'], deny: [] } });
    expect(
      generatePermissions(canonical, { capability: { level: 'partial' }, scope: 'global' }),
    ).toEqual([]);
  });
});
