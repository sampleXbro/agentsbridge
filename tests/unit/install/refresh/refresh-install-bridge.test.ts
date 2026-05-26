// tests/unit/install/refresh/refresh-install-bridge.test.ts
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { createRunInstallForRefresh } from '../../../../src/install/refresh/refresh-install-bridge.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';

vi.mock('../../../../src/install/run/run-install.js', () => ({
  runInstall: vi.fn(),
}));

// Import the mocked runInstall after vi.mock is hoisted
import { runInstall } from '../../../../src/install/run/run-install.js';

const mockRunInstall = runInstall as MockedFunction<typeof runInstall>;

describe('createRunInstallForRefresh', () => {
  const baseEntry: InstallManifestEntry = {
    name: 'my-pack',
    source: 'github:org/repo@abc123',
    source_kind: 'github',
    version: 'abc123',
    features: ['skills'],
  };

  beforeEach(() => {
    mockRunInstall.mockReset();
    mockRunInstall.mockResolvedValue({
      exitCode: 0,
      data: { source: '', mode: 'install', installed: [], skipped: [], dryRun: false },
    });
  });

  it('returns a function', () => {
    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'project' });
    expect(typeof fn).toBe('function');
  });

  it('passes forceFreshMaterialize: true and force: true in flags', async () => {
    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'project' });
    await fn(baseEntry, 'newsha');

    expect(mockRunInstall).toHaveBeenCalledOnce();
    const [flags] = mockRunInstall.mock.calls[0]!;
    expect(flags.forceFreshMaterialize).toBe(true);
    expect(flags.force).toBe(true);
  });

  it('propagates entry target, as, path, and name to flags', async () => {
    const entry: InstallManifestEntry = {
      ...baseEntry,
      target: 'claude-code',
      as: 'skills',
      path: 'skills/foo',
    };
    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'project' });
    await fn(entry, 'newsha');

    const [flags] = mockRunInstall.mock.calls[0]!;
    expect(flags.target).toBe('claude-code');
    expect(flags.as).toBe('skills');
    expect(flags.path).toBe('skills/foo');
    expect(flags.name).toBe('my-pack');
  });

  it('sets global: true when scope is global', async () => {
    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'global' });
    await fn(baseEntry, 'newsha');

    const [flags] = mockRunInstall.mock.calls[0]!;
    expect(flags.global).toBe(true);
  });

  it('does not set global when scope is project', async () => {
    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'project' });
    await fn(baseEntry, 'newsha');

    const [flags] = mockRunInstall.mock.calls[0]!;
    expect(flags.global).toBeUndefined();
  });

  it('passes the replay scope with entry features and pick', async () => {
    const entry: InstallManifestEntry = {
      ...baseEntry,
      features: ['skills', 'rules'],
      pick: { skills: ['foo-skill'] },
    };
    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'project' });
    await fn(entry, 'newsha');

    const [, , , replay] = mockRunInstall.mock.calls[0]!;
    expect(replay?.features).toEqual(['skills', 'rules']);
    expect(replay?.pick).toEqual({ skills: ['foo-skill'] });
  });

  it('throws when runInstall returns non-zero exit code', async () => {
    mockRunInstall.mockResolvedValue({
      exitCode: 1,
      data: { source: '', mode: 'install', installed: [], skipped: [], dryRun: false },
    });

    const fn = createRunInstallForRefresh({ projectRoot: '/proj', scope: 'project' });
    await expect(fn(baseEntry, 'newsha')).rejects.toThrow(
      /Install for refresh "my-pack" failed with exit code 1/,
    );
  });
});
