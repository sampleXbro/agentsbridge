/**
 * E2E tests for agentsmesh generate.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { fileExists, fileContains, fileNotExists } from './helpers/assertions.js';

describe('generate', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('canonical-full generates .claude/CLAUDE.md from _root.md', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    const claudeMd = join(dir, '.claude', 'CLAUDE.md');
    fileExists(claudeMd);
    // root rule body content must be present in .claude/CLAUDE.md
    fileContains(claudeMd, 'TypeScript strict');
    fileContains(claudeMd, 'pnpm only');
  });

  it('canonical-full generates .claude/rules/typescript.md for scoped rule', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    // scoped rules go to .claude/rules/, NOT CLAUDE.md
    const tsRule = join(dir, '.claude', 'rules', 'typescript.md');
    fileExists(tsRule);
    fileContains(tsRule, 'TypeScript specific rules');
    fileContains(tsRule, 'src/**/*.ts');
    fileContains(tsRule, 'No any');
    fileContains(tsRule, 'Explicit return types');
  });

  it('canonical-full generates .cursor/rules/general.mdc', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    const rootMdc = join(dir, '.cursor', 'rules', 'general.mdc');
    fileExists(rootMdc);
    // cursor root rule must have alwaysApply:true and description
    fileContains(rootMdc, 'alwaysApply: true');
    fileContains(rootMdc, 'Project-wide coding standards');
    // body content preserved
    fileContains(rootMdc, 'TypeScript strict');
    fileContains(rootMdc, 'pnpm only');
  });

  it('canonical-full generates .cursor/rules/typescript.mdc with globs and body', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    const tsMdc = join(dir, '.cursor', 'rules', 'typescript.mdc');
    fileExists(tsMdc);
    fileContains(tsMdc, 'src/**/*.ts');
    fileContains(tsMdc, 'TypeScript specific rules');
    fileContains(tsMdc, 'No any');
    fileContains(tsMdc, 'Explicit return types');
  });

  it('canonical-full generates .claude/commands/review.md', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    const reviewCmd = join(dir, '.claude', 'commands', 'review.md');
    fileExists(reviewCmd);
    // description and allowed-tools from frontmatter must be present
    fileContains(reviewCmd, 'Code review');
    fileContains(reviewCmd, 'Bash(git diff)');
    // body content preserved
    fileContains(reviewCmd, 'Review current changes for quality');
  });

  it('--targets claude-code,cursor generates only those two', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate --targets claude-code,cursor', dir);
    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.claude', 'CLAUDE.md'));
    fileExists(join(dir, '.cursor', 'rules', 'general.mdc'));
    // Copilot not generated
    try {
      readFileSync(join(dir, '.github', 'copilot-instructions.md'));
      throw new Error('Expected copilot to not be generated');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Expected')) throw err;
      // ENOENT is expected
    }
  });

  it('--dry-run writes zero files', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('generate --dry-run', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/dry-run|created|updated/);
    fileNotExists(join(dir, '.claude', 'CLAUDE.md'));
  });

  it('second generate reports 0 created, 0 updated, N unchanged', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/0 created|unchanged/);
  });

  it('lock file created after generate', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    fileExists(join(dir, '.agentsmesh', '.lock'));
  });

  it('canonical-minimal generates root rule for all targets without errors', async () => {
    dir = createTestProject('canonical-minimal');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.claude', 'CLAUDE.md'));
    fileExists(join(dir, '.cursor', 'rules', 'general.mdc'));
  });

  it('generate in canonical-no-config → exit 1', async () => {
    dir = createTestProject('canonical-no-config');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/agentsmesh\.yaml not found/);
  });

  it('generate with no root rule — no crash, no files created', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const rulesDir = join(dir, '.agentsmesh', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'non-root.md'), '---\ndescription: Not root\n---\n# Body\n');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0);
    fileNotExists(join(dir, '.claude', 'CLAUDE.md'));
  });
});
