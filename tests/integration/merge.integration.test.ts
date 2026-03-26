/**
 * Integration test for agentsmesh merge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-merge');
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

describe('agentsmesh merge (integration)', () => {
  it('resolves lock conflict when .lock has git conflict markers', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `<<<<<<< HEAD
generated_at: "2026-03-12T14:30:00Z"
generated_by: "alice"
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:aaa111"
extends: {}
=======
generated_at: "2026-03-12T15:00:00Z"
generated_by: "bob"
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:bbb222"
extends: {}
>>>>>>> feature
`,
    );

    const out = execSync(`node ${CLI_PATH} merge`, { cwd: TEST_DIR, encoding: 'utf8' });
    expect(out).toContain('Lock file conflict resolved');

    const checkOut = execSync(`node ${CLI_PATH} check`, { cwd: TEST_DIR, encoding: 'utf8' });
    expect(checkOut).toContain('Lock file is in sync');
  });

  it('says "No conflicts" when lock has no conflict markers', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const out = execSync(`node ${CLI_PATH} merge`, { cwd: TEST_DIR, encoding: 'utf8' });
    expect(out).toContain('No conflicts to resolve');
  });

  it('throws when not in agentsmesh project', () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    expect(() => execSync(`node ${CLI_PATH} merge`, { cwd: TEST_DIR, encoding: 'utf8' })).toThrow();
  });
});
