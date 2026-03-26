/**
 * Integration test for agentsmesh diff.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'ab-integration-diff');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh diff (integration)', () => {
  it('shows unified diff when files would be created', () => {
    const out = execSync(`node ${CLI_PATH} diff`, { cwd: TEST_DIR, encoding: 'utf-8' });
    expect(out).toContain('.claude/CLAUDE.md (current)');
    expect(out).toContain('.claude/CLAUDE.md (generated)');
    expect(out).toContain('.cursor/rules/general.mdc');
    expect(out).toContain('Use TypeScript');
    expect(out).toMatch(/\d+ files would be created/);
  });

  it('shows unified diff when files would be updated', () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Old\n');
    const out = execSync(`node ${CLI_PATH} diff`, { cwd: TEST_DIR, encoding: 'utf-8' });
    expect(out).toContain('# Old');
    expect(out).toContain('Use TypeScript');
    expect(out).toMatch(/updated/);
  });

  it('shows unchanged when files match generated output', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const out = execSync(`node ${CLI_PATH} diff`, { cwd: TEST_DIR, encoding: 'utf-8' });
    expect(out).toContain('unchanged');
    expect(out).not.toContain('--- .claude/CLAUDE.md (current)');
  });

  it('diff does not write any files', () => {
    execSync(`node ${CLI_PATH} diff`, { cwd: TEST_DIR });
    expect(() => readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toThrow();
  });
});
