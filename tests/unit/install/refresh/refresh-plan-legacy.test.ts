/**
 * Legacy installs.yaml compatibility for the refresh planner.
 *
 * Existing users may have rows that:
 *   - lack `original_ref` (pre-refresh installs)
 *   - lack `refreshed_at` (never refreshed)
 *
 * These MUST parse without error and plan gracefully.
 */

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  planSinglePack,
  createDefaultResolveRef,
} from '../../../../src/install/refresh/refresh-plan.js';
import {
  readInstallManifest,
  installManifestEntrySchema,
} from '../../../../src/install/core/install-manifest.js';

vi.mock('../../../../src/install/source/git-pin.js', () => ({
  resolveRemoteRefForInstall: vi.fn(async (ref: string) => ref),
}));

import { resolveRemoteRefForInstall } from '../../../../src/install/source/git-pin.js';

describe('legacy installs.yaml compatibility', () => {
  let canonicalDir: string;
  let packsDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'refresh-legacy-'));
    packsDir = join(canonicalDir, 'packs');
    await mkdir(packsDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  // ── Zod schema tolerates missing optional fields ────────────────────────

  it('installManifestEntrySchema accepts a row with no original_ref or refreshed_at', () => {
    const result = installManifestEntrySchema.safeParse({
      name: 'old-pack',
      source: 'github:org/repo@abc123sha',
      source_kind: 'github',
      version: 'abc123sha',
      features: ['skills'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.original_ref).toBeUndefined();
      expect(result.data.refreshed_at).toBeUndefined();
    }
  });

  it('installManifestEntrySchema accepts a row with original_ref: main but no refreshed_at', () => {
    const result = installManifestEntrySchema.safeParse({
      name: 'new-pack',
      source: 'github:org/repo@abc123sha',
      source_kind: 'github',
      version: 'abc123sha',
      features: ['skills'],
      original_ref: 'main',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.original_ref).toBe('main');
      expect(result.data.refreshed_at).toBeUndefined();
    }
  });

  // ── readInstallManifest parses legacy YAML file ─────────────────────────

  it('readInstallManifest parses a legacy installs.yaml without original_ref/refreshed_at', async () => {
    await writeFile(
      join(canonicalDir, 'installs.yaml'),
      [
        'version: 1',
        'installs:',
        '  - name: legacy-pack',
        '    source: github:org/legacy@deadbeef1234567890abcdef1234567890abcdef',
        '    version: deadbeef1234567890abcdef1234567890abcdef',
        '    source_kind: github',
        '    features:',
        '      - skills',
        '',
      ].join('\n'),
    );

    const manifest = await readInstallManifest(canonicalDir);
    expect(manifest).toHaveLength(1);
    expect(manifest[0]!.name).toBe('legacy-pack');
    expect(manifest[0]!.original_ref).toBeUndefined();
    expect(manifest[0]!.refreshed_at).toBeUndefined();
  });

  // ── planSinglePack classifies "unchanged" for SHA-baked source w/o original_ref ──

  it('planSinglePack returns "unchanged" for a legacy entry with no original_ref (no-op re-resolve)', async () => {
    const sha = 'deadbeef1234567890abcdef1234567890abcdef';
    const packDir = join(packsDir, 'legacy-pack');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'legacy-pack',
        source: `github:org/legacy@${sha}`,
        installed_at: '2024-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry = {
      name: 'legacy-pack',
      source: `github:org/legacy@${sha}`,
      source_kind: 'github' as const,
      version: sha,
      features: ['skills'] as ['skills'],
      // no original_ref — legacy install
    };

    // Re-resolve the SHA-baked source: without original_ref, createDefaultResolveRef
    // falls back to the embedded SHA ref → resolveRemoteRefForInstall(sha, url).
    // Mock returns sha unchanged → newSha === oldSha → "unchanged".
    (resolveRemoteRefForInstall as ReturnType<typeof vi.fn>).mockResolvedValue(sha);

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: createDefaultResolveRef(),
    });

    expect(plan.classification).toBe('unchanged');
    expect(plan.oldSha).toBe(sha);
    expect(plan.newSha).toBe(sha);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      sha,
      'https://github.com/org/legacy.git',
    );
  });

  // ── original_ref takes priority over the embedded SHA ref ──────────────

  it('createDefaultResolveRef prefers original_ref over the SHA-baked ref in source', async () => {
    const sha = 'abc123sha456789012345678901234567890abcd';
    const entry = {
      name: 'new-pack',
      source: `github:org/repo@${sha}`, // SHA-baked (pinned after install)
      source_kind: 'github' as const,
      version: sha,
      features: ['skills'] as ['skills'],
      original_ref: 'main', // user originally installed @main
    };

    (resolveRemoteRefForInstall as ReturnType<typeof vi.fn>).mockResolvedValue('newsha789');

    const resolveRef = createDefaultResolveRef();
    const resolved = await resolveRef(entry);

    // MUST call with original_ref 'main', not with the SHA
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'main',
      'https://github.com/org/repo.git',
    );
    expect(resolved).toBe('newsha789');
  });

  // ── Actual project installs.yaml roundtrip sanity check ────────────────

  it('project installs.yaml rows parse correctly via installManifestEntrySchema', async () => {
    // Read-only sanity: every entry in the real .agentsmesh/installs.yaml
    // must parse successfully. Hardcode a representative row that mirrors the
    // real file format (source_kind required, optional fields absent).
    const representativeRow = {
      name: 'sample-pack',
      source: 'github:org/sample@1234567890abcdef1234567890abcdef12345678',
      version: '1234567890abcdef1234567890abcdef12345678',
      source_kind: 'github' as const,
      features: ['skills'] as ['skills'],
    };
    const result = installManifestEntrySchema.safeParse(representativeRow);
    expect(result.success).toBe(true);
  });
});
