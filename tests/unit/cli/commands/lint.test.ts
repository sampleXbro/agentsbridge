/**
 * Unit tests for agentsmesh lint command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLintCmd } from '../../../../src/cli/commands/lint.js';

const TEST_DIR = join(tmpdir(), 'ab-lint-cmd-test');

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

beforeEach(() => setupProject());
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('runLintCmd', () => {
  it('returns 0 when all checks pass', async () => {
    const code = await runLintCmd({}, TEST_DIR);
    expect(code).toBe(0);
  });

  it('returns 1 when rules exist but no root rule', async () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'only.md'),
      `---
description: "Only rule"
---
Content`,
    );
    const code = await runLintCmd({}, TEST_DIR);
    expect(code).toBe(1);
  });

  it('uses singular "error" and "warning" when exactly 1 of each', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [rules]\n`,
    );
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'only.md'),
      `---\ndescription: "Only rule"\nglobs: lib/**/*.ts\n---\nContent`,
    );
    const code = await runLintCmd({}, TEST_DIR);
    expect(code).toBe(1);
  });

  it('returns 0 when only warnings (globs match 0 files)', async () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'foo.ts'), 'x');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'lib-only.md'),
      `---
description: "Lib"
globs: lib/**/*.ts
---
Lib rules`,
    );
    const code = await runLintCmd({}, TEST_DIR);
    expect(code).toBe(0);
  });

  it('respects --targets filter', async () => {
    const code = await runLintCmd({ targets: 'claude-code' }, TEST_DIR);
    expect(code).toBe(0);
  });

  it('throws when not initialized (no config)', async () => {
    rmSync(join(TEST_DIR, 'agentsmesh.yaml'));
    await expect(runLintCmd({}, TEST_DIR)).rejects.toThrow(/agentsmesh\.yaml/);
  });
});
