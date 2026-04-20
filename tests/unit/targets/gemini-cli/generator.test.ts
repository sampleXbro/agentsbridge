/**
 * Gemini CLI generator tests.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateGeminiSettingsFiles,
} from '../../../../src/targets/gemini-cli/generator.js';
import { generateGeminiPermissionsPolicies } from '../../../../src/targets/gemini-cli/policies-generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  GEMINI_ROOT,
  GEMINI_COMMANDS_DIR,
  GEMINI_SETTINGS,
  GEMINI_SKILLS_DIR,
  GEMINI_DEFAULT_POLICIES_FILE,
} from '../../../../src/targets/gemini-cli/constants.js';

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

describe('generateRules (gemini-cli)', () => {
  it('generates GEMINI.md from root rule', () => {
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
    expect(results.some((r) => r.path === GEMINI_ROOT)).toBe(true);
    const main = results.find((r) => r.path === GEMINI_ROOT);
    expect(main?.content).toContain('# Rules');
    expect(main?.content).toContain('- Use TypeScript');
    expect(main?.content).not.toContain('## AgentsMesh Generation Contract');
  });

  it('appends non-root rules as sections in GEMINI.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root content',
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
    // Gemini outputs: GEMINI.md + AGENTS.md
    expect(results.length).toBe(2);
    expect(results.some((r) => r.path === GEMINI_ROOT)).toBe(true);
    // Root content is present
    expect(results[0]!.content).toContain('Root content');
    // Non-root rule body is embedded as a section
    expect(results[0]!.content).toContain('Use strict TS.');
    // Sections are separated
    expect(results[0]!.content).toContain('---');
    // No separate .gemini/rules/ file
    expect(results.some((r) => r.path.includes('.gemini/rules/'))).toBe(false);
  });

  it('skips non-root rules when targets excludes gemini-cli', () => {
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

  it('generates empty GEMINI.md when root rule has empty body', () => {
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
    const main = results.find((r) => r.path === GEMINI_ROOT);
    expect(main).toBeDefined();
    expect(main?.content).toBe('');
  });

  it('appends non-root rule with _root source filename as section in GEMINI.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: false,
          targets: [],
          description: 'Special rule',
          globs: [],
          body: 'Special content.',
        },
      ],
    });
    const results = generateRules(canonical);
    // It should NOT generate a .gemini/rules/ file
    expect(results.some((r) => r.path.includes('.gemini/rules/'))).toBe(false);
  });

  it('non-root rule with globs is appended as section (no frontmatter file)', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/style.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**/*.css'],
          body: 'CSS rules.',
        },
      ],
    });
    const results = generateRules(canonical);
    // No .gemini/rules/ files generated
    expect(results.some((r) => r.path.includes('.gemini/rules/'))).toBe(false);
  });

  it('returns empty when no root rule and no non-root for gemini', () => {
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

  it('includes root content and non-root section in single GEMINI.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root content',
        },
        {
          source: '/proj/.agentsmesh/rules/ts.md',
          root: false,
          targets: [],
          description: '',
          globs: ['*.ts'],
          body: 'TS content',
        },
      ],
    });
    const results = generateRules(canonical);
    // Gemini outputs: GEMINI.md + AGENTS.md
    expect(results.length).toBe(2);
    const gemini = results.find((r) => r.path === GEMINI_ROOT);
    expect(gemini?.content).toContain('Root content');
    expect(gemini?.content).toContain('TS content');
  });
});

describe('generateCommands (gemini-cli)', () => {
  it('generates .gemini/commands/*.toml from canonical commands', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '',
          name: 'review',
          description: 'Review code',
          allowedTools: ['Read', 'Grep'],
          body: 'Do a thorough review.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(`${GEMINI_COMMANDS_DIR}/review.toml`);
    expect(results[0]!.content).toContain('description = "Review code"');
    expect(results[0]!.content).toContain('prompt = """');
    expect(results[0]!.content).toContain('Do a thorough review.');
  });

  it('generates .gemini/commands/<ns>/<cmd>.toml for `:`-namespaced commands', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '',
          name: 'git:commit',
          description: 'Commit via git',
          allowedTools: ['Read'],
          body: 'Write a commit message from changes.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${GEMINI_COMMANDS_DIR}/git/commit.toml`);
    expect(results[0]!.content).toContain('description = "Commit via git"');
    expect(results[0]!.content).toContain('Write a commit message from changes.');
  });

  it('returns empty when no commands', () => {
    const canonical = makeCanonical();
    expect(generateCommands(canonical)).toEqual([]);
  });
});

describe('generateAgents (gemini-cli)', () => {
  it('emits .gemini/agents/{name}.md with native YAML frontmatter', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/auditor.md',
          name: 'auditor',
          description: 'Security auditor',
          tools: ['read_file', 'grep_search'],
          disallowedTools: [],
          model: 'gemini-flash',
          permissionMode: '',
          maxTurns: 10,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You are a security auditor.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.gemini/agents/auditor.md');
    expect(results[0]!.content).toContain('name: auditor');
    expect(results[0]!.content).toContain('kind: local');
    expect(results[0]!.content).toContain('maxTurns: 10');
    expect(results[0]!.content).toContain('Security auditor');
    expect(results[0]!.content).toContain('security auditor');
  });

  it('returns [] when no agents', () => {
    const results = generateAgents(makeCanonical());
    expect(results).toEqual([]);
  });
});

describe('generateGeminiSettingsFiles with agents', () => {
  it('adds experimental.enableAgents: true when agents present', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/helper.md',
          name: 'helper',
          description: 'Helper',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Help.',
        },
      ],
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect((parsed.experimental as Record<string, unknown>)?.enableAgents).toBe(true);
  });
});

describe('generateSkills (gemini-cli)', () => {
  it('generates .gemini/skills/{name}/SKILL.md for each skill', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/qa/SKILL.md',
          name: 'qa',
          description: 'QA checklist',
          body: 'Run the QA checklist.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(`${GEMINI_SKILLS_DIR}/qa/SKILL.md`);
    expect(results[0]!.content).toContain('Run the QA checklist.');
    expect(results[0]!.content).toContain('description: QA checklist');
  });

  it('includes supporting files under skill directory', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/review/SKILL.md',
          name: 'review',
          description: 'Code review',
          body: 'Review code.',
          supportingFiles: [
            {
              relativePath: 'scripts/helper.sh',
              absolutePath: '/proj/.agentsmesh/skills/review/scripts/helper.sh',
              content: '#!/bin/sh\necho hi',
            },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.path === `${GEMINI_SKILLS_DIR}/review/SKILL.md`)).toBeDefined();
    expect(
      results.find((r) => r.path === `${GEMINI_SKILLS_DIR}/review/scripts/helper.sh`),
    ).toBeDefined();
  });

  it('returns empty when no skills', () => {
    const canonical = makeCanonical();
    expect(generateSkills(canonical)).toEqual([]);
  });

  it('omits description from frontmatter when empty', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/simple/SKILL.md',
          name: 'simple',
          description: '',
          body: 'Simple skill.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results[0]!.content).not.toContain('description:');
    expect(results[0]!.content).toContain('Simple skill.');
  });
});

describe('generateGeminiSettingsFiles (gemini-cli)', () => {
  it('generates .gemini/settings.json with mcpServers when mcp present', () => {
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
    const results = generateGeminiSettingsFiles(canonical);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe(GEMINI_SETTINGS);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect(parsed.mcpServers).toBeDefined();
    expect((parsed.mcpServers as Record<string, unknown>).fs).toBeDefined();
  });

  it('does not encode ignore patterns in settings.json', () => {
    const canonical = makeCanonical({
      ignore: ['node_modules', 'dist', '*.log'],
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results).toEqual([]);
  });

  it('generates .gemini/settings.json with official hook event names', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: 'Read', command: 'echo pre', type: 'command' }],
        PostToolUse: [
          { matcher: 'Write', command: 'prettier --write $FILE_PATH', type: 'command' },
        ],
      },
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results.length).toBe(1);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect(parsed.hooks).toBeDefined();
    const hooks = parsed.hooks as Record<string, unknown>;
    expect(hooks.BeforeTool).toBeDefined();
    expect(hooks.AfterTool).toBeDefined();
  });

  it('skips PostToolUse entries that lack command (entries.length === 0 after filter)', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [
          { matcher: 'Write', command: '', type: 'prompt' as const, prompt: 'Check this' },
        ],
      },
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results).toEqual([]);
  });

  it('omits unsupported canonical hook events', () => {
    const canonical = makeCanonical({
      hooks: {
        UserPromptSubmit: [{ matcher: '*', command: 'echo', type: 'command' }],
        PostToolUse: [{ matcher: 'Write', command: 'fmt', type: 'command' }],
      },
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results.length).toBe(1);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect(parsed.hooks).toBeDefined();
    const hooks = parsed.hooks as Record<string, unknown>;
    expect(hooks.UserPromptSubmit).toBeUndefined();
    expect((hooks.AfterTool as unknown[]).length).toBe(1);
  });

  it('skips empty-string hook commands instead of generating empty Notification entries', () => {
    const canonical = makeCanonical({
      hooks: {
        Notification: [{ matcher: '.*', command: '', type: 'command' }],
        PostToolUse: [{ matcher: 'Write', command: 'fmt', type: 'command' }],
      },
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results.length).toBe(1);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    const hooks = parsed.hooks as Record<string, unknown>;
    expect(hooks.Notification).toBeUndefined();
    expect((hooks.AfterTool as unknown[]).length).toBe(1);
  });

  it('returns empty when no mcp, ignore, hooks, or agents', () => {
    const canonical = makeCanonical();
    expect(generateGeminiSettingsFiles(canonical)).toEqual([]);
  });

  it('adds experimental.enableAgents: true when agents present', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/helper.md',
          name: 'helper',
          description: 'Helper',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Help.',
        },
      ],
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect((parsed.experimental as Record<string, unknown>)?.enableAgents).toBe(true);
  });

  it('merges mcp, ignore, and hooks into single settings.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          fs: {
            command: 'npx',
            args: ['server-fs'],
            env: {},
            type: 'stdio',
          },
        },
      },
      ignore: ['dist'],
      hooks: {
        PostToolUse: [{ matcher: 'Write', command: 'fmt', type: 'command' }],
      },
    });
    const results = generateGeminiSettingsFiles(canonical);
    expect(results.length).toBe(1);
    const parsed = JSON.parse(results[0]!.content) as Record<string, unknown>;
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.hooks).toBeDefined();
  });
});

describe('generateGeminiPermissionsPolicies (gemini-cli)', () => {
  it('emits .gemini/policies/permissions.toml from canonical permissions allow/deny', () => {
    const canonical = makeCanonical({
      permissions: {
        allow: ['Read', 'Bash(curl:*)'],
        deny: ['WebFetch', 'Read(./.env)'],
      },
    });

    const results = generateGeminiPermissionsPolicies(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(GEMINI_DEFAULT_POLICIES_FILE);

    const content = results[0]!.content;
    expect(content).toContain('toolName = "read_file"');
    expect(content).toContain('toolName = "run_shell_command"');
    expect(content).toContain('commandPrefix = "curl"');
    expect(content).toContain('decision = "allow"');
    expect(content).toContain('decision = "deny"');
    expect(content).toContain('argsPattern =');
  });
});
