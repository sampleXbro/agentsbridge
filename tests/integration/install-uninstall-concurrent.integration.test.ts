/**
 * Integration: concurrent install/uninstall lock contention.
 *
 * The `.install.lock` (mirrored from `.generate.lock`) must serialise
 * install AND uninstall on the same project. Two flavors under test:
 *
 *   - install vs. install: hold the lock externally, fire `runInstall`,
 *     expect a `LockAcquisitionError` so callers see a clear failure
 *     rather than racing on filesystem writes.
 *   - install vs. uninstall: hold the lock externally, fire
 *     `runUninstall`, expect the same error.
 *
 * Each test holds the lock for the duration of the call, so the
 * acquirer's retry budget (30 × 200ms = ~6s) elapses before throwing.
 * That's the cost of exercising the real lock path end-to-end; the
 * underlying `acquireProcessLock` semantics are unit-covered elsewhere.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';
import { acquireInstallLock } from '../../src/install/lock/install-lock.js';
import { LockAcquisitionError } from '../../src/core/errors.js';

const ROOT = join(tmpdir(), 'am-install-uninstall-concurrent-integration');

function buildUpstream(upstream: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(can, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: body\n---\n# demo\n',
  );
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

describe('install/uninstall concurrent lock (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('blocks a second install while the lock is held', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');
    const canonicalDir = join(project, '.agentsmesh');

    const release = await acquireInstallLock(canonicalDir);

    try {
      await expect(
        runInstall({ force: true, name: 'demo-pack' }, [upstream], project),
      ).rejects.toBeInstanceOf(LockAcquisitionError);

      // No partial state: the pack dir was never created.
      const packsDir = join(canonicalDir, 'packs');
      if (existsSync(packsDir)) {
        const existingPacks = readdirSync(packsDir, { withFileTypes: true }).filter((d) =>
          d.isDirectory(),
        );
        expect(existingPacks).toEqual([]);
      }
      expect(existsSync(join(canonicalDir, 'installs.yaml'))).toBe(false);
    } finally {
      await release();
    }
  }, 30_000);

  it('blocks uninstall while the lock is held', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');
    const canonicalDir = join(project, '.agentsmesh');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const release = await acquireInstallLock(canonicalDir);
    try {
      await expect(runUninstall({ force: true }, ['demo-pack'], project)).rejects.toBeInstanceOf(
        LockAcquisitionError,
      );
    } finally {
      await release();
    }
  }, 30_000);
});
