/**
 * Cline generator tests.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateIgnore,
  generateMcp,
  generateAgents,
  generateSkills,
  generateWorkflows,
  generateHooks,
} from '../../../../src/targets/cline/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  CLINE_RULES_DIR,
  CLINE_IGNORE,
  CLINE_MCP_SETTINGS,
  CLINE_SKILLS_DIR,
  CLINE_WORKFLOWS_DIR,
  CLINE_HOOKS_DIR,
} from '../../../../src/targets/cline/constants.js';

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

describe('generateRules (cline)', () => {
  it('generates AGENTS.md from root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project rules',
          globs: [],
          body: '# Rules\n- Use TypeScript\n',
        },
      ],
    });
    const results = generateRules(canonical);
    const agentsMd = results.find((r) => r.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain('# Rules');
    expect(agentsMd!.content).toContain('- Use TypeScript');
    expect(agentsMd!.content).not.toContain('## AgentsMesh Generation Contract');
    expect(results.find((r) => r.path === `${CLINE_RULES_DIR}/_root.md`)).toBeUndefined();
  });

  it('generates .clinerules/*.md for non-root rules with paths frontmatter', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TS rules',
          globs: ['src/**/*.ts'],
          body: 'Use strict TS.',
        },
      ],
    });
    const results = generateRules(canonical);
    const perRule = results.find((r) => r.path === `${CLINE_RULES_DIR}/typescript.md`);
    expect(perRule).toBeDefined();
    expect(perRule?.content).toContain('description: TS rules');
    expect(perRule?.content).toContain('paths:');
    expect(perRule?.content).not.toContain('globs:');
    expect(perRule?.content).toContain('Use strict TS.');
  });

  it('skips non-root rules when targets excludes cline', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/proj/.agentsmesh/rules/cursor-only.md',
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

  it('returns empty when no root rule and no non-root for cline', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/cursor-only.md',
          root: false,
          targets: ['cursor'],
          description: '',
          globs: [],
          body: 'Cursor only',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toEqual([]);
  });

  it('outputs empty string for root rule with empty body (covers root.body.trim() ? branch)', () => {
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
    const agentsMd = results.find((r) => r.path === 'AGENTS.md');
    expect(agentsMd?.content).toBe('');
  });

  it('outputs plain body for non-root rule when no frontmatter fields', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/simple.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Plain content only.',
        },
      ],
    });
    const results = generateRules(canonical);
    const simple = results.find((r) => r.path === `${CLINE_RULES_DIR}/simple.md`);
    expect(simple?.content).toBe('Plain content only.');
  });
});

describe('generateIgnore (cline)', () => {
  it('generates .clineignore when ignore patterns present', () => {
    const canonical = makeCanonical({ ignore: ['node_modules/', 'dist/', '*.log'] });
    const results = generateIgnore(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(CLINE_IGNORE);
    expect(results[0]!.content).toContain('node_modules/');
    expect(results[0]!.content).toContain('dist/');
  });

  it('returns empty when no ignore patterns', () => {
    expect(generateIgnore(makeCanonical({ ignore: [] }))).toEqual([]);
    expect(generateIgnore(makeCanonical())).toEqual([]);
  });
});

describe('generateMcp (cline)', () => {
  it('generates .cline/mcp_settings.json when mcp present', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          fs: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
            env: {},
            type: 'stdio',
          },
        },
      },
    });
    const results = generateMcp(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(CLINE_MCP_SETTINGS);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect(parsed.mcpServers).toBeDefined();
    expect((parsed.mcpServers as Record<string, unknown>).fs).toBeDefined();
  });

  it('returns empty when no mcp', () => {
    expect(generateMcp(makeCanonical())).toEqual([]);
    expect(generateMcp(makeCanonical({ mcp: null }))).toEqual([]);
  });

  it('returns empty when mcpServers empty', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});

describe('generateSkills (cline)', () => {
  it('generates .cline/skills/*/SKILL.md from canonical skills', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/review/SKILL.md',
          name: 'review',
          description: 'Code review skill',
          body: 'Review code thoroughly.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(`${CLINE_SKILLS_DIR}/review/SKILL.md`);
    expect(results[0]!.content).toContain('name: review');
    expect(results[0]!.content).toContain('description: Code review skill');
    expect(results[0]!.content).toContain('Review code thoroughly.');
  });

  it('includes supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '',
          name: 'my-skill',
          description: '',
          body: 'Body',
          supportingFiles: [
            { relativePath: 'template.ts', absolutePath: '', content: '// template' },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.length).toBe(2);
    expect(results.some((r) => r.path.endsWith('SKILL.md'))).toBe(true);
    const template = results.find((r) => r.path.includes('template.ts'));
    expect(template?.content).toBe('// template');
  });

  it('returns empty when no skills', () => {
    expect(generateSkills(makeCanonical())).toEqual([]);
  });

  it('generates skill frontmatter when body is empty', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/empty/SKILL.md',
          name: 'empty',
          description: '',
          body: '',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain('name: empty');
    expect(results[0]!.content).not.toContain('description:');
  });
});

describe('generateAgents (cline)', () => {
  it('projects agents into reserved Cline skill directories with metadata', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/reviewer.md',
          name: 'reviewer',
          description: 'Review specialist',
          tools: ['Read', 'Grep'],
          disallowedTools: ['Bash(rm -rf *)'],
          model: 'sonnet',
          permissionMode: 'ask',
          maxTurns: 9,
          mcpServers: ['context7'],
          hooks: {},
          skills: ['post-feature-qa'],
          memory: 'notes/reviewer.md',
          body: 'Review risky changes first.',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${CLINE_SKILLS_DIR}/am-agent-reviewer/SKILL.md`);
    expect(results[0]?.content).toContain('x-agentsmesh-kind: agent');
    expect(results[0]?.content).toContain('x-agentsmesh-name: reviewer');
    expect(results[0]?.content).toContain('x-agentsmesh-tools:');
    expect(results[0]?.content).toContain('Review risky changes first.');
  });
});

describe('generateWorkflows (cline)', () => {
  it('generates markdown with description as intro paragraph when description present', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/p/.agentsmesh/commands/deploy.md',
          name: 'deploy',
          description: 'Deploy workflow',
          allowedTools: [],
          body: 'Run deploy steps.',
        },
      ],
    });
    const results = generateWorkflows(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(`${CLINE_WORKFLOWS_DIR}/deploy.md`);
    expect(results[0]!.content).toBe('Deploy workflow\n\nRun deploy steps.');
  });

  it('omits description intro paragraph when description is empty', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/p/.agentsmesh/commands/deploy.md',
          name: 'deploy',
          description: '',
          allowedTools: [],
          body: 'Run deploy steps.',
        },
      ],
    });
    const results = generateWorkflows(canonical);
    expect(results[0]!.content).toBe('Run deploy steps.');
  });

  it('returns only description when body is empty', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/p/.agentsmesh/commands/empty.md',
          name: 'empty',
          description: 'Describe only',
          allowedTools: [],
          body: '',
        },
      ],
    });
    const results = generateWorkflows(canonical);
    expect(results[0]!.content).toBe('Describe only');
  });

  it('returns empty string when both description and body are empty', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/p/.agentsmesh/commands/empty.md',
          name: 'empty',
          description: '',
          allowedTools: [],
          body: '',
        },
      ],
    });
    const results = generateWorkflows(canonical);
    expect(results[0]!.content).toBe('');
  });

  it('returns empty when no commands', () => {
    expect(generateWorkflows(makeCanonical())).toEqual([]);
  });
});

describe('generateHooks (cline)', () => {
  it('returns empty when hooks is null', () => {
    expect(generateHooks(makeCanonical({ hooks: null }))).toEqual([]);
  });

  it('returns empty when hooks object is empty', () => {
    expect(generateHooks(makeCanonical({ hooks: {} }))).toEqual([]);
  });

  it('returns empty when all entries have empty commands', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [{ matcher: 'Write', command: '' }],
      },
    });
    expect(generateHooks(canonical)).toEqual([]);
  });

  it('generates .clinerules/hooks/{event-slug}-0.sh for a single hook command', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write $FILE_PATH' }],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${CLINE_HOOKS_DIR}/posttooluse-0.sh`);
    expect(results[0]!.content).toContain('prettier --write $FILE_PATH');
    expect(results[0]!.content).toContain('Write|Edit');
    expect(results[0]!.content).toContain('#!/usr/bin/env bash');
  });

  it('generates sequential indexes for multiple entries in the same event', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [
          { matcher: 'Write', command: 'prettier --write $FILE_PATH' },
          { matcher: 'Edit', command: 'eslint --fix $FILE_PATH' },
        ],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(2);
    expect(results[0]!.path).toBe(`${CLINE_HOOKS_DIR}/posttooluse-0.sh`);
    expect(results[1]!.path).toBe(`${CLINE_HOOKS_DIR}/posttooluse-1.sh`);
    expect(results[0]!.content).toContain('prettier --write $FILE_PATH');
    expect(results[1]!.content).toContain('eslint --fix $FILE_PATH');
  });

  it('generates scripts for multiple events', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write $FILE_PATH' }],
        PreToolUse: [{ matcher: 'Bash', command: './scripts/validate.sh' }],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(2);
    const postHook = results.find((r) => r.path === `${CLINE_HOOKS_DIR}/posttooluse-0.sh`);
    const preHook = results.find((r) => r.path === `${CLINE_HOOKS_DIR}/pretooluse-0.sh`);
    expect(postHook).toBeDefined();
    expect(preHook).toBeDefined();
    expect(preHook!.content).toContain('./scripts/validate.sh');
  });

  it('skips entries with whitespace-only commands', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [
          { matcher: 'Write', command: '   ' },
          { matcher: 'Edit', command: 'prettier --write $FILE_PATH' },
        ],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${CLINE_HOOKS_DIR}/posttooluse-0.sh`);
  });
});
