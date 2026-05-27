/**
 * Unit coverage for `src/mcp/handlers/refresh.ts`:
 *   - Handler dispatches to runRefresh with force: true always set.
 *   - Unknown pack name triggers VALIDATION_FAILED via exit code 2.
 *   - Error wrapping: lock-shaped errors → LOCK_HELD; resolve/network →
 *     REFRESH_RESOLVE_FAILED; apply/materialize → REFRESH_APPLY_FAILED;
 *     everything else → IO_ERROR.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as runRefreshMod from '../../../../src/install/refresh/run-refresh.js';
import { refreshHandlers } from '../../../../src/mcp/handlers/refresh.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import { McpError } from '../../../../src/mcp/errors.js';

let projectRoot = '';

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mcp-refresh-handler-'));
  await mkdir(join(projectRoot, '.agentsmesh'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
    'utf8',
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectRoot, { recursive: true, force: true });
});

describe('refreshHandlers.refresh — flag mapping', () => {
  it('always forces non-interactive mode and dispatches to runRefresh', async () => {
    const spy = vi.spyOn(runRefreshMod, 'runRefresh').mockResolvedValue({
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await refreshHandlers.refresh(ctx, { names: ['my-pack'], dry_run: true, global: true });

    expect(spy).toHaveBeenCalledTimes(1);
    const [flags, args, root] = spy.mock.calls[0]!;
    expect(args).toEqual(['my-pack']);
    expect(root).toBe(projectRoot);
    expect(flags).toMatchObject({
      force: true,
      'dry-run': true,
      global: true,
    });
  });

  it('returns the inner data envelope verbatim on exitCode 0', async () => {
    const envelope = {
      scope: 'project' as const,
      mode: 'refresh' as const,
      refreshed: [
        {
          name: 'my-pack',
          oldRef: 'abc123',
          newRef: 'def456',
          oldSha: 'abc123',
          newSha: 'def456',
          changedFiles: { added: [], removed: [], modified: [] },
        },
      ],
      unchanged: [],
      skipped: [],
      failed: [],
      dryRun: false,
    };
    vi.spyOn(runRefreshMod, 'runRefresh').mockResolvedValue({ exitCode: 0, data: envelope });

    const ctx = await resolveContext({ cwd: projectRoot });
    const out = await refreshHandlers.refresh(ctx, { names: ['my-pack'] });
    expect(out).toBe(envelope);
  });

  it('omits dry-run and global flags when not set', async () => {
    const spy = vi.spyOn(runRefreshMod, 'runRefresh').mockResolvedValue({
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await refreshHandlers.refresh(ctx, {});

    const [flags] = spy.mock.calls[0]!;
    expect(flags).toEqual({ force: true });
  });
});

describe('refreshHandlers.refresh — unknown-pack via real tmpdir', () => {
  it('wraps unknown-pack errors as VALIDATION_FAILED', async () => {
    // Use a real tmpdir with seeded agentsmesh.yaml + installs.yaml so the
    // orchestrator runs through its full validation path and returns exitCode 2.
    const projectRoot2 = await mkdtemp(join(tmpdir(), 'refresh-mcp-'));
    await mkdir(join(projectRoot2, '.agentsmesh'), { recursive: true });
    await writeFile(
      join(projectRoot2, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
      'utf8',
    );
    await writeFile(
      join(projectRoot2, '.agentsmesh', 'installs.yaml'),
      'version: 1\ninstalls: []\n',
      'utf8',
    );
    try {
      const ctx = await resolveContext({ cwd: projectRoot2 });
      await expect(refreshHandlers.refresh(ctx, { names: ['nope'] })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    } finally {
      await rm(projectRoot2, { recursive: true, force: true });
    }
  });
});

describe('refreshHandlers.refresh — error wrapping', () => {
  it('maps lock-shaped errors to LOCK_HELD', async () => {
    vi.spyOn(runRefreshMod, 'runRefresh').mockRejectedValue(
      new Error('LockAcquisitionError: install lock held by pid 9999'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(refreshHandlers.refresh(ctx, {})).rejects.toMatchObject({ code: 'LOCK_HELD' });
  });

  it('maps resolve/network errors to REFRESH_RESOLVE_FAILED', async () => {
    vi.spyOn(runRefreshMod, 'runRefresh').mockRejectedValue(
      new Error('network fetch failed: could not resolve remote'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(refreshHandlers.refresh(ctx, {})).rejects.toMatchObject({
      code: 'REFRESH_RESOLVE_FAILED',
    });
  });

  it('maps apply/materialize errors to REFRESH_APPLY_FAILED', async () => {
    vi.spyOn(runRefreshMod, 'runRefresh').mockRejectedValue(
      new Error('materialize step failed: ENOENT'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(refreshHandlers.refresh(ctx, {})).rejects.toMatchObject({
      code: 'REFRESH_APPLY_FAILED',
    });
  });

  it('maps unknown errors to IO_ERROR', async () => {
    vi.spyOn(runRefreshMod, 'runRefresh').mockRejectedValue(new Error('some unexpected error'));
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(refreshHandlers.refresh(ctx, {})).rejects.toMatchObject({ code: 'IO_ERROR' });
  });

  it('redacts absolute paths in error messages before wrapping', async () => {
    vi.spyOn(runRefreshMod, 'runRefresh').mockRejectedValue(
      new Error('disk write failed at /Users/secret/projects/host/.agentsmesh/packs/foo'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    let caught: unknown;
    try {
      await refreshHandlers.refresh(ctx, {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(McpError);
    const err = caught as McpError;
    expect(err.code).toBe('IO_ERROR');
    const reason = (err.details as { reason: string }).reason;
    expect(reason).not.toContain('/Users/secret');
    expect(reason).toContain('<redacted>');
  });

  it('wraps exitCode 2 (unknown names) as VALIDATION_FAILED with name in message', async () => {
    vi.spyOn(runRefreshMod, 'runRefresh').mockResolvedValue({
      exitCode: 2,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    });
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(refreshHandlers.refresh(ctx, { names: ['ghost-pack'] })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: /ghost-pack/i,
    });
  });
});
