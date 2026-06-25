import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
  generateMcp,
  generateHooks,
} from '../../../../src/targets/factory-droid/generator.js';
import {
  FACTORY_DROID_ROOT_FILE,
  FACTORY_DROID_SKILLS_DIR,
  FACTORY_DROID_COMMANDS_DIR,
  FACTORY_DROID_DROIDS_DIR,
  FACTORY_DROID_MCP_FILE,
  FACTORY_DROID_HOOKS_FILE,
} from '../../../../src/targets/factory-droid/constants.js';

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

describe('generateRules (factory-droid)', () => {
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
    expect(results[0].path).toBe(FACTORY_DROID_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---/);
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
    expect(results[0].path).toBe(FACTORY_DROID_ROOT_FILE);
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

  it('includes rules targeted to factory-droid', () => {
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
          source: '/proj/.agentsmesh/rules/factory-droid-rule.md',
          root: false,
          targets: ['factory-droid'],
          description: 'Factory-only',
          globs: [],
          body: 'Factory specific rule.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Factory specific rule.');
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (factory-droid)', () => {
  it('generates skills to .factory/skills/', () => {
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

    expect(results).toHaveLength(2);
    const skillFile = results.find(
      (r) => r.path === `${FACTORY_DROID_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skillFile).toBeDefined();
    const parsedSkill = parseFrontmatter(skillFile!.content);
    expect(parsedSkill.frontmatter.name).toBe('debugging');
    expect(parsedSkill.frontmatter.description).toBe('Debug workflow');
    expect(parsedSkill.body).toContain('Reproduce first.');
    const refFile = results.find(
      (r) => r.path === `${FACTORY_DROID_SKILLS_DIR}/debugging/references/checklist.md`,
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

describe('generateCommands (factory-droid)', () => {
  it('emits native .factory/commands/<name>.md slash commands', () => {
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
    expect(results[0].path).toBe(`${FACTORY_DROID_COMMANDS_DIR}/review.md`);
    const parsedCmd = parseFrontmatter(results[0].content);
    expect(parsedCmd.frontmatter.description).toBe('Review code changes');
    expect(parsedCmd.frontmatter['allowed-tools']).toEqual(['Bash', 'Read']);
    expect(parsedCmd.frontmatter['x-agentsmesh-kind']).toBeUndefined();
    expect(parsedCmd.body).toContain('Run code review.');
  });

  it('returns empty when no commands exist', () => {
    const canonical = makeCanonical({ commands: [] });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateAgents (factory-droid)', () => {
  it('generates droid files in .factory/droids/', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'security-auditor',
          source: '/proj/.agentsmesh/agents/security-auditor.md',
          description: 'Security audit agent',
          body: 'Perform security audits on all code changes.',
          tools: ['Read', 'Grep'],
          disallowedTools: [],
          model: 'inherit',
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
    expect(results[0].path).toBe(`${FACTORY_DROID_DROIDS_DIR}/security-auditor.md`);
    const parsed = parseFrontmatter(results[0].content);
    expect(parsed.frontmatter.name).toBe('security-auditor');
    expect(parsed.frontmatter.description).toBe('Security audit agent');
    expect(parsed.frontmatter.model).toBe('inherit');
    expect(parsed.frontmatter.tools).toEqual(['Read', 'Grep']);
    expect(parsed.body).toContain('Perform security audits on all code changes.');
  });

  it('returns empty when no agents exist', () => {
    const canonical = makeCanonical({ agents: [] });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateHooks (factory-droid)', () => {
  it('returns [] when hooks is null', () => {
    expect(generateHooks(makeCanonical())).toHaveLength(0);
  });

  it('returns [] when hooks object is empty', () => {
    expect(generateHooks(makeCanonical({ hooks: {} }))).toHaveLength(0);
  });

  it('emits .factory/hooks.json wrapped under a top-level "hooks" key', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [
            {
              matcher: '*',
              command: 'echo pre',
              type: 'command',
            },
          ],
        },
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(FACTORY_DROID_HOOKS_FILE);
    const parsed = JSON.parse(results[0].content) as { hooks?: Record<string, unknown> };
    // Factory Droid nests events under "hooks" (codex-cli shape), NOT bare top-level.
    expect(parsed.PreToolUse).toBeUndefined();
    expect(parsed.hooks).toBeDefined();
    expect(parsed.hooks!.PreToolUse).toBeDefined();
  });

  it('drops prompt-type handlers (Factory hooks are command-only)', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: {
          UserPromptSubmit: [{ matcher: '.*', type: 'prompt', command: 'Review this' }],
        },
      }),
    );
    expect(results).toHaveLength(0);
  });

  it('returns [] when hooks entries are all empty arrays', () => {
    expect(generateHooks(makeCanonical({ hooks: { PreToolUse: [] } }))).toHaveLength(0);
  });
});

describe('generateMcp (factory-droid)', () => {
  it('generates .factory/mcp.json from canonical MCP', () => {
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
    expect(results[0].path).toBe(FACTORY_DROID_MCP_FILE);
    const parsed = JSON.parse(results[0].content);
    expect(parsed.mcpServers.filesystem).toBeDefined();
  });

  it('returns empty when no MCP config exists', () => {
    const canonical = makeCanonical({ mcp: null });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(0);
  });

  it('returns empty when MCP has no servers', () => {
    const canonical = makeCanonical({
      mcp: { mcpServers: {} },
    });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(0);
  });
});
