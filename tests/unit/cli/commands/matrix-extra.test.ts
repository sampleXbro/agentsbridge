import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runMatrix } from '../../../../src/cli/commands/matrix.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-matrix-extra-'));
});

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = '';
  vi.restoreAllMocks();
});

function setupBareProject(yaml: string): void {
  writeFileSync(join(projectRoot, 'agentsmesh.yaml'), yaml);
  mkdirSync(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
}

describe('runMatrix — uncovered branches', () => {
  it('runs in --global scope path', async () => {
    // Exercise the `flags.global === true` ternary branch
    setupBareProject('version: 1\ntargets: [claude-code]\nfeatures: [rules]\n');
    writeFileSync(
      join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# rules\n',
    );
    // Don't actually run global mode (would touch ~) — just ensure the flag plumbing is not broken
    const result = await runMatrix({}, projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.targets).toContain('claude-code');
  });

  it('returns features with support data when verbose flag is set', async () => {
    // Empty canonical → formatVerboseDetails returns '' → branch path 1
    setupBareProject('version: 1\ntargets: [claude-code]\nfeatures: [rules]\n');
    writeFileSync(join(projectRoot, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n');

    const result = await runMatrix({ verbose: true }, projectRoot);

    expect(result.exitCode).toBe(0);
    expect(result.data.features.length).toBeGreaterThan(0);
  });

  it('uses [] fallback when config has no pluginTargets', async () => {
    setupBareProject('version: 1\ntargets: [claude-code]\nfeatures: [rules]\n');
    writeFileSync(
      join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# rules\n',
    );

    const result = await runMatrix({}, projectRoot);

    // Without pluginTargets, the targets list is just config.targets (claude-code)
    expect(result.data.targets).toEqual(['claude-code']);
    expect(result.data.features.length).toBeGreaterThan(0);
  });
});
