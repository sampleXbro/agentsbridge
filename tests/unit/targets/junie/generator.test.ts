import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateMcp,
  generateIgnore,
  generateSkills,
  generatePermissions,
} from '../../../../src/targets/junie/generator.js';
import {
  JUNIE_DOT_AGENTS,
  JUNIE_COMMANDS_DIR,
  JUNIE_AGENTS_DIR,
  JUNIE_MCP_FILE,
  JUNIE_IGNORE,
  JUNIE_RULES_DIR,
  JUNIE_SKILLS_DIR,
  JUNIE_GLOBAL_ALLOWLIST,
} from '../../../../src/targets/junie/constants.js';

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

describe('generateRules (junie)', () => {
  it('generates root rule as .junie/AGENTS.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Root',
          globs: [],
          body: '# Guidelines\n\nUse TDD.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(JUNIE_DOT_AGENTS);
    expect(results[0].content).toContain('Use TDD.');
    expect(results[0].content).not.toContain('## AgentsMesh Generation Contract');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('generates non-root rules as .junie/rules/{slug}.md', () => {
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
    const tsRule = results.find((r) => r.path === `${JUNIE_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule!.content).toContain('Use strict TypeScript.');
    expect(tsRule!.content).not.toMatch(/^---/);
  });

  it('skips non-root rules targeting other agents only', () => {
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
          description: '',
          globs: [],
          body: 'Cursor only.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path.includes('cursor-only'))).toBe(false);
  });
});

describe('generateCommands (junie)', () => {
  it('projects canonical commands into .junie/commands with frontmatter', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/review.md',
          name: 'review',
          description: 'Review workflow',
          allowedTools: ['Read', 'Bash(git diff)'],
          body: 'Review the current diff.',
        },
      ],
    });

    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${JUNIE_COMMANDS_DIR}/review.md`);
    const parsed = parseFrontmatter(results[0]?.content ?? '');
    expect(parsed.frontmatter.description).toBe('Review workflow');
    expect(results[0]?.content).not.toContain('allowed-tools:');
    expect(parsed.body).toContain('Review the current diff.');
  });
});

describe('generateAgents (junie)', () => {
  it('projects canonical agents into .junie/agents with frontmatter', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/code-reviewer.md',
          name: 'code-reviewer',
          description: 'Performs code reviews',
          tools: ['Read', 'Grep'],
          disallowedTools: [],
          model: 'gpt-5',
          permissionMode: 'default',
          maxTurns: 8,
          mcpServers: ['context7'],
          hooks: {},
          skills: ['api-generator'],
          memory: '',
          body: 'Review changes and call out risks.',
        },
      ],
    });

    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${JUNIE_AGENTS_DIR}/code-reviewer.md`);
    const parsed = parseFrontmatter(results[0]?.content ?? '');
    expect(parsed.frontmatter.name).toBe('code-reviewer');
    expect(parsed.frontmatter.description).toBe('Performs code reviews');
    expect(parsed.frontmatter.tools).toEqual(['Read', 'Grep']);
    expect(parsed.frontmatter.model).toBe('gpt-5');
    expect(parsed.body).toContain('Review changes and call out risks.');
  });
});

describe('generateMcp (junie)', () => {
  it('writes Junie project-level mcp.json in minimal native format', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: { type: 'stdio', command: 'npx', args: ['-y', '@ctx/mcp'], env: {} },
          github: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@gh/mcp'],
            env: { GITHUB_TOKEN: '$TOKEN' },
            description: 'GitHub',
          },
        },
      },
    });

    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(JUNIE_MCP_FILE);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    const servers = (parsed as { mcpServers: Record<string, Record<string, unknown>> }).mcpServers;
    // type 'stdio' is omitted (default); empty env is omitted
    expect(servers['context7']).toEqual({ command: 'npx', args: ['-y', '@ctx/mcp'] });
    // non-empty env and description are preserved
    expect(servers['github']).toEqual({
      description: 'GitHub',
      command: 'npx',
      args: ['-y', '@gh/mcp'],
      env: { GITHUB_TOKEN: '$TOKEN' },
    });
  });
});

describe('generateIgnore (junie)', () => {
  it('writes .aiignore from canonical ignore patterns', () => {
    const results = generateIgnore(makeCanonical({ ignore: ['.env', 'node_modules/'] }));
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(JUNIE_IGNORE);
    expect(results[0]?.content).toContain('.env');
  });
});

describe('generateSkills (junie)', () => {
  it('projects canonical skills into .junie/skills with supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          name: 'api-generator',
          description: 'API Generator',
          body: 'Use `references/route-checklist.md`.',
          supportingFiles: [
            {
              absolutePath: '/proj/.agentsmesh/skills/api-generator/references/route-checklist.md',
              relativePath: 'references/route-checklist.md',
              content: '# Checklist',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);
    expect(results.map((result) => result.path).sort()).toEqual([
      `${JUNIE_SKILLS_DIR}/api-generator/SKILL.md`,
      `${JUNIE_SKILLS_DIR}/api-generator/references/route-checklist.md`,
    ]);
    const skillFile = results.find((r) => r.path === `${JUNIE_SKILLS_DIR}/api-generator/SKILL.md`)!;
    const parsedSkill = parseFrontmatter(skillFile.content);
    expect(parsedSkill.frontmatter.name).toBe('api-generator');
    expect(parsedSkill.frontmatter.description).toBe('API Generator');
    expect(parsedSkill.body).toContain('Use `references/route-checklist.md`.');
  });
});

describe('generatePermissions (junie)', () => {
  it('returns empty for project scope', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['*'], deny: [], ask: [] },
    });
    const results = generatePermissions(canonical, {
      capability: { level: 'none' },
      scope: 'project',
    });
    expect(results).toHaveLength(0);
  });

  it('returns empty for global scope with no permissions', () => {
    const results = generatePermissions(makeCanonical({ permissions: null }), {
      capability: { level: 'native' },
      scope: 'global',
    });
    expect(results).toHaveLength(0);
  });

  it('returns empty when all arrays are empty', () => {
    const results = generatePermissions(
      makeCanonical({ permissions: { allow: [], deny: [], ask: [] } }),
      { capability: { level: 'native' }, scope: 'global' },
    );
    expect(results).toHaveLength(0);
  });

  it('generates allowlist.json for global scope with categorized rules schema', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash', 'Read'], deny: ['Write'], ask: ['**/node_modules/**'] },
    });
    const results = generatePermissions(canonical, {
      capability: { level: 'native' },
      scope: 'global',
    });
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(JUNIE_GLOBAL_ALLOWLIST);
    const parsed = JSON.parse(results[0].content) as {
      defaultBehavior: string;
      allowReadonlyCommands: boolean;
      rules: {
        fileEditing: { rules: Array<{ prefix?: string; pattern?: string; action: string }> };
        executables: { rules: Array<{ prefix?: string; pattern?: string; action: string }> };
        mcpTools: { rules: Array<{ prefix?: string; pattern?: string; action: string }> };
        readOutsideProject: { rules: Array<{ prefix?: string; pattern?: string; action: string }> };
      };
    };
    expect(parsed.defaultBehavior).toBe('ask');
    expect(parsed.allowReadonlyCommands).toBe(true);
    // rules must be an object, not an array
    expect(typeof parsed.rules).toBe('object');
    expect(Array.isArray(parsed.rules)).toBe(false);
    // all four required sub-keys must exist
    expect(typeof parsed.rules.fileEditing).toBe('object');
    expect(typeof parsed.rules.executables).toBe('object');
    expect(typeof parsed.rules.mcpTools).toBe('object');
    expect(typeof parsed.rules.readOutsideProject).toBe('object');
    // executables category should carry the allow entries (Bash, Read)
    const execRules = parsed.rules.executables.rules;
    expect(execRules.some((r) => r.prefix === 'Bash' && r.action === 'allow')).toBe(true);
    expect(execRules.some((r) => r.prefix === 'Read' && r.action === 'allow')).toBe(true);
    // executables deny (Write) mapped as ask (Junie has no deny action)
    expect(execRules.some((r) => r.prefix === 'Write' && r.action === 'ask')).toBe(true);
    // ask glob entry uses 'pattern' not 'prefix'
    expect(execRules.some((r) => r.pattern === '**/node_modules/**' && r.action === 'ask')).toBe(
      true,
    );
  });
});
