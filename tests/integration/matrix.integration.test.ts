/**
 * Integration test for agentsbridge matrix.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'ab-integration-matrix');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
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
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsbridge matrix (integration)', () => {
  it('prints compatibility table with rules row', () => {
    const out = execSync(`node ${CLI_PATH} matrix`, { cwd: TEST_DIR, encoding: 'utf-8' });
    expect(out).toContain('Feature');
    expect(out).toContain('rules');
    expect(out).toContain('Legend');
    expect(out).toMatch(/[✓✓]/);
  });

  it('respects --targets filter', () => {
    const out = execSync(`node ${CLI_PATH} matrix --targets claude-code`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    expect(out).toContain('Claude');
    expect(out).toContain('rules');
  });

  it('--verbose adds per-file details', () => {
    const out = execSync(`node ${CLI_PATH} matrix --verbose`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    expect(out).toContain('Per-file details');
    expect(out).toContain('_root');
  });
});
