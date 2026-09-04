import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySinglePack } from '../../../../src/install/refresh/refresh-apply.js';
import type { RefreshPlan } from '../../../../src/install/refresh/refresh-plan.js';
import {
  readInstallManifest,
  upsertInstallManifestEntry,
  type InstallManifestEntry,
} from '../../../../src/install/core/install-manifest.js';

const ENTRY: InstallManifestEntry = {
  name: 'pack-a',
  source: 'github:org/repo',
  source_kind: 'github',
  version: 'old',
  features: ['skills'],
};

const PLAN: RefreshPlan = {
  name: 'pack-a',
  entry: ENTRY,
  oldSha: 'old',
  newSha: 'new',
  modifications: [],
  classification: 'clean-update',
};

const runInstallForRefresh = vi.fn(async (_entry: InstallManifestEntry, _sha: string) => {});

let canonicalDir: string;

beforeEach(async () => {
  canonicalDir = await mkdtemp(join(tmpdir(), 'am-'));
  runInstallForRefresh.mockClear();
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(canonicalDir, { recursive: true, force: true });
});

describe('applySinglePack branches', () => {
  it('stamps refreshed_at from the system clock when deps.now is absent', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-04T10:20:30.000Z') });
    await upsertInstallManifestEntry(canonicalDir, ENTRY);

    const result = await applySinglePack(PLAN, canonicalDir, { runInstallForRefresh });

    expect(result).toEqual({ success: true });
    expect(runInstallForRefresh).toHaveBeenCalledWith(ENTRY, 'new');
    const manifest = await readInstallManifest(canonicalDir);
    expect(manifest).toEqual([{ ...ENTRY, refreshed_at: '2026-09-04T10:20:30.000Z' }]);
  });

  it('fails in manifest-update when the entry is missing after install', async () => {
    const result = await applySinglePack(PLAN, canonicalDir, {
      runInstallForRefresh,
      now: () => '2026-09-04T00:00:00.000Z',
    });

    expect(result).toEqual({
      success: false,
      phase: 'manifest-update',
      error: 'Entry "pack-a" not found after install',
    });
    expect(runInstallForRefresh).toHaveBeenCalledTimes(1);
    await expect(readInstallManifest(canonicalDir)).resolves.toEqual([]);
  });

  it('reports an Error thrown by deps.now with its message', async () => {
    await upsertInstallManifestEntry(canonicalDir, ENTRY);
    const now = (): string => {
      throw new Error('clock broken');
    };

    const result = await applySinglePack(PLAN, canonicalDir, { runInstallForRefresh, now });

    expect(result).toEqual({ success: false, phase: 'manifest-update', error: 'clock broken' });
    const manifest = await readInstallManifest(canonicalDir);
    expect(manifest[0]?.refreshed_at).toBeUndefined();
  });

  it('stringifies a non-Error thrown by deps.now', async () => {
    await upsertInstallManifestEntry(canonicalDir, ENTRY);
    const now = (): string => {
      throw 'clock string';
    };

    const result = await applySinglePack(PLAN, canonicalDir, { runInstallForRefresh, now });

    expect(result).toEqual({ success: false, phase: 'manifest-update', error: 'clock string' });
  });

  it('stringifies a non-Error rejection from runInstallForRefresh', async () => {
    const failing = vi.fn(async () => {
      throw 'install string';
    });

    const result = await applySinglePack(PLAN, canonicalDir, { runInstallForRefresh: failing });

    expect(result).toEqual({ success: false, phase: 'apply', error: 'install string' });
    await expect(readInstallManifest(canonicalDir)).resolves.toEqual([]);
  });
});
