/**
 * Gemini CLI importer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromGemini } from '../../../../src/targets/gemini-cli/importer.js';
import {
  GEMINI_ROOT,
  GEMINI_RULES_DIR,
  GEMINI_COMMANDS_DIR,
  GEMINI_POLICIES_DIR,
  GEMINI_SETTINGS,
  GEMINI_SKILLS_DIR,
} from '../../../../src/targets/gemini-cli/constants.js';

const TEST_DIR = join(tmpdir(), 'am-gemini-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromGemini', () => {
  it('imports GEMINI.md into _root.md with root frontmatter', async () => {
    writeFileSync(join(TEST_DIR, GEMINI_ROOT), '# Gemini Rules\n- Use TDD\n');
    const results = await importFromGemini(TEST_DIR);
    expect(results.length).toBe(1);
    expect(results[0]!.fromTool).toBe('gemini-cli');
    expect(results[0]!.toPath).toBe('.agentsmesh/rules/_root.md');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Gemini Rules');
    expect(content).toContain('- Use TDD');
  });

  it('imports .gemini/rules/*.md into canonical rules', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_RULES_DIR, 'ts.md'),
      '---\ndescription: TS rules\nglobs: ["**/*.ts"]\n---\n\nTypeScript guidelines.',
    );
    const results = await importFromGemini(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsmesh/rules/ts.md');
    expect(ruleResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'ts.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('globs');
    expect(content).toContain('TypeScript guidelines');
  });

  it('imports .gemini/commands/*.md into canonical commands', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_COMMANDS_DIR, 'review.md'),
      '---\ndescription: Code review\nallowed-tools: ["Read", "Grep"]\n---\n\nRun code review.',
    );
    const results = await importFromGemini(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/review.md');
    expect(cmdResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Code review');
    expect(content).toContain('allowed-tools');
    expect(content).toContain('Run code review');
  });

  it('imports nested .gemini/commands/<ns>/*.toml preserving directories', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR, 'git'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_COMMANDS_DIR, 'git', 'commit.toml'),
      ['description = "Git commit"', "prompt = '''", 'Generate a commit message.', "'''", ''].join(
        '\n',
      ),
    );

    const results = await importFromGemini(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/git/commit.md');
    expect(cmdResult).toBeDefined();

    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'git', 'commit.md'),
      'utf-8',
    );
    expect(content).toContain('description');
    expect(content).toContain('Git commit');
    expect(content).toContain('Generate a commit message.');
  });

  it('parses TOML frontmatter in commands (+++ delimited)', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_COMMANDS_DIR, 'lint.md'),
      '+++\ndescription = "Lint code"\nallowed-tools = ["Read", "Bash"]\n+++\n\nRun lint.',
    );
    const results = await importFromGemini(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/lint.md');
    expect(cmdResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'lint.md'), 'utf-8');
    expect(content).toContain('description');
    expect(content).toContain('Lint code');
    expect(content).toContain('Run lint');
  });

  it('preserves existing canonical allowed-tools when importing generated TOML commands', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Code review\nallowed-tools:\n  - Read\n  - Grep\n---\n\nOld body.',
    );
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_COMMANDS_DIR, 'review.toml'),
      'description = "Code review"\nprompt = """\nNew body from Gemini.\n"""\n',
    );

    await importFromGemini(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Code review');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('- Read');
    expect(content).toContain('- Grep');
    expect(content).toContain('New body from Gemini.');
    expect(content).not.toContain('Old body.');
  });

  it('decomposes settings.json into mcp.json, hooks.yaml, ignore', async () => {
    mkdirSync(join(TEST_DIR, '.gemini'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_SETTINGS),
      JSON.stringify({
        mcpServers: {
          fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
        },
        ignorePatterns: ['node_modules', 'dist'],
        hooks: {
          postToolUse: [{ matcher: 'Write', command: 'prettier --write .' }],
        },
      }),
    );
    const results = await importFromGemini(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/ignore')).toBe(true);

    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(mcp.mcpServers.fs).toBeDefined();
    expect((mcp.mcpServers.fs as { command: string }).command).toBe('npx');

    const hooks = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(hooks).toContain('PostToolUse');
    expect(hooks).toContain('matcher');
    expect(hooks).toContain('prettier');

    const ignoreContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(ignoreContent).toContain('node_modules');
    expect(ignoreContent).toContain('dist');
  });

  it('imports .gemini/policies/*.toml into canonical .agentsmesh/permissions.yaml', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_POLICIES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_POLICIES_DIR, 'permissions.toml'),
      [
        '[[rule]]',
        'toolName = "read_file"',
        'decision = "allow"',
        'priority = 10',
        '',
        '[[rule]]',
        'toolName = "run_shell_command"',
        'commandPrefix = "curl"',
        'decision = "deny"',
        'priority = 20',
        '',
      ].join('\n'),
    );

    const results = await importFromGemini(TEST_DIR);
    const permResult = results.find((r) => r.toPath === '.agentsmesh/permissions.yaml');
    expect(permResult).toBeDefined();

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(content).toContain('Read');
    expect(content).toContain('Bash(curl:*)');
  });

  it('skips empty-string hook commands when importing Gemini settings hooks', async () => {
    mkdirSync(join(TEST_DIR, '.gemini'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_SETTINGS),
      JSON.stringify({
        hooks: {
          Notification: [{ matcher: '.*', hooks: [{ type: 'command', command: '' }] }],
          AfterTool: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo done' }] }],
        },
      }),
    );

    await importFromGemini(TEST_DIR);

    const hooks = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(hooks).not.toContain('Notification');
    expect(hooks).toContain('PostToolUse');
    expect(hooks).toContain('echo done');
  });

  it('imports all sources when multiple exist', async () => {
    writeFileSync(join(TEST_DIR, GEMINI_ROOT), 'Root');
    mkdirSync(join(TEST_DIR, GEMINI_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, GEMINI_RULES_DIR, 'foo.md'), '---\n---\n\nFoo rule');
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, GEMINI_COMMANDS_DIR, 'bar.md'), '---\n---\n\nBar command');
    const results = await importFromGemini(TEST_DIR);
    expect(results.length).toBe(3);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/foo.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/commands/bar.md')).toBe(true);
  });

  it('handles malformed TOML frontmatter (unclosed +++ with no close)', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_RULES_DIR, 'bad-toml.md'),
      '+++\ndescription = "No close delimiter\n\nBody without close.',
    );
    const results = await importFromGemini(TEST_DIR);
    const rule = results.find((r) => r.toPath === '.agentsmesh/rules/bad-toml.md');
    expect(rule).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'bad-toml.md'), 'utf-8');
    expect(content).toContain('+++');
  });

  it('handles TOML parse error gracefully (invalid syntax)', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_RULES_DIR, 'invalid-toml.md'),
      '+++\n= this is invalid toml ===\n+++\n\nBody text.',
    );
    const results = await importFromGemini(TEST_DIR);
    const rule = results.find((r) => r.toPath === '.agentsmesh/rules/invalid-toml.md');
    expect(rule).toBeDefined();
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'invalid-toml.md'),
      'utf-8',
    );
    expect(content).toContain('Body text.');
  });

  it('imports .gemini/skills/{name}/SKILL.md into canonical skills', async () => {
    const skillDir = join(TEST_DIR, GEMINI_SKILLS_DIR, 'qa');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: QA checklist\n---\n\nRun QA steps.',
    );
    const results = await importFromGemini(TEST_DIR);
    const skillResult = results.find((r) => r.toPath === '.agentsmesh/skills/qa/SKILL.md');
    expect(skillResult).toBeDefined();
    expect(skillResult!.feature).toBe('skills');
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'qa', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('QA checklist');
    expect(content).toContain('Run QA steps.');
  });

  it('adds placeholder skill frontmatter when Gemini skills have body only', async () => {
    const skillDir = join(TEST_DIR, GEMINI_SKILLS_DIR, 'qa');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'Run QA steps.\n');

    await importFromGemini(TEST_DIR);

    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'qa', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('name: qa');
    expect(content).toContain('description: ""');
    expect(content).toContain('Run QA steps.');
  });

  it('imports projected agent skills back into canonical agents', async () => {
    const skillDir = join(TEST_DIR, GEMINI_SKILLS_DIR, 'am-agent-reviewer');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'description: Review specialist',
        'x-agentsmesh-kind: agent',
        'x-agentsmesh-name: reviewer',
        'x-agentsmesh-tools:',
        '  - Read',
        '  - Grep',
        'x-agentsmesh-disallowed-tools:',
        '  - Bash(rm -rf *)',
        'x-agentsmesh-model: gemini-2.5-pro',
        'x-agentsmesh-permission-mode: ask',
        'x-agentsmesh-max-turns: 9',
        'x-agentsmesh-mcp-servers:',
        '  - context7',
        'x-agentsmesh-skills:',
        '  - post-feature-qa',
        'x-agentsmesh-memory: notes/reviewer.md',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );

    const results = await importFromGemini(TEST_DIR);

    expect(results.find((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBeDefined();
    expect(
      results.find((r) => r.toPath === '.agentsmesh/skills/am-agent-reviewer/SKILL.md'),
    ).toBeUndefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Review specialist');
    expect(content).toContain('model: gemini-2.5-pro');
    expect(content).toContain('Review risky changes first.');
  });

  it('imports multiple skills from .gemini/skills/', async () => {
    for (const name of ['qa', 'review']) {
      const skillDir = join(TEST_DIR, GEMINI_SKILLS_DIR, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), `# ${name} skill`);
    }
    const results = await importFromGemini(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/skills/qa/SKILL.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/skills/review/SKILL.md')).toBe(true);
  });

  it('returns empty when no Gemini config found', async () => {
    const results = await importFromGemini(TEST_DIR);
    expect(results).toEqual([]);
  });

  it('handles GEMINI.md with frontmatter', async () => {
    writeFileSync(join(TEST_DIR, GEMINI_ROOT), '---\ndescription: Global rules\n---\n\nRoot body');
    const results = await importFromGemini(TEST_DIR);
    expect(results.length).toBe(1);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('description: Global rules');
    expect(content).toContain('Root body');
  });

  it('writes only mcp when settings has only mcpServers', async () => {
    mkdirSync(join(TEST_DIR, '.gemini'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_SETTINGS),
      JSON.stringify({ mcpServers: { x: { command: 'echo' } } }),
    );
    const results = await importFromGemini(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBe(false);
    expect(results.some((r) => r.toPath === '.agentsmesh/ignore')).toBe(false);
  });

  it('skips empty or invalid settings.json', async () => {
    mkdirSync(join(TEST_DIR, '.gemini'), { recursive: true });
    writeFileSync(join(TEST_DIR, GEMINI_SETTINGS), '{}');
    writeFileSync(join(TEST_DIR, GEMINI_ROOT), 'Root');
    const results = await importFromGemini(TEST_DIR);
    expect(results.length).toBe(1);
    expect(results[0]!.toPath).toBe('.agentsmesh/rules/_root.md');
  });

  it('parses command with allowed-tools as comma-separated string (toToolsArray string branch)', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_COMMANDS_DIR, 'string-tools.md'),
      '---\ndescription: Tools as string\nallowed-tools: "Read, Grep, Bash"\n---\n\nUse tools.',
    );
    const results = await importFromGemini(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/string-tools.md');
    expect(cmdResult).toBeDefined();
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'string-tools.md'),
      'utf-8',
    );
    expect(content).toContain('allowed-tools');
    expect(content).toContain('Read');
    expect(content).toContain('Grep');
  });

  it('parses command with TOML frontmatter', async () => {
    mkdirSync(join(TEST_DIR, GEMINI_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, GEMINI_COMMANDS_DIR, 'toml-cmd.md'),
      '+++\ndescription = "TOML command"\nallowed-tools = ["Read", "Grep"]\n+++\n\nBody text',
    );
    const results = await importFromGemini(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/toml-cmd.md');
    expect(cmdResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'toml-cmd.md'), 'utf-8');
    expect(content).toContain('description');
    expect(content).toContain('allowed-tools');
    expect(content).toContain('Body text');
  });
});
