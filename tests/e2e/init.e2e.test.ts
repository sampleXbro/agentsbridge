/**
 * E2E tests for agentsbridge init.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { fileExists, fileContains } from './helpers/assertions.js';

describe('init', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('init in empty dir — run ab init → agentsbridge.yaml exists, .agentsbridge/rules/_root.md exists', async () => {
    dir = createTestProject();
    const r = await runCli('init', dir);
    expect(r.exitCode).toBe(0);
    fileExists(join(dir, 'agentsbridge.yaml'));
    fileExists(join(dir, '.agentsbridge', 'rules', '_root.md'));
    fileContains(join(dir, 'agentsbridge.yaml'), 'version');
    fileContains(join(dir, '.agentsbridge', 'rules', '_root.md'), 'root');
  });

  it('init detects Claude config — copy claude fixture, run init → stdout mentions found configs', async () => {
    dir = createTestProject('claude-code-project');
    const r = await runCli('init', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('claude-code');
  });

  it('init detects multiple tools — copy claude + cursor fixtures, run init in fresh empty dir with both', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'CLAUDE.md'), '# Project rules');
    const cursorRulesDir = join(dir, '.cursor', 'rules');
    mkdirSync(cursorRulesDir, { recursive: true });
    writeFileSync(join(cursorRulesDir, 'root.mdc'), '---\nalwaysApply: true\n---\n# Cursor');
    const r = await runCli('init', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/claude-code|cursor|Found existing/);
  });

  it('init refuses if config exists — create yaml first → run init → exit 1', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'agentsbridge.yaml'), 'version: 1\n');
    const r = await runCli('init', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Already initialized');
  });

  it('gitignore updated — run init → .gitignore contains agentsbridge.local.yaml', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    const r = await runCli('init', dir);
    expect(r.exitCode).toBe(0);
    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('agentsbridge.local.yaml');
  });

  it('init creates .gitignore when missing', async () => {
    dir = createTestProject();
    const r = await runCli('init', dir);
    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.gitignore'));
    fileContains(join(dir, '.gitignore'), 'agentsbridge.local.yaml');
  });
});
