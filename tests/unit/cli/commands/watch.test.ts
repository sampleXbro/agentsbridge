/**
 * Unit tests for agentsmesh watch command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as matrixMod from '../../../../src/cli/commands/matrix.js';
import { logger } from '../../../../src/utils/output/logger.js';
import {
  createWatchTestDir,
  writeMinimalWatchProject,
  runWatch,
  watchWaitTimeoutMs,
  watchStabilityDelayMs,
} from '../../../harness/watch.js';

let testDir = '';

beforeEach(() => {
  testDir = createWatchTestDir();
  writeMinimalWatchProject(testDir);
});
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
    const mockResult = { exitCode: 0, data: { targets: [], features: [] } };
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(mockResult);
    const cycles: Array<{ featuresChanged: boolean }> = [];
    const result = await runWatch({}, testDir, {
      onCycle: (info) => cycles.push(info),
    });
    try {
      await vi.waitFor(() => expect(cycles.length).toBeGreaterThanOrEqual(1), {
        timeout: watchWaitTimeoutMs(),
      });
      // Use a unique filename per retry so chokidar emits ADD events rather than
      // coalesced CHANGE events on the same path — ADD is more reliably delivered
      // under full-suite scheduler load on macOS FSEvents.
      let attempt = 0;
      const writeNewRule = (): void => {
        attempt += 1;
        writeFileSync(
          join(testDir, '.agentsmesh', 'rules', `new-${attempt}.md`),
          `---\ndescription: "New"\n---\n# New\n`,
        );
      };
      writeNewRule();
      const retryWrite = globalThis.setInterval(() => {
        if (cycles.length < 2) writeNewRule();
      }, 1_000);
      try {
        await vi.waitFor(
          () => {
            expect(cycles.length).toBeGreaterThanOrEqual(2);
            expect(cycles[1]?.featuresChanged).toBe(true);
          },
          {
            timeout: watchWaitTimeoutMs(),
          },
        );
      } finally {
        globalThis.clearInterval(retryWrite);
      }
      expect(runMatrixSpy).toHaveBeenCalled();
    } finally {
      runMatrixSpy.mockRestore();
      await result!.stop();
    }
  });

  it('logs Regenerated when fingerprint unchanged (body-only edit)', async () => {
    const mockResult = { exitCode: 0, data: { targets: [], features: [] } };
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(mockResult);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const cycles: Array<{ featuresChanged: boolean }> = [];
    const result = await runWatch({}, testDir, {
      onCycle: (info) => cycles.push(info),
    });
    try {
      await vi.waitFor(() => expect(cycles.length).toBeGreaterThanOrEqual(1), {
        timeout: watchWaitTimeoutMs(),
      });
      const regenCallsAfterStartup = infoSpy.mock.calls.filter(
        ([message]) => message === 'Regenerated.',
      ).length;
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
      await vi.waitFor(() => expect(cycles.length).toBeGreaterThanOrEqual(2), {
        timeout: watchWaitTimeoutMs(),
      });
      expect(cycles[1]?.featuresChanged).toBe(false);
      const regenCallsAfterEdit = infoSpy.mock.calls.filter(
        ([message]) => message === 'Regenerated.',
      ).length;
      expect(regenCallsAfterEdit).toBeGreaterThan(regenCallsAfterStartup);
      expect(runMatrixSpy).not.toHaveBeenCalled();
    } finally {
      runMatrixSpy.mockRestore();
      infoSpy.mockRestore();
      await result!.stop();
    }
  });

  it('fires onCycle for the initial generate and subsequent regen cycles', async () => {
    const mockResult = { exitCode: 0, data: { targets: [], features: [] } };
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(mockResult);
    const cycles: Array<{ featuresChanged: boolean }> = [];
    const result = await runWatch({}, testDir, {
      onCycle: (info) => cycles.push(info),
    });
    try {
      // Initial cycle: lastFingerprint is null, so featuresChanged must be false.
      await vi.waitFor(() => expect(cycles.length).toBeGreaterThanOrEqual(1), {
        timeout: watchWaitTimeoutMs(),
      });
      expect(cycles[0]?.featuresChanged).toBe(false);
    } finally {
      runMatrixSpy.mockRestore();
      await result!.stop();
    }
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
      { timeout: watchWaitTimeoutMs() },
    );

    const regenCountAfterStartup = infoSpy.mock.calls.filter(
      ([message]) => message === 'Regenerated.',
    ).length;

    await new Promise((resolve) => setTimeout(resolve, watchStabilityDelayMs()));

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
      timeout: watchWaitTimeoutMs(),
    });
    await vi.waitFor(
      () =>
        expect(readFileSync(join(testDir, '.claude', 'CLAUDE.md'), 'utf8')).toContain(
          'Global Rules',
        ),
      { timeout: watchWaitTimeoutMs() },
    );
    await result.stop();
  });
});
