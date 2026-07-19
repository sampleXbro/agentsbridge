/**
 * Integration test for agentsmesh check.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-check');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function setupProject(): void {
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
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  setupProject();
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh check (integration)', () => {
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
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
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

  it('fails with the exact generated-output path when a generated file is hand-edited', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    // Hand-edit a generated artifact (a target output, not a canonical file).
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# hand-edited generated output\n');

    let combined = '';
    let threw = false;
    try {
      // Merge stderr into stdout: drift lines are emitted via ui.error (stderr).
      execSync(`node ${CLI_PATH} check 2>&1`, { cwd: TEST_DIR, encoding: 'utf8' });
    } catch (e) {
      threw = true;
      const err = e as { stdout?: string; stderr?: string };
      combined = (err.stdout ?? '') + (err.stderr ?? '');
    }
    expect(threw).toBe(true);
    expect(combined).toContain('generated output "AGENTS.md" was modified');
  });

  it('passes with --no-outputs even when a generated file is hand-edited', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# hand-edited generated output\n');

    const out = execSync(`node ${CLI_PATH} check --no-outputs`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
    });
    expect(out).toContain('Lock file is in sync');
  });
});
