/**
 * Integration test for agentsbridge check.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'ab-integration-check');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function setupProject(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsbridge.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsbridge', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  setupProject();
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsbridge check (integration)', () => {
  it('passes when generate then check (lock in sync)', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const out = execSync(`node ${CLI_PATH} check`, { cwd: TEST_DIR, encoding: 'utf8' });
    expect(out).toContain('Lock file is in sync');
  });

  it('fails when check before generate (no lock)', () => {
    expect(() => execSync(`node ${CLI_PATH} check`, { cwd: TEST_DIR, encoding: 'utf8' })).toThrow();
  });

  it('fails when canonical file modified after generate', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: "Modified"
---
# Rules
- Use Rust
`,
    );
    expect(() => execSync(`node ${CLI_PATH} check`, { cwd: TEST_DIR, encoding: 'utf8' })).toThrow();
  });
});
