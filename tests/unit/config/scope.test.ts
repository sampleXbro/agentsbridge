import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { loadScopedConfig, resolveScopeContext } from '../../../src/config/core/scope.js';
import { ConfigNotFoundError } from '../../../src/core/errors.js';

const TEST_ROOT = join(tmpdir(), `agentsmesh-scope-${process.pid}-${Date.now()}`);

beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

describe('resolveScopeContext', () => {
  it('uses startDir as rootBase for project scope', () => {
    const ctx = resolveScopeContext(TEST_ROOT, 'project');
    expect(ctx).toEqual({
      scope: 'project',
      rootBase: TEST_ROOT,
      configDir: TEST_ROOT,
      canonicalDir: join(TEST_ROOT, '.agentsmesh'),
    });
  });

  it('uses homedir() as rootBase for global scope', () => {
    const ctx = resolveScopeContext(TEST_ROOT, 'global');
    expect(ctx).toEqual({
      scope: 'global',
      rootBase: homedir(),
      configDir: join(homedir(), '.agentsmesh'),
      canonicalDir: join(homedir(), '.agentsmesh'),
    });
  });
});

describe('loadScopedConfig — global scope error UX', () => {
  it('throws scope-aware ConfigNotFoundError when ~/.agentsmesh/agentsmesh.yaml is missing', async () => {
    // Point HOME at our isolated temp root so the lookup fails deterministically.
    const originalHome = process.env['HOME'];
    const originalUserprofile = process.env['USERPROFILE'];
    process.env['HOME'] = TEST_ROOT;
    process.env['USERPROFILE'] = TEST_ROOT;
    try {
      await expect(loadScopedConfig(TEST_ROOT, 'global')).rejects.toMatchObject({
        code: 'AM_CONFIG_NOT_FOUND',
        name: 'ConfigNotFoundError',
        message: expect.stringMatching(
          /global scope.*agentsmesh init --global.*drop the --global flag/s,
        ),
      });
      await expect(loadScopedConfig(TEST_ROOT, 'global')).rejects.toBeInstanceOf(
        ConfigNotFoundError,
      );
    } finally {
      if (originalHome === undefined) delete process.env['HOME'];
      else process.env['HOME'] = originalHome;
      if (originalUserprofile === undefined) delete process.env['USERPROFILE'];
      else process.env['USERPROFILE'] = originalUserprofile;
    }
  });

  it('loads global config when ~/.agentsmesh/agentsmesh.yaml exists', async () => {
    const fakeHome = TEST_ROOT;
    const meshDir = join(fakeHome, '.agentsmesh');
    mkdirSync(meshDir, { recursive: true });
    writeFileSync(join(meshDir, 'agentsmesh.yaml'), 'version: 1');

    const originalHome = process.env['HOME'];
    const originalUserprofile = process.env['USERPROFILE'];
    process.env['HOME'] = fakeHome;
    process.env['USERPROFILE'] = fakeHome;
    try {
      const { config, context } = await loadScopedConfig(TEST_ROOT, 'global');
      expect(config.version).toBe(1);
      expect(context.scope).toBe('global');
      expect(context.canonicalDir).toBe(meshDir);
    } finally {
      if (originalHome === undefined) delete process.env['HOME'];
      else process.env['HOME'] = originalHome;
      if (originalUserprofile === undefined) delete process.env['USERPROFILE'];
      else process.env['USERPROFILE'] = originalUserprofile;
    }
  });
});
