/**
 * Unit tests for agentsmesh watch command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWatch } from '../../../../src/cli/commands/watch.js';
import * as matrixMod from '../../../../src/cli/commands/matrix.js';
import { logger } from '../../../../src/utils/output/logger.js';

import { randomBytes } from 'node:crypto';
let testDir = '';

function setupProject(): void {
  testDir = join(tmpdir(), 'am-watch-cmd-test-' + randomBytes(4).toString('hex'));
  mkdirSync(testDir, { recursive: true });
  writeFileSync(
    join(testDir, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(testDir, '.agentsmesh', 'rules', '_root.md'),
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
  rmSync(testDir, { recursive: true, force: true });
});

describe('runWatch', () => {
  it('throws when not initialized (no config)', async () => {
    rmSync(join(testDir, 'agentsmesh.yaml'));
    await expect(runWatch({}, testDir)).rejects.toThrow(/agentsmesh\.yaml/);
  });

  it('starts watching and returns stop function', async () => {
    const result = await runWatch({}, testDir);
    expect(result).toBeDefined();
    expect(typeof result?.stop).toBe('function');
    await result!.stop();
  });

  it('respects --targets flag', async () => {
    const result = await runWatch({ targets: 'claude-code' }, testDir);
    expect(result).toBeDefined();
    await result!.stop();
  });

  it('stops and clears debounce when stop called during debounce', async () => {
    const result = await runWatch({}, testDir);
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', 'other.md'),
      '---\ndescription: ""\n---\n# Other',
    );
    await result!.stop();
  });

  it('calls runMatrix when features change', async () => {
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(undefined);
    const result = await runWatch({}, testDir);
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', 'new.md'),
      '---\ndescription: "New"\n---\n# New',
    );
    await vi.waitFor(() => expect(runMatrixSpy).toHaveBeenCalled(), { timeout: 12000 });
    runMatrixSpy.mockRestore();
    await result!.stop();
  });

  it('computes fingerprint with permissions', async () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, permissions]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(testDir, '.agentsmesh', 'permissions.yaml'),
      'allow:\n  - Read\n  - Grep\ndeny: []',
    );
    const result = await runWatch({}, testDir);
    await result!.stop();
  });

  it('calls runMatrix when features change (new rule adds to fingerprint)', async () => {
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(undefined);
    const result = await runWatch({}, testDir);
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', 'new.md'),
      '---\ndescription: "New"\n---\n# New',
    );
    await vi.waitFor(() => expect(runMatrixSpy).toHaveBeenCalled(), { timeout: 12000 });
    runMatrixSpy.mockRestore();
    await result!.stop();
  });

  it('logs Regenerated when fingerprint unchanged (body-only edit)', async () => {
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const result = await runWatch({}, testDir);
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
- Added one line (same rule count)
`,
    );
    await vi.waitFor(() => expect(infoSpy).toHaveBeenCalledWith('Regenerated.'), {
      timeout: 12000,
    });
    expect(runMatrixSpy).not.toHaveBeenCalled();
    runMatrixSpy.mockRestore();
    infoSpy.mockRestore();
    await result!.stop();
  });

  it('does not retrigger from its own .agentsmesh/.lock writes while idle', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    writeFileSync(
      join(testDir, '.agentsmesh', '.lock'),
      'generated_at: "2026-03-15T14:00:00Z"\nchecksums: {}\nextends: {}\n',
    );
    const result = await runWatch({}, testDir);

    await vi.waitFor(
      () =>
        expect(
          infoSpy.mock.calls.filter(([message]) => message === 'Regenerated.').length,
        ).toBeGreaterThanOrEqual(1),
      { timeout: 12000 },
    );

    const regenCountAfterStartup = infoSpy.mock.calls.filter(
      ([message]) => message === 'Regenerated.',
    ).length;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(infoSpy.mock.calls.filter(([message]) => message === 'Regenerated.').length).toBe(
      regenCountAfterStartup,
    );

    infoSpy.mockRestore();
    await result!.stop();
  });

  it('watches ~/.agentsmesh and generates global outputs when --global is set', async () => {
    vi.stubEnv('HOME', testDir);
    vi.stubEnv('USERPROFILE', testDir);
    const workspace = `${testDir}-workspace`;
    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(workspace, { recursive: true });

    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, '.agentsmesh', 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Global rules"
---
# Global Rules
`,
    );

    const result = await runWatch({ global: true }, workspace);
    await vi.waitFor(() => expect(existsSync(join(testDir, '.claude', 'CLAUDE.md'))).toBe(true), {
      timeout: 12000,
    });
    await vi.waitFor(
      () =>
        expect(readFileSync(join(testDir, '.claude', 'CLAUDE.md'), 'utf8')).toContain(
          'Global Rules',
        ),
      { timeout: 12000 },
    );
    await result.stop();
  });
});
