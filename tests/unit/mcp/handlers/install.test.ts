/**
 * Unit coverage for `src/mcp/handlers/install.ts`:
 *   - Validation: missing source, uninstall without names AND without --all.
 *   - Flag mapping: `dry_run`/`extends`/`global` translate to the right
 *     orchestrator flag keys.
 *   - Always non-interactive: `force` is forced to `true` so the underlying
 *     orchestrator skips every prompt.
 *   - Error wrapping: lock contention maps to LOCK_HELD; validation-shaped
 *     messages map to VALIDATION_FAILED; everything else to IO_ERROR.
 *   - Filesystem-path leakage is redacted before wrapping.
 *   - `installs_list` happy path returns the expected envelope.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as runInstallMod from '../../../../src/install/run/run-install.js';
import * as runUninstallMod from '../../../../src/install/uninstall/run-uninstall.js';
import * as runInstallsListMod from '../../../../src/cli/commands/installs-list.js';

import { installHandlers } from '../../../../src/mcp/handlers/install.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import { McpError } from '../../../../src/mcp/errors.js';

let projectRoot = '';

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mcp-install-handler-'));
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

describe('installHandlers.install — validation', () => {
  it('throws VALIDATION_FAILED when source is missing', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(
      // @ts-expect-error -- testing the runtime guard
      installHandlers.install(ctx, {}),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('throws VALIDATION_FAILED when source is whitespace-only', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(installHandlers.install(ctx, { source: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('installHandlers.install — flag mapping', () => {
  it('always forces non-interactive mode and threads each option to the right flag key', async () => {
    const spy = vi.spyOn(runInstallMod, 'runInstall').mockResolvedValue({
      exitCode: 0,
      data: {
        source: 'github:acme/pack',
        mode: 'install',
        installed: [],
        skipped: [],
        dryRun: true,
      },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await installHandlers.install(ctx, {
      source: 'github:acme/pack',
      path: 'rules',
      target: 'claude-code',
      as: 'rules',
      name: 'acme-rules',
      extends: true,
      all: false,
      sync: true,
      dry_run: true,
      global: true,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const [flags, args, root] = spy.mock.calls[0]!;
    expect(args).toEqual(['github:acme/pack']);
    expect(root).toBe(projectRoot);
    expect(flags).toMatchObject({
      force: true,
      path: 'rules',
      target: 'claude-code',
      as: 'rules',
      name: 'acme-rules',
      extends: true,
      sync: true,
      'dry-run': true,
      global: true,
    });
    // `all: false` must not appear at all (only true flips it on).
    expect((flags as Record<string, unknown>).all).toBeUndefined();
  });

  it('returns the inner data envelope verbatim on exitCode 0', async () => {
    const envelope = {
      source: 'github:acme/pack',
      mode: 'install' as const,
      installed: [{ kind: 'rules', name: 'one', path: '.agentsmesh/rules/one.md' }],
      skipped: [],
      dryRun: false,
    };
    vi.spyOn(runInstallMod, 'runInstall').mockResolvedValue({ exitCode: 0, data: envelope });

    const ctx = await resolveContext({ cwd: projectRoot });
    const out = await installHandlers.install(ctx, { source: 'github:acme/pack' });
    expect(out).toBe(envelope);
  });

  it('wraps a non-zero exitCode as IO_ERROR', async () => {
    vi.spyOn(runInstallMod, 'runInstall').mockResolvedValue({
      exitCode: 1,
      data: {
        source: 'github:acme/pack',
        mode: 'install',
        installed: [],
        skipped: [],
        dryRun: false,
      },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(
      installHandlers.install(ctx, { source: 'github:acme/pack' }),
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
  });
});

describe('installHandlers.install — error wrapping', () => {
  it('maps lock-shaped errors to LOCK_HELD', async () => {
    vi.spyOn(runInstallMod, 'runInstall').mockRejectedValue(
      new Error('LockAcquisitionError: install lock held by pid 9999'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(
      installHandlers.install(ctx, { source: 'github:acme/pack' }),
    ).rejects.toMatchObject({ code: 'LOCK_HELD' });
  });

  it('maps validation-shaped messages to VALIDATION_FAILED', async () => {
    vi.spyOn(runInstallMod, 'runInstall').mockRejectedValue(
      new Error('Missing source. Usage: agentsmesh install <source>'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(
      installHandlers.install(ctx, { source: 'github:acme/pack' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('redacts absolute paths in error messages before wrapping', async () => {
    vi.spyOn(runInstallMod, 'runInstall').mockRejectedValue(
      new Error('disk write failed at /Users/secret/projects/host/.agentsmesh/packs/foo'),
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    let caught: unknown;
    try {
      await installHandlers.install(ctx, { source: 'github:acme/pack' });
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
});

describe('installHandlers.uninstall', () => {
  it('throws VALIDATION_FAILED when neither `names` nor `all` is provided', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    await expect(installHandlers.uninstall(ctx, { names: [] })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('threads `all: true` and skips the names check', async () => {
    const spy = vi.spyOn(runUninstallMod, 'runUninstall').mockResolvedValue({
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'uninstall',
        removed: [],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await installHandlers.uninstall(ctx, { names: [], all: true });

    expect(spy).toHaveBeenCalledTimes(1);
    const [flags, args] = spy.mock.calls[0]!;
    expect(args).toEqual([]);
    expect(flags).toMatchObject({ force: true, all: true });
  });

  it('threads keep_pack / keep_generated / dry_run / global as the orchestrator expects', async () => {
    const spy = vi.spyOn(runUninstallMod, 'runUninstall').mockResolvedValue({
      exitCode: 0,
      data: {
        scope: 'global',
        mode: 'uninstall',
        removed: [],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await installHandlers.uninstall(ctx, {
      names: ['demo-pack'],
      keep_pack: true,
      keep_generated: true,
      dry_run: true,
      global: true,
    });

    const [flags, args] = spy.mock.calls[0]!;
    expect(args).toEqual(['demo-pack']);
    expect(flags).toMatchObject({
      force: true,
      'keep-pack': true,
      'keep-generated': true,
      'dry-run': true,
      global: true,
    });
  });

  it('returns the inner data envelope verbatim (including a failed[] entry)', async () => {
    const envelope = {
      scope: 'project' as const,
      mode: 'uninstall' as const,
      removed: [],
      skipped: [],
      failed: [{ name: 'broken', reason: 'EACCES' }],
      dryRun: false,
    };
    vi.spyOn(runUninstallMod, 'runUninstall').mockResolvedValue({ exitCode: 1, data: envelope });

    const ctx = await resolveContext({ cwd: projectRoot });
    const out = await installHandlers.uninstall(ctx, { names: ['broken'] });
    expect(out).toBe(envelope);
  });
});

describe('installHandlers.installsList', () => {
  it('passes `global: true` through to the underlying command', async () => {
    const spy = vi.spyOn(runInstallsListMod, 'runInstallsList').mockResolvedValue({
      exitCode: 0,
      data: { scope: 'global', subcommand: 'list', installs: [] },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await installHandlers.installsList(ctx, { global: true });

    const [flags, root] = spy.mock.calls[0]!;
    expect(root).toBe(projectRoot);
    expect(flags).toEqual({ global: true });
  });

  it('omits the `global` flag when not requested', async () => {
    const spy = vi.spyOn(runInstallsListMod, 'runInstallsList').mockResolvedValue({
      exitCode: 0,
      data: { scope: 'project', subcommand: 'list', installs: [] },
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    await installHandlers.installsList(ctx, {});

    const [flags] = spy.mock.calls[0]!;
    expect(flags).toEqual({});
  });

  it('returns the inner data envelope verbatim', async () => {
    const envelope = {
      scope: 'project' as const,
      subcommand: 'list' as const,
      installs: [
        {
          name: 'demo-pack',
          source: 'github:acme/demo-pack',
          source_kind: 'github',
          source_type: 'anthropic-skill-pack',
          version: 'sha',
          features: ['skills'],
          target: null,
          installed_at: '2026-05-22T00:00:00.000Z',
          pack_path: '.agentsmesh/packs/demo-pack',
        },
      ],
    };
    vi.spyOn(runInstallsListMod, 'runInstallsList').mockResolvedValue({
      exitCode: 0,
      data: envelope,
    });

    const ctx = await resolveContext({ cwd: projectRoot });
    const out = await installHandlers.installsList(ctx, {});
    expect(out).toBe(envelope);
  });
});
