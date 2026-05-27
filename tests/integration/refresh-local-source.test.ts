/**
 * Integration test: refresh against a local source.
 *
 * Flow: install a local pack directory → mutate the source → runRefresh →
 * assert updated content on disk.
 *
 * Local sources always show as clean-update in the refresh planner (their
 * stored version is absent, so newSha = 'local' vs oldSha = null).
 * The refresh pipeline re-runs install from the recorded relative source path.
 */

import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRefresh } from '../../src/install/refresh/run-refresh.js';
import { runInstall } from '../../src/install/run/run-install.js';
import { readInstallManifest } from '../../src/install/core/install-manifest.js';

describe('refresh against a local source', () => {
  let projectRoot: string;
  let localPack: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'refresh-local-'));
    localPack = await mkdtemp(join(tmpdir(), 'refresh-local-src-'));

    // Project setup
    await mkdir(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
    await writeFile(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets:\n  - claude-code\nfeatures:\n  - skills\nextends: []\n',
    );
    await writeFile(
      join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );

    // Local pack source: skills/l-skill/SKILL.md at v1
    await mkdir(join(localPack, 'skills', 'l-skill'), { recursive: true });
    await writeFile(
      join(localPack, 'skills', 'l-skill', 'SKILL.md'),
      '---\nname: l-skill\ndescription: v1\n---\n# v1\n',
    );
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(localPack, { recursive: true, force: true });
  });

  it('refresh re-copies updated local source content', async () => {
    // Install the local pack with a fixed name so we know where to look
    const installResult = await runInstall(
      { force: true, name: 'local-pack' },
      [localPack],
      projectRoot,
    );
    expect(installResult.exitCode).toBe(0);

    // Confirm the installs.yaml entry is local
    const canonicalDir = join(projectRoot, '.agentsmesh');
    const manifest = await readInstallManifest(canonicalDir);
    const entry = manifest.find((e) => e.name === 'local-pack');
    expect(entry).toBeDefined();
    expect(entry?.source_kind).toBe('local');

    // Verify v1 content is on disk
    const skillPath = join(canonicalDir, 'packs', 'local-pack', 'skills', 'l-skill', 'SKILL.md');
    const v1 = await readFile(skillPath, 'utf8');
    expect(v1).toContain('# v1');

    // Update the local source to v2
    await writeFile(
      join(localPack, 'skills', 'l-skill', 'SKILL.md'),
      '---\nname: l-skill\ndescription: v2\n---\n# v2\n',
    );

    // Run refresh — local sources always classify as clean-update
    const result = await runRefresh({ force: true }, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.refreshed).toHaveLength(1);
    expect(result.data.refreshed[0]?.name).toBe('local-pack');

    // Verify v2 content is now on disk
    const v2 = await readFile(skillPath, 'utf8');
    expect(v2).toContain('# v2');
    expect(v2).not.toContain('# v1');
  });

  it('refresh stamps refreshed_at on the installs.yaml entry', async () => {
    await runInstall({ force: true, name: 'local-pack' }, [localPack], projectRoot);

    const canonicalDir = join(projectRoot, '.agentsmesh');
    const before = await readInstallManifest(canonicalDir);
    expect(before.find((e) => e.name === 'local-pack')?.refreshed_at).toBeUndefined();

    await runRefresh({ force: true }, [], projectRoot);

    const after = await readInstallManifest(canonicalDir);
    const refreshedAt = after.find((e) => e.name === 'local-pack')?.refreshed_at;
    expect(refreshedAt).toBeDefined();
    expect(new Date(refreshedAt!).getTime()).toBeGreaterThan(0);
  });
});
