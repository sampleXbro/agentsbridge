/**
 * Integration test for agentsmesh lint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-lint');
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

describe('agentsmesh lint (integration)', () => {
  it('passes when rules are valid', () => {
    const out = execSync(`node ${CLI_PATH} lint`, { cwd: TEST_DIR, encoding: 'utf-8' });
    expect(out).toContain('All checks passed');
  });

  it('exits 1 when no root rule', () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'only.md'),
      `---
description: "Only"
---
Content
`,
    );
    try {
      execSync(`node ${CLI_PATH} lint`, { cwd: TEST_DIR, encoding: 'utf-8' });
      expect.fail('Expected lint to exit 1');
    } catch (err) {
      const e = err as { status?: number };
      expect(e.status).toBe(1);
    }
  });

  it('shows warnings when globs match 0 files but exit 0', () => {
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'lib-only.md'),
      `---
description: "Lib"
globs: lib/**/*.ts
---
Lib rules
`,
    );
    // Warnings go to stderr; capture both streams without relying on a POSIX shell.
    const result = spawnSync(process.execPath, [CLI_PATH, 'lint'], {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain('match 0 files');
    expect(out).toContain('warning');
  });
});
