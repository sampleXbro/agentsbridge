import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { fileContains, fileExists, readJson, readText, readYaml } from './helpers/assertions.js';

describe('import capabilities', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('imports Claude Code commands, skills, settings, and ignore', async () => {
    dir = createTestProject('claude-code-project');
    const result = await runCli('import --from claude-code', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Run code review');
    fileContains(join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'), 'API Generator');
    fileContains(join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'), 'Router');
    fileContains(join(dir, '.agentsmesh', 'permissions.yaml'), 'Bash(curl:*)');
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'prettier --write $FILE_PATH');
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
    expect(readJson(join(dir, '.agentsmesh', 'mcp.json'))['mcpServers']).toBeTruthy();
  });

  it('imports Cursor commands, skills, settings, mcp, and ignore', async () => {
    dir = createTestProject('cursor-project');
    const result = await runCli('import --from cursor', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Code review workflow');
    fileContains(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'), '# Debugging');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'),
      'Reproduce the issue first',
    );
    fileContains(join(dir, '.agentsmesh', 'permissions.yaml'), 'Bash(curl:*)');
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'timeout: 30');
    fileContains(join(dir, '.agentsmesh', 'ignore'), '*.log');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'context7');
  });

  it('imports Copilot prompt files, legacy/new instructions, agents, skills, and hooks', async () => {
    dir = createTestProject('copilot-project');
    const result = await runCli('import --from copilot', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Global Copilot Instructions');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'No `any` types');
    fileContains(join(dir, '.agentsmesh', 'rules', 'backend.md'), 'src/**/*.ts');
    fileContains(
      join(dir, '.agentsmesh', 'commands', 'review.md'),
      'Review the current pull request',
    );
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Bash(git diff)');
    fileContains(join(dir, '.agentsmesh', 'agents', 'researcher.md'), 'context7');
    fileContains(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'), '# Debugging');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'),
      'Capture exact repro steps',
    );
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'PostToolUse');
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'prettier --write');
  });

  it('imports Continue rules, embedded prompt rules, and mcp', async () => {
    dir = createTestProject('continue-project');
    const result = await runCli('import --from continue', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Project standards');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'strict TypeScript');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review the current diff');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'allowed-tools');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'context7');
  });

  it('imports Junie guidelines, commands, agents, project mcp, and .aiignore', async () => {
    dir = createTestProject('junie-project');
    const result = await runCli('import --from junie', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Junie Guidelines');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review Junie output');
    fileContains(join(dir, '.agentsmesh', 'agents', 'security-reviewer.md'), 'Security reviewer');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'context7');
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
  });

  it('imports Kiro AGENTS, steering, skills, hooks, project mcp, and .kiroignore', async () => {
    dir = createTestProject('kiro-project');
    const result = await runCli('import --from kiro', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Kiro Workspace');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'src/**/*.ts');
    fileContains(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'), '# Debugging');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'),
      'Reproduce the issue first',
    );
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'PreToolUse');
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'Review the latest changes.');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'context7');
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
  });

  it('imports Junie root from .junie/ci-guidelines.md fallback when primary files are absent', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.junie'), { recursive: true });
    writeFileSync(join(dir, '.junie', 'ci-guidelines.md'), '# CI only fallback\n\nUse CI policy.');

    const result = await runCli('import --from junie', dir);
    expect(result.exitCode, result.stderr).toBe(0);
    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'CI only fallback');
  });

  it('prefers .junie/guidelines.md over .junie/ci-guidelines.md when both exist', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.junie'), { recursive: true });
    writeFileSync(join(dir, '.junie', 'guidelines.md'), '# Preferred guidelines\n');
    writeFileSync(join(dir, '.junie', 'ci-guidelines.md'), '# CI fallback\n');

    const result = await runCli('import --from junie', dir);
    expect(result.exitCode, result.stderr).toBe(0);
    const rootPath = join(dir, '.agentsmesh', 'rules', '_root.md');
    fileContains(rootPath, 'Preferred guidelines');
  });

  it('imports Cline rules, workflows, skills, ignore, and mcp', async () => {
    dir = createTestProject('cline-project');
    const result = await runCli('import --from cline', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileExists(join(dir, '.agentsmesh', 'rules', '_root.md'));
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review workflow');
    fileContains(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'), '# Debugging');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'),
      'Reproduce the failure',
    );
    fileContains(join(dir, '.agentsmesh', 'ignore'), 'node_modules');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'context7');
  });

  it('imports flat .clinerules as the canonical root rule', async () => {
    dir = createTestProject('cline-flat-project');
    const result = await runCli('import --from cline', dir);
    expect(result.exitCode, result.stderr).toBe(0);
    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Flat Cline Rules');
  });

  it('imports Gemini TOML frontmatter, skills, and settings-derived files', async () => {
    dir = createTestProject('gemini-project');
    const result = await runCli('import --from gemini-cli', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'TypeScript strict mode');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'src/**/*.ts');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'allowed-tools');
    fileContains(join(dir, '.agentsmesh', 'skills', 'research', 'SKILL.md'), '# Research');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), '@upstash/context7-mcp');
    fileContains(join(dir, '.agentsmesh', 'ignore'), 'node_modules');
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'PostToolUse');
  });

  it('imports Codex from AGENTS.md first, plus command-skills, skills, and mcp', async () => {
    dir = createTestProject('codex-project');
    const result = await runCli('import --from codex-cli', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const rootRule = readText(join(dir, '.agentsmesh', 'rules', '_root.md'));
    expect(rootRule).toContain('Codex Preferred Rules');
    expect(rootRule).not.toContain('Codex Project Rules');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review pull-request changes');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Bash(git diff)');
    fileContains(join(dir, '.agentsmesh', 'skills', 'reviewer', 'SKILL.md'), '# Reviewer');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'reviewer', 'references', 'checklist.md'),
      'Check behavior changes',
    );
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'github-enterprise');
  });

  it('imports Windsurf rules, workflows, skills, hooks, mcp, and ignore', async () => {
    dir = createTestProject('windsurf-project');
    const result = await runCli('import --from windsurf', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Windsurf Rules');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'always_on');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review workflow');
    fileContains(join(dir, '.agentsmesh', 'skills', 'research', 'SKILL.md'), '# Research');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'research', 'references', 'checklist.md'),
      'Gather official docs',
    );
    fileContains(join(dir, '.agentsmesh', 'hooks.yaml'), 'PostToolUse');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'context7');
    fileContains(join(dir, '.agentsmesh', 'ignore'), 'node_modules');

    const hooks = readYaml(join(dir, '.agentsmesh', 'hooks.yaml'));
    expect(hooks).toHaveProperty('PostToolUse');
    expect(hooks['PostToolUse']).toEqual([
      {
        matcher: '.*',
        type: 'command',
        command: 'npm run lint',
      },
    ]);
  });

  it('imports Antigravity rules, workflows, and skills', async () => {
    dir = createTestProject('antigravity-project');
    const result = await runCli('import --from antigravity', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Project Rules');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'strict TypeScript');
    fileContains(join(dir, '.agentsmesh', 'rules', 'testing.md'), 'failing tests first');
    fileContains(
      join(dir, '.agentsmesh', 'commands', 'review.md'),
      'Review the current change set',
    );
    fileContains(join(dir, '.agentsmesh', 'commands', 'test.md'), 'full test suite');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'typescript-pro', 'SKILL.md'),
      'typescript-pro',
    );
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'typescript-pro', 'references', 'advanced-types.md'),
      'discriminated unions',
    );
  });

  it('imports Roo Code rules, commands, skills, mcp, and .rooignore', async () => {
    dir = createTestProject('roo-code-project');
    const result = await runCli('import --from roo-code', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Project Instructions');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'strict mode');
    fileContains(join(dir, '.agentsmesh', 'rules', 'testing.md'), 'TDD');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review all changed files');
    fileContains(join(dir, '.agentsmesh', 'commands', 'test.md'), 'full test suite');
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'typescript-pro', 'SKILL.md'),
      'typescript-pro',
    );
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'typescript-pro', 'references', 'advanced-types.md'),
      'Conditional Types',
    );
    expect(readJson(join(dir, '.agentsmesh', 'mcp.json'))['mcpServers']).toBeTruthy();
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
  });

  it('imports Roo Code root from .roorules fallback when .roo/rules/ is absent', async () => {
    dir = createTestProject('canonical-no-config');
    writeFileSync(join(dir, '.roorules'), '# Flat root rule\n\nUse minimal edits.');

    const result = await runCli('import --from roo-code', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Flat root rule');
  });

  it('imports Kilo Code AGENTS.md, rules, commands, agents, skills, .kilo/mcp.json, and .kilocodeignore', async () => {
    dir = createTestProject('kilo-code-project');
    const result = await runCli('import --from kilo-code', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Kilo Code Project Guide');
    fileContains(join(dir, '.agentsmesh', 'rules', 'typescript.md'), 'Strict mode is mandatory');
    fileContains(join(dir, '.agentsmesh', 'rules', 'testing.md'), 'behaviour-driven test names');
    fileContains(
      join(dir, '.agentsmesh', 'commands', 'review.md'),
      'Review the currently staged changes',
    );
    fileContains(join(dir, '.agentsmesh', 'commands', 'commit.md'), 'type(scope): message');

    // First-class agents round-trip with description and body.
    fileContains(
      join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'You are an expert code reviewer',
    );
    fileContains(
      join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'description: Review code for quality',
    );
    fileContains(
      join(dir, '.agentsmesh', 'agents', 'researcher.md'),
      'You are a research specialist',
    );

    // Skills round-trip with supporting files.
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
      'name: api-generator',
    );
    fileContains(
      join(dir, '.agentsmesh', 'skills', 'api-generator', 'references', 'route-checklist.md'),
      'Route Checklist',
    );

    // MCP and ignore.
    expect(readJson(join(dir, '.agentsmesh', 'mcp.json'))['mcpServers']).toBeTruthy();
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
  });

  it('imports legacy Kilo Code config (.kilocode/ + .kilocodemodes) into canonical', async () => {
    dir = createTestProject('canonical-no-config');
    mkdirSync(join(dir, '.kilocode', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.kilocode', 'rules', 'tdd.md'), '# TDD\n\nWrite failing tests first.');
    mkdirSync(join(dir, '.kilocode', 'workflows'), { recursive: true });
    writeFileSync(
      join(dir, '.kilocode', 'workflows', 'plan-phase.md'),
      '---\ndescription: Plan a delivery phase\n---\n\nGather context, then plan.',
    );
    writeFileSync(
      join(dir, '.kilocodemodes'),
      [
        'customModes:',
        '  - slug: gsd-mapper',
        '    name: GSD Mapper',
        '    description: Maps the codebase',
        '    roleDefinition: |',
        '      You map structures.',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, '.kilocode', 'mcp.json'),
      JSON.stringify({
        mcpServers: { 'legacy-server': { command: 'python', args: ['s.py'] } },
      }),
    );
    writeFileSync(join(dir, '.kilocodeignore'), '.env\nnode_modules/\n');

    const result = await runCli('import --from kilo-code', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', 'tdd.md'), 'Write failing tests first');
    fileContains(
      join(dir, '.agentsmesh', 'commands', 'plan-phase.md'),
      'Gather context, then plan.',
    );
    fileContains(
      join(dir, '.agentsmesh', 'agents', 'gsd-mapper.md'),
      'description: Maps the codebase',
    );
    fileContains(join(dir, '.agentsmesh', 'agents', 'gsd-mapper.md'), 'You map structures.');
    expect(readJson(join(dir, '.agentsmesh', 'mcp.json'))['mcpServers']).toHaveProperty(
      'legacy-server',
    );
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
  });

  it('imports Windsurf fallback root and ignore when only AGENTS.md and .codeiumignore exist', async () => {
    dir = createTestProject('windsurf-agents-project');
    const result = await runCli('import --from windsurf', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Windsurf Fallback Rules');
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
  });

  it('imports Amp AGENTS.md, skills, and MCP from .amp/settings.json', async () => {
    dir = createTestProject('amp-project');
    const result = await runCli('import --from amp', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Project Instructions');
    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'root: true');
    fileExists(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'));
    fileContains(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'), 'name: debugging');
    fileExists(join(dir, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'));
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'filesystem');
  });

  it('imports Zed .rules and MCP from .zed/settings.json', async () => {
    dir = createTestProject('zed-project');
    const result = await runCli('import --from zed', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Project Instructions');
    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'root: true');
    fileContains(join(dir, '.agentsmesh', 'mcp.json'), 'filesystem');
  });

  it('imports Goose .goosehints, skills, and .gooseignore', async () => {
    dir = createTestProject('goose-project');
    const result = await runCli('import --from goose', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'Project Instructions');
    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), 'root: true');
    fileContains(join(dir, '.agentsmesh', 'ignore'), '.env');
    fileContains(join(dir, '.agentsmesh', 'ignore'), 'node_modules/');
    fileExists(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'));
    fileContains(join(dir, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'), 'name: debugging');
    fileExists(join(dir, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'));
  });
});
