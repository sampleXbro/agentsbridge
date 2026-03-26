/**
 * Unit tests for agentsmesh matrix command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runMatrix } from '../../../../src/cli/commands/matrix.js';

const TEST_DIR = join(tmpdir(), 'am-matrix-cmd-test');

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

describe('runMatrix', () => {
  it('prints compatibility matrix for current config', async () => {
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runMatrix({}, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('Feature');
    expect(output).toContain('rules');
    expect(output).toContain('Legend');
    expect(output).toMatch(/[✓⚠📝–]/u);
  });

  it('respects --targets filter', async () => {
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runMatrix({ targets: 'claude-code' }, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('rules');
    expect(output).toContain('Claude');
  });

  it('includes per-file details with --verbose', async () => {
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runMatrix({ verbose: true }, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('rules');
    expect(output).toContain('_root.md');
  });

  it('shows "No features enabled" when features list is empty', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: []\n`,
    );
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runMatrix({}, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('No features enabled');
  });

  it('throws when not initialized (no config)', async () => {
    rmSync(join(TEST_DIR, 'agentsmesh.yaml'));
    await expect(runMatrix({}, TEST_DIR)).rejects.toThrow(/agentsmesh\.yaml/);
  });
});
