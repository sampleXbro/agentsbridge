/**
 * Branch coverage for `routePickerResult` in
 * `src/install/run/route-picker-result.ts`. The function dispatches between:
 *   1. Marketplace recursion (`isMarketplace` + ≥1 target) — fans out to
 *      `runInstallMarketplace`, returns its aggregated result.
 *   2. Single-candidate auto-pick (non-marketplace, exactly one target) —
 *      forwards via `recurseInstall(...)` with the selected target's flags.
 *   3. No-route fallback — every other shape returns `null` so the caller
 *      falls through to the single-pack install path.
 *
 * Pure-ish: invokes injected `recurseInstall` and the real
 * `runInstallMarketplace` (which is itself a pure dispatcher we exercise via
 * its `execute` callback). No filesystem.
 */

import { describe, it, expect, vi } from 'vitest';
import { routePickerResult } from '../../../../src/install/run/route-picker-result.js';
import { createInstallReport } from '../../../../src/install/core/install-report.js';
import type { InstallCommandResult } from '../../../../src/install/run/single-pack-install.js';
import type { InstallTarget } from '../../../../src/install/core/install-target.js';

function makeBaseArgs(overrides: {
  readonly pickerResult: {
    isMarketplace: boolean;
    targets: InstallTarget[];
  };
  readonly recurseInstall: ReturnType<typeof vi.fn>;
  readonly installReport?: ReturnType<typeof createInstallReport>;
}): Parameters<typeof routePickerResult>[0] {
  return {
    pickerResult: overrides.pickerResult,
    installReport: overrides.installReport ?? createInstallReport(),
    sourceArg: 'github:acme/marketplace',
    projectRoot: '/tmp/proj',
    dryRun: false,
    force: false,
    useExtends: false,
    nameOverride: '',
    replay: undefined,
    recurseInstall: overrides.recurseInstall,
  };
}

function makeRecurseResult(): InstallCommandResult {
  return {
    exitCode: 0,
    data: {
      source: 'github:acme/marketplace',
      mode: 'install',
      installed: [{ kind: 'rules', name: 'sub-a', path: '.agentsmesh/rules/sub-a.md' }],
      skipped: [],
      dryRun: false,
    },
  };
}

describe('routePickerResult', () => {
  it('marketplace branch: fans out to runInstallMarketplace and aggregates installed/skipped', async () => {
    const recurseInstall = vi.fn().mockResolvedValue(makeRecurseResult());
    const args = makeBaseArgs({
      pickerResult: {
        isMarketplace: true,
        targets: [
          { name: 'sub-a', path: 'sub-a' },
          { name: 'sub-b', path: 'sub-b' },
        ],
      },
      recurseInstall,
    });

    const result = await routePickerResult(args);

    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(0);
    expect(result!.data.mode).toBe('install');
    expect(result!.data.installed).toHaveLength(2);
    expect(recurseInstall).toHaveBeenCalledTimes(2);
    // Marketplace recursion always forces non-interactive and clears replay.
    expect(recurseInstall.mock.calls[0]![0]).toMatchObject({
      force: true,
      'dry-run': false,
      path: 'sub-a',
      name: 'sub-a',
      extends: false,
    });
  });

  it('marketplace branch: surfaces brokenResources when the installReport carries any', async () => {
    const installReport = createInstallReport();
    installReport.brokenResources.push({
      path: 'skills/broken/SKILL.md',
      kind: 'frontmatter',
      reason: 'invalid yaml',
    });
    const recurseInstall = vi.fn().mockResolvedValue(makeRecurseResult());
    const args = makeBaseArgs({
      pickerResult: { isMarketplace: true, targets: [{ name: 'sub', path: 'sub' }] },
      recurseInstall,
      installReport,
    });

    const result = await routePickerResult(args);

    expect(result!.data.brokenResources).toEqual([
      { path: 'skills/broken/SKILL.md', kind: 'frontmatter', reason: 'invalid yaml' },
    ]);
  });

  it("single-candidate branch: forwards to recurseInstall with the picked target's flags", async () => {
    const recurseResult = makeRecurseResult();
    const recurseInstall = vi.fn().mockResolvedValue(recurseResult);
    const args = makeBaseArgs({
      pickerResult: {
        isMarketplace: false,
        targets: [{ name: 'only', path: 'rules', as: 'rules', target: 'claude-code' }],
      },
      recurseInstall,
    });

    const result = await routePickerResult(args);

    expect(result).toBe(recurseResult);
    expect(recurseInstall).toHaveBeenCalledTimes(1);
    expect(recurseInstall.mock.calls[0]![0]).toMatchObject({
      force: false,
      'dry-run': false,
      path: 'rules',
      as: 'rules',
      target: 'claude-code',
      name: '',
      extends: false,
    });
    // Replay is normalized to `{}` so the nested call skips re-acquiring the lock.
    expect(recurseInstall.mock.calls[0]![3]).toEqual({});
  });

  it('single-candidate branch: passes through nameOverride and dryRun', async () => {
    const recurseInstall = vi.fn().mockResolvedValue(makeRecurseResult());
    const args = {
      ...makeBaseArgs({
        pickerResult: {
          isMarketplace: false,
          targets: [{ name: 'one', path: 'commands' }],
        },
        recurseInstall,
      }),
      nameOverride: 'override-name',
      dryRun: true,
    };

    await routePickerResult(args);

    expect(recurseInstall.mock.calls[0]![0]).toMatchObject({
      name: 'override-name',
      'dry-run': true,
    });
  });

  it('returns null when isMarketplace is false and targets is empty', async () => {
    const recurseInstall = vi.fn();
    const args = makeBaseArgs({
      pickerResult: { isMarketplace: false, targets: [] },
      recurseInstall,
    });

    expect(await routePickerResult(args)).toBeNull();
    expect(recurseInstall).not.toHaveBeenCalled();
  });

  it('returns null when isMarketplace is false and targets has 2+ entries (ambiguous)', async () => {
    const recurseInstall = vi.fn();
    const args = makeBaseArgs({
      pickerResult: {
        isMarketplace: false,
        targets: [
          { name: 'a', path: 'a' },
          { name: 'b', path: 'b' },
        ],
      },
      recurseInstall,
    });

    expect(await routePickerResult(args)).toBeNull();
    expect(recurseInstall).not.toHaveBeenCalled();
  });

  it('returns null when isMarketplace is true but targets is empty', async () => {
    const recurseInstall = vi.fn();
    const args = makeBaseArgs({
      pickerResult: { isMarketplace: true, targets: [] },
      recurseInstall,
    });

    expect(await routePickerResult(args)).toBeNull();
    expect(recurseInstall).not.toHaveBeenCalled();
  });
});
