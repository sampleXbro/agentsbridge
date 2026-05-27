// tests/unit/install/refresh/refresh-apply.test.ts
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySinglePack } from '../../../../src/install/refresh/refresh-apply.js';
import type { RefreshPlan } from '../../../../src/install/refresh/refresh-plan.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';
import {
  upsertInstallManifestEntry,
  readInstallManifest,
} from '../../../../src/install/core/install-manifest.js';

describe('applySinglePack', () => {
  let canonicalDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'refresh-apply-'));
    await mkdir(join(canonicalDir, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  it('calls runInstallForRefresh and stamps refreshed_at', async () => {
    const calls: Array<{ entry: InstallManifestEntry; newSha: string }> = [];
    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'old',
      features: ['skills'],
    };

    // Pre-populate the manifest so the stamp step finds the entry
    // (the mock install doesn't write to disk; we simulate what the real
    // install pipeline would leave behind)
    await upsertInstallManifestEntry(canonicalDir, entry);

    const runInstallForRefresh = vi.fn(async (e: InstallManifestEntry, newSha: string) => {
      calls.push({ entry: e, newSha });
    });

    const plan: RefreshPlan = {
      name: 'pack-a',
      entry,
      oldSha: 'old',
      newSha: 'new',
      modifications: [],
      classification: 'clean-update',
    };

    const now = '2026-05-26T12:00:00.000Z';
    const result = await applySinglePack(plan, canonicalDir, {
      runInstallForRefresh,
      now: () => now,
    });

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.newSha).toBe('new');

    // Verify refreshed_at was stamped on the manifest entry
    const manifest = await readInstallManifest(canonicalDir);
    const stamped = manifest.find((e) => e.name === 'pack-a');
    expect(stamped?.refreshed_at).toBe(now);
  });

  it('returns failure when runInstallForRefresh throws', async () => {
    const runInstallForRefresh = vi.fn(async () => {
      throw new Error('fetch failed');
    });

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'old',
      features: ['skills'],
    };
    const plan: RefreshPlan = {
      name: 'pack-a',
      entry,
      oldSha: 'old',
      newSha: 'new',
      modifications: [],
      classification: 'clean-update',
    };

    const result = await applySinglePack(plan, canonicalDir, { runInstallForRefresh });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fetch failed/);
    expect(result.phase).toBe('apply');
  });
});
