import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  planSinglePack,
  createDefaultResolveRef,
} from '../../../../src/install/refresh/refresh-plan.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';

vi.mock('../../../../src/install/source/git-pin.js', () => ({
  resolveRemoteRefForInstall: vi.fn(async (ref: string, url: string) => `resolved:${ref}:${url}`),
}));

import { resolveRemoteRefForInstall } from '../../../../src/install/source/git-pin.js';

describe('planSinglePack', () => {
  let canonicalDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'refresh-plan-'));
    await mkdir(join(canonicalDir, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  it('returns error plan when .agentsmesh-install-manifest.json is missing', async () => {
    const packsDir = join(canonicalDir, 'packs');
    await mkdir(join(packsDir, 'pack-a'), { recursive: true });
    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'abc123',
    });

    expect(plan.classification).toBe('error');
    expect(plan.error?.message).toMatch(/manifest/i);
  });

  it('returns "unchanged" when no drift and ref unchanged', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-a');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'pack-a',
        source: 'github:org/repo',
        installed_at: '2026-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'abc123',
    });

    expect(plan.classification).toBe('unchanged');
    expect(plan.oldSha).toBe('abc123');
    expect(plan.newSha).toBe('abc123');
  });

  it('returns "clean-update" when ref moved with no drift', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-a');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'pack-a',
        source: 'github:org/repo',
        installed_at: '2026-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'def456',
    });

    expect(plan.classification).toBe('clean-update');
    expect(plan.oldSha).toBe('abc123');
    expect(plan.newSha).toBe('def456');
  });

  it('returns error plan with null oldSha when entry has no version', async () => {
    const packsDir = join(canonicalDir, 'packs');
    await mkdir(join(packsDir, 'pack-nover'), { recursive: true });
    const entry: InstallManifestEntry = {
      name: 'pack-nover',
      source: 'github:org/repo',
      source_kind: 'github',
      features: ['skills'],
      // no version
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'abc123',
    });

    expect(plan.classification).toBe('error');
    expect(plan.oldSha).toBeNull();
    expect(plan.newSha).toBe('');
  });

  it('returns error plan when .agentsmesh-install-manifest.json is corrupt JSON', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-b');
    await mkdir(packDir, { recursive: true });
    await writeFile(join(packDir, '.agentsmesh-install-manifest.json'), 'not valid json {{');

    const entry: InstallManifestEntry = {
      name: 'pack-b',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'abc123',
    });

    expect(plan.classification).toBe('error');
    expect(plan.error?.message).toMatch(/corrupt/i);
  });

  it('returns "error" when resolveRef throws', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-a');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'pack-a',
        source: 'github:org/repo',
        installed_at: '2026-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => {
        throw new Error('network unreachable');
      },
    });

    expect(plan.classification).toBe('error');
    expect(plan.error?.message).toMatch(/network/i);
  });
});

describe('createDefaultResolveRef', () => {
  const resolve = createDefaultResolveRef();

  it('returns entry.version unchanged for local sources', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'local:./x',
      source_kind: 'local',
      version: 'v1',
      features: ['skills'],
    };
    expect(await resolve(entry)).toBe('v1');
  });

  it('falls back to "local" when local source has no version', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'local:./x',
      source_kind: 'local',
      features: ['skills'],
    };
    expect(await resolve(entry)).toBe('local');
  });

  it('resolves github:<org>/<repo>@<ref> using the pinned ref', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'github:myorg/myrepo@main',
      source_kind: 'github',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'main',
      'https://github.com/myorg/myrepo.git',
    );
  });

  it('resolves github:<org>/<repo> (no ref) via HEAD', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'github:myorg/myrepo',
      source_kind: 'github',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'HEAD',
      'https://github.com/myorg/myrepo.git',
    );
  });

  it('resolves gitlab:<ns>/<repo>@<ref>', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'gitlab:myns/myproject@v1',
      source_kind: 'gitlab',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'v1',
      'https://gitlab.com/myns/myproject.git',
    );
  });

  it('resolves gitlab:<ns>/<repo> (no ref) via HEAD', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'gitlab:myns/myproject',
      source_kind: 'gitlab',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'HEAD',
      'https://gitlab.com/myns/myproject.git',
    );
  });

  it('resolves git+<url>#<ref>', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'git+https://example.com/repo.git#mybranch',
      source_kind: 'git',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'mybranch',
      'https://example.com/repo.git',
    );
  });

  it('resolves git+<url> without a ref via HEAD', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'git+https://example.com/repo.git',
      source_kind: 'git',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith('HEAD', 'https://example.com/repo.git');
  });

  it('falls back to HEAD for bare HTTPS sources', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'https://example.com/repo.git',
      source_kind: 'git',
      features: ['skills'],
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith('HEAD', 'https://example.com/repo.git');
  });

  it('uses original_ref when present instead of the embedded ref in source', async () => {
    // source carries pinned SHA (which would make refresh a no-op without original_ref)
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'git+https://example.com/repo.git#abc123sha',
      source_kind: 'git',
      features: ['skills'],
      original_ref: 'main',
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith('main', 'https://example.com/repo.git');
  });

  it('falls back to source ref when original_ref is absent (backward compat)', async () => {
    // Old install with pinned SHA in source; no original_ref → no-op re-resolve
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'git+https://example.com/repo.git#abc123sha',
      source_kind: 'git',
      features: ['skills'],
      // no original_ref
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'abc123sha',
      'https://example.com/repo.git',
    );
  });

  it('falls back to source ref when original_ref is empty string', async () => {
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'git+https://example.com/repo.git#abc123sha',
      source_kind: 'git',
      features: ['skills'],
      original_ref: '',
    };
    await resolve(entry);
    expect(resolveRemoteRefForInstall).toHaveBeenCalledWith(
      'abc123sha',
      'https://example.com/repo.git',
    );
  });
});
