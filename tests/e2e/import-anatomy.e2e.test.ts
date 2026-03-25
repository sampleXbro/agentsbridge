import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { dirFilesExactly, dirTreeExactly, fileContains, readText } from './helpers/assertions.js';

describe('import anatomy variants', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('imports Cursor legacy .cursorrules and .cursorindexingignore', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, '.cursorrules'), '# Legacy Cursor rules\n\nUse TDD.\n');
    writeFileSync(join(dir, '.cursorignore'), 'node_modules\n');
    writeFileSync(join(dir, '.cursorindexingignore'), 'generated\n');

    const result = await runCli('import --from cursor', dir);

    expect(result.exitCode).toBe(0);
    fileContains(join(dir, '.agentsbridge', 'rules', '_root.md'), 'Legacy Cursor rules');
    const ignore = readText(join(dir, '.agentsbridge', 'ignore'));
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('generated');
  });

  it('imports Gemini system.md as root fallback when GEMINI.md is absent', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.gemini'), { recursive: true });
    writeFileSync(join(dir, '.gemini', 'system.md'), '# Gemini system override\n\nBe concise.\n');

    const result = await runCli('import --from gemini-cli', dir);

    expect(result.exitCode).toBe(0);
    fileContains(join(dir, '.agentsbridge', 'rules', '_root.md'), 'Gemini system override');
  });

  it('imports Codex subdirectory AGENTS.md as a scoped canonical rule', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src scoped rules\n\nOnly for src.\n');

    const result = await runCli('import --from codex-cli', dir);

    expect(result.exitCode).toBe(0);
    const scopedRule = readText(join(dir, '.agentsbridge', 'rules', 'src.md'));
    expect(scopedRule).toContain('src/**');
    expect(scopedRule).toContain('Src scoped rules');
  });

  it('imports codex-cli with an exact canonical tree and no projected-skill leftovers', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'AGENTS.md'), '# Root Codex Rules\n');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src scoped rules\n\nOnly for src.\n');
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'ab-command-review'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'ab-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '.worktrees-security-collaboration.md'),
      'stale hidden rule\n',
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'tests-e2e-fixtures-codex-project.md'),
      'stale fixture rule\n',
    );
    mkdirSync(join(dir, '.worktrees', 'security-collaboration'), { recursive: true });
    writeFileSync(
      join(dir, '.worktrees', 'security-collaboration', 'AGENTS.md'),
      '# Hidden worktree rules\n',
    );
    mkdirSync(join(dir, 'tests', 'e2e', 'fixtures', 'codex-project'), { recursive: true });
    writeFileSync(
      join(dir, 'tests', 'e2e', 'fixtures', 'codex-project', 'AGENTS.md'),
      '# Fixture rules\n',
    );
    mkdirSync(join(dir, '.agents', 'skills', 'ab-command-review'), { recursive: true });
    writeFileSync(
      join(dir, '.agents', 'skills', 'ab-command-review', 'SKILL.md'),
      [
        '---',
        'description: Review changes',
        'x-agentsbridge-kind: command',
        'x-agentsbridge-name: review',
        'x-agentsbridge-allowed-tools:',
        '  - Read',
        '---',
        '',
        'Review the diff.',
      ].join('\n'),
    );
    mkdirSync(join(dir, '.agents', 'skills', 'ab-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(dir, '.agents', 'skills', 'ab-agent-reviewer', 'SKILL.md'),
      [
        '---',
        'description: Reviewer agent',
        'x-agentsbridge-kind: agent',
        'x-agentsbridge-name: reviewer',
        'x-agentsbridge-tools:',
        '  - Read',
        'x-agentsbridge-model: gpt-5-codex',
        'x-agentsbridge-permission-mode: ask',
        'x-agentsbridge-max-turns: 7',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );
    mkdirSync(join(dir, '.agents', 'skills', 'qa', 'references'), { recursive: true });
    writeFileSync(join(dir, '.agents', 'skills', 'qa', 'SKILL.md'), '# QA');
    writeFileSync(
      join(dir, '.agents', 'skills', 'qa', 'references', 'checklist.md'),
      '# Checklist',
    );

    const result = await runCli('import --from codex-cli', dir);

    expect(result.exitCode).toBe(0);
    dirFilesExactly(join(dir, '.agentsbridge', 'rules'), ['_root.md', 'src.md']);
    dirFilesExactly(join(dir, '.agentsbridge', 'commands'), ['review.md']);
    dirFilesExactly(join(dir, '.agentsbridge', 'agents'), ['reviewer.md']);
    dirTreeExactly(join(dir, '.agentsbridge', 'skills'), [
      'qa/',
      'qa/SKILL.md',
      'qa/references/',
      'qa/references/checklist.md',
    ]);
    expect(
      existsSync(join(dir, '.agentsbridge', 'rules', '.worktrees-security-collaboration.md')),
    ).toBe(false);
    expect(
      existsSync(join(dir, '.agentsbridge', 'rules', 'tests-e2e-fixtures-codex-project.md')),
    ).toBe(false);
    expect(existsSync(join(dir, '.agentsbridge', 'skills', 'ab-command-review'))).toBe(false);
    expect(existsSync(join(dir, '.agentsbridge', 'skills', 'ab-agent-reviewer'))).toBe(false);
  });

  it('imports Windsurf subdirectory AGENTS.md as a scoped canonical rule', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'AGENTS.md'), '# Root rules\n');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src windsurf rules\n\nOnly for src.\n');

    const result = await runCli('import --from windsurf', dir);

    expect(result.exitCode).toBe(0);
    const scopedRule = readText(join(dir, '.agentsbridge', 'rules', 'src.md'));
    expect(scopedRule).toContain('src/**');
    expect(scopedRule).toContain('Src windsurf rules');
  });

  it('imports windsurf with an exact canonical tree and no projected-skill leftovers', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'AGENTS.md'), '# Root Windsurf Rules\n');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src windsurf rules\n\nOnly for src.\n');
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'ab-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '.worktrees-security-collaboration.md'),
      'stale hidden rule\n',
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'tests-e2e-fixtures-windsurf-project.md'),
      'stale fixture rule\n',
    );
    mkdirSync(join(dir, '.worktrees', 'security-collaboration'), { recursive: true });
    writeFileSync(
      join(dir, '.worktrees', 'security-collaboration', 'AGENTS.md'),
      '# Hidden worktree rules\n',
    );
    mkdirSync(join(dir, 'tests', 'e2e', 'fixtures', 'windsurf-project'), { recursive: true });
    writeFileSync(
      join(dir, 'tests', 'e2e', 'fixtures', 'windsurf-project', 'AGENTS.md'),
      '# Fixture rules\n',
    );
    mkdirSync(join(dir, '.windsurf', 'workflows'), { recursive: true });
    writeFileSync(
      join(dir, '.windsurf', 'workflows', 'review.md'),
      '---\ndescription: Review workflow\n---\n\nReview risky changes.\n',
    );
    mkdirSync(join(dir, '.windsurf', 'skills', 'ab-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(dir, '.windsurf', 'skills', 'ab-agent-reviewer', 'SKILL.md'),
      [
        '---',
        'description: Reviewer agent',
        'x-agentsbridge-kind: agent',
        'x-agentsbridge-name: reviewer',
        'x-agentsbridge-tools:',
        '  - Read',
        'x-agentsbridge-model: sonnet',
        'x-agentsbridge-permission-mode: ask',
        'x-agentsbridge-max-turns: 7',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );
    mkdirSync(join(dir, '.windsurf', 'skills', 'qa', 'references'), { recursive: true });
    writeFileSync(join(dir, '.windsurf', 'skills', 'qa', 'SKILL.md'), '# QA');
    writeFileSync(
      join(dir, '.windsurf', 'skills', 'qa', 'references', 'checklist.md'),
      '# Checklist',
    );

    const result = await runCli('import --from windsurf', dir);

    expect(result.exitCode).toBe(0);
    dirFilesExactly(join(dir, '.agentsbridge', 'rules'), ['_root.md', 'src.md']);
    dirFilesExactly(join(dir, '.agentsbridge', 'commands'), ['review.md']);
    dirFilesExactly(join(dir, '.agentsbridge', 'agents'), ['reviewer.md']);
    dirTreeExactly(join(dir, '.agentsbridge', 'skills'), [
      'qa/',
      'qa/SKILL.md',
      'qa/references/',
      'qa/references/checklist.md',
    ]);
    expect(
      existsSync(join(dir, '.agentsbridge', 'rules', '.worktrees-security-collaboration.md')),
    ).toBe(false);
    expect(
      existsSync(join(dir, '.agentsbridge', 'rules', 'tests-e2e-fixtures-windsurf-project.md')),
    ).toBe(false);
    expect(existsSync(join(dir, '.agentsbridge', 'skills', 'ab-agent-reviewer'))).toBe(false);
  });
});
