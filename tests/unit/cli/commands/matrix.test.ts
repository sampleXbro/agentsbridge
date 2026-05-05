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
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('runMatrix', () => {
  it('returns structured data with targets and features', async () => {
    const result = await runMatrix({}, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.targets).toContain('claude-code');
    expect(result.data.targets).toContain('cursor');
    expect(result.data.features.length).toBeGreaterThan(0);
    expect(result.data.features[0]).toHaveProperty('name');
    expect(result.data.features[0]).toHaveProperty('support');
  });

  it('includes rules feature in structured output', async () => {
    const result = await runMatrix({}, TEST_DIR);

    const rulesFeature = result.data.features.find((f) => f.name === 'rules');
    expect(rulesFeature).toBeDefined();
    expect(rulesFeature!.support).toHaveProperty('claude-code');
    expect(rulesFeature!.support).toHaveProperty('cursor');
  });

  it('respects --targets filter', async () => {
    const result = await runMatrix({ targets: 'claude-code' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.targets).toEqual(['claude-code']);
  });

  it('returns empty features when features list is empty', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: []\n`,
    );

    const result = await runMatrix({}, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.features).toEqual([]);
  });

  it('throws when not initialized (no config)', async () => {
    rmSync(join(TEST_DIR, 'agentsmesh.yaml'));
    await expect(runMatrix({}, TEST_DIR)).rejects.toThrow(/agentsmesh\.yaml/);
  });

  it('returns matrix for canonical home config when --global is set', async () => {
    vi.stubEnv('HOME', TEST_DIR);
    vi.stubEnv('USERPROFILE', TEST_DIR);
    const workspace = `${TEST_DIR}-workspace`;
    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(workspace, { recursive: true });

    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Global rules"
---
# Rules
`,
    );

    const result = await runMatrix({ global: true }, workspace);

    expect(result.exitCode).toBe(0);
    expect(result.data.targets).toContain('claude-code');
    expect(result.data.features.length).toBeGreaterThan(0);
    const rulesFeature = result.data.features.find((f) => f.name === 'rules');
    expect(rulesFeature).toBeDefined();
  });
});
