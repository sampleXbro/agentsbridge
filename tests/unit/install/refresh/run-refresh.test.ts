import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  planSinglePack: vi.fn(),
  applySinglePack: vi.fn(),
  runConsentPrompt: vi.fn(),
  createRunInstallForRefresh: vi.fn(),
  runPostOperationGenerate: vi.fn(),
  createDefaultResolveRef: vi.fn(),
}));

vi.mock('../../../../src/install/refresh/refresh-plan.js', () => ({
  planSinglePack: mocks.planSinglePack,
  createDefaultResolveRef: mocks.createDefaultResolveRef,
  classifyRefreshPlan: vi.fn(),
}));

vi.mock('../../../../src/install/refresh/refresh-apply.js', () => ({
  applySinglePack: mocks.applySinglePack,
}));

vi.mock('../../../../src/install/refresh/refresh-prompt.js', () => ({
  runConsentPrompt: mocks.runConsentPrompt,
}));

vi.mock('../../../../src/install/refresh/refresh-install-bridge.js', () => ({
  createRunInstallForRefresh: mocks.createRunInstallForRefresh,
}));

vi.mock('../../../../src/install/run/post-install-generate.js', () => ({
  runPostOperationGenerate: mocks.runPostOperationGenerate,
}));

import { runRefresh } from '../../../../src/install/refresh/run-refresh.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    source: `github:org/${name}`,
    source_kind: 'remote' as const,
    version: 'sha-abc123',
    features: ['skills'],
    installed_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlan(
  name: string,
  classification: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name,
    entry: makeEntry(name),
    oldSha: 'sha-old',
    newSha: 'sha-new',
    modifications: [],
    classification,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runRefresh', () => {
  let projectRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    projectRoot = await mkdtemp(join(tmpdir(), 'run-refresh-'));
    await mkdir(join(projectRoot, '.agentsmesh', 'packs'), { recursive: true });
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\n');

    // Default mock setups
    mocks.createDefaultResolveRef.mockReturnValue(vi.fn());
    mocks.createRunInstallForRefresh.mockReturnValue(vi.fn());
    mocks.runPostOperationGenerate.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  // ─── Empty installs ──────────────────────────────────────────────────────

  it('exits 0 with empty result when no packs are installed', async () => {
    await writeFile(
      join(projectRoot, '.agentsmesh', 'installs.yaml'),
      'version: 1\ninstalls: []\n',
    );
    const result = await runRefresh({}, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.refreshed).toEqual([]);
    expect(result.data.unchanged).toEqual([]);
    expect(result.data.failed).toEqual([]);
  });

  it('exits 2 when an unknown name is requested', async () => {
    await writeFile(
      join(projectRoot, '.agentsmesh', 'installs.yaml'),
      'version: 1\ninstalls: []\n',
    );
    const result = await runRefresh({}, ['does-not-exist'], projectRoot);
    expect(result.exitCode).toBe(2);
  });

  it('exits 0 with no logging when json flag is set and no packs installed', async () => {
    await writeFile(
      join(projectRoot, '.agentsmesh', 'installs.yaml'),
      'version: 1\ninstalls: []\n',
    );
    const result = await runRefresh({ json: true }, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.refreshed).toEqual([]);
  });

  // ─── With installed packs ────────────────────────────────────────────────

  describe('with one installed pack', () => {
    beforeEach(async () => {
      await writeFile(
        join(projectRoot, '.agentsmesh', 'installs.yaml'),
        [
          'version: 1',
          'installs:',
          '  - name: my-pack',
          '    source: github:org/my-pack',
          '    source_kind: github',
          '    features: [skills]',
          '',
        ].join('\n'),
      );
    });

    it('handles clean-update: applies and exits 0', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'clean-update'));
      mocks.applySinglePack.mockResolvedValue({ success: true });

      const result = await runRefresh({}, [], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.data.refreshed).toHaveLength(1);
      expect(result.data.refreshed[0]!.name).toBe('my-pack');
      expect(result.data.failed).toEqual([]);
      expect(mocks.runPostOperationGenerate).toHaveBeenCalledWith(
        'refresh',
        'project',
        expect.any(String),
      );
    });

    it('handles plan error: exits 1 with error in failed bucket', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'error', {
          error: { phase: 'plan', message: 'pack manifest missing' },
        }),
      );

      const result = await runRefresh({}, [], projectRoot);

      expect(result.exitCode).toBe(1);
      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0]!.phase).toBe('plan');
      expect(result.data.failed[0]!.error).toBe('pack manifest missing');
      expect(mocks.runPostOperationGenerate).not.toHaveBeenCalled();
    });

    it('handles plan error without message: uses fallback "unknown plan error"', async () => {
      // Omit the error.message to exercise the `?? 'unknown plan error'` branch
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'error', { error: { phase: 'plan' } }),
      );

      const result = await runRefresh({}, [], projectRoot);

      expect(result.exitCode).toBe(1);
      expect(result.data.failed[0]!.error).toBe('unknown plan error');
    });

    it('filters by name when a known name is requested', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'unchanged'));

      // Provide the known name explicitly — exercises the names.length > 0 filter branch
      const result = await runRefresh({}, ['my-pack'], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.data.unchanged).toHaveLength(1);
      expect(mocks.planSinglePack).toHaveBeenCalledTimes(1);
    });

    it('handles unchanged plan: exits 0 with unchanged entry', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'unchanged'));

      const result = await runRefresh({}, [], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.data.unchanged).toHaveLength(1);
      expect(result.data.unchanged[0]!.name).toBe('my-pack');
      expect(result.data.refreshed).toEqual([]);
      expect(mocks.applySinglePack).not.toHaveBeenCalled();
      expect(mocks.runPostOperationGenerate).not.toHaveBeenCalled();
    });

    it('dry-run: returns plan data without applying', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'clean-update'));

      const result = await runRefresh({ 'dry-run': true }, [], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(mocks.applySinglePack).not.toHaveBeenCalled();
      expect(mocks.runPostOperationGenerate).not.toHaveBeenCalled();
    });

    it('dry-run surfaces clean-update plans in data.refreshed', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'clean-update'));

      const result = await runRefresh({ 'dry-run': true }, [], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.data.refreshed).toHaveLength(1);
      expect(result.data.refreshed[0]!.name).toBe('my-pack');
      expect(result.data.refreshed[0]!.newSha).toBe('sha-new');
      expect(result.data.refreshed[0]!.oldSha).toBe('sha-old');
      expect(mocks.applySinglePack).not.toHaveBeenCalled();
    });

    it('dry-run surfaces needs-consent plans in data.refreshed', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );

      const result = await runRefresh({ 'dry-run': true }, [], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.data.refreshed).toHaveLength(1);
      expect(result.data.refreshed[0]!.name).toBe('my-pack');
      expect(mocks.runConsentPrompt).not.toHaveBeenCalled();
      expect(mocks.applySinglePack).not.toHaveBeenCalled();
    });

    it('dry-run with error plan: exits 1', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'error', {
          error: { phase: 'plan', message: 'oops' },
        }),
      );

      const result = await runRefresh({ 'dry-run': true }, [], projectRoot);

      expect(result.exitCode).toBe(1);
      expect(mocks.applySinglePack).not.toHaveBeenCalled();
    });

    it('apply failure: exits 1 with failed entry', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'clean-update'));
      mocks.applySinglePack.mockResolvedValue({
        success: false,
        phase: 'apply',
        error: 'network timeout',
      });

      const result = await runRefresh({}, [], projectRoot);

      expect(result.exitCode).toBe(1);
      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0]!.error).toBe('network timeout');
      expect(mocks.runPostOperationGenerate).not.toHaveBeenCalled();
    });

    it('needs-consent with force: applies without prompting', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );
      mocks.applySinglePack.mockResolvedValue({ success: true });

      const result = await runRefresh({ force: true }, [], projectRoot);

      expect(mocks.runConsentPrompt).not.toHaveBeenCalled();
      expect(mocks.applySinglePack).toHaveBeenCalled();
      expect(result.exitCode).toBe(0);
    });

    it('needs-consent declined: skips pack', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );
      mocks.runConsentPrompt.mockResolvedValue({
        proceed: false,
        perPack: false,
        declined: ['my-pack'],
      });

      const result = await runRefresh({}, [], projectRoot);

      expect(mocks.applySinglePack).not.toHaveBeenCalled();
      expect(result.data.skipped).toHaveLength(1);
      expect(result.data.skipped[0]!.name).toBe('my-pack');
      expect(result.data.skipped[0]!.reason).toBe('user-declined');
    });

    it('needs-consent all-proceed: applies all', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );
      mocks.runConsentPrompt.mockResolvedValue({
        proceed: true,
        perPack: false,
        declined: [],
      });
      mocks.applySinglePack.mockResolvedValue({ success: true });

      const result = await runRefresh({}, [], projectRoot);

      expect(mocks.applySinglePack).toHaveBeenCalled();
      expect(result.data.refreshed).toHaveLength(1);
    });

    it('needs-consent per-pack: prompts individually and adds declined to skipped', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );
      // First prompt returns per-pack
      mocks.runConsentPrompt
        .mockResolvedValueOnce({ proceed: true, perPack: true, declined: [] })
        // Second prompt (per-pack) declines
        .mockResolvedValueOnce({ proceed: false, perPack: false, declined: ['my-pack'] });

      const result = await runRefresh({}, [], projectRoot);

      expect(mocks.runConsentPrompt).toHaveBeenCalledTimes(2);
      expect(result.data.skipped).toHaveLength(1);
    });

    it('needs-consent per-pack approved: applies the pack', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );
      mocks.runConsentPrompt
        .mockResolvedValueOnce({ proceed: true, perPack: true, declined: [] })
        .mockResolvedValueOnce({ proceed: true, perPack: false, declined: [] });
      mocks.applySinglePack.mockResolvedValue({ success: true });

      const result = await runRefresh({}, [], projectRoot);

      expect(mocks.applySinglePack).toHaveBeenCalled();
      expect(result.data.refreshed).toHaveLength(1);
    });

    it('apply failure without phase/error: uses default fallback strings', async () => {
      mocks.planSinglePack.mockResolvedValue(makePlan('my-pack', 'clean-update'));
      // Omit phase and error to exercise the `?? 'apply'` and `?? 'unknown'` branches
      mocks.applySinglePack.mockResolvedValue({ success: false });

      const result = await runRefresh({}, [], projectRoot);

      expect(result.exitCode).toBe(1);
      expect(result.data.failed[0]!.phase).toBe('apply');
      expect(result.data.failed[0]!.error).toBe('unknown');
    });

    it('json flag suppresses console output on validation error', async () => {
      // Unknown name with json:true — should exit 2 without calling logger.error
      const result = await runRefresh({ json: true }, ['does-not-exist'], projectRoot);
      expect(result.exitCode).toBe(2);
    });

    // ── F: dry-run consent semantic pin ─────────────────────────────────────
    // dry-run with force=false still surfaces needs-consent packs in data.refreshed.
    // The comment in run-refresh.ts reads: "Dry-run assumes the user will proceed."
    // This is intentionally optimistic — the dry-run output previews what WOULD
    // happen if the user consents. A real run (no --force) would prompt first.
    // We pin this behavior so future changes can't silently flip it.

    it('dry-run without --force surfaces needs-consent pack in data.refreshed (optimistic preview)', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );

      const result = await runRefresh({ 'dry-run': true /* force absent */ }, [], projectRoot);

      expect(result.exitCode).toBe(0);
      // Pin: needs-consent IS shown in refreshed even without --force in dry-run
      expect(result.data.refreshed).toHaveLength(1);
      expect(result.data.refreshed[0]!.name).toBe('my-pack');
      // Consent prompt must NOT run in dry-run mode
      expect(mocks.runConsentPrompt).not.toHaveBeenCalled();
      // No actual apply in dry-run
      expect(mocks.applySinglePack).not.toHaveBeenCalled();
    });

    it('dry-run with --force also surfaces needs-consent pack (same optimistic preview)', async () => {
      mocks.planSinglePack.mockResolvedValue(
        makePlan('my-pack', 'needs-consent', {
          modifications: [{ path: 'file.md', reason: 'modified' }],
        }),
      );

      const result = await runRefresh({ 'dry-run': true, force: true }, [], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.data.refreshed).toHaveLength(1);
      expect(result.data.refreshed[0]!.name).toBe('my-pack');
    });
  });
});
