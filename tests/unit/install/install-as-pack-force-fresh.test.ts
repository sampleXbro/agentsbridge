import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installAsPack } from '../../../src/install/run/run-install-pack.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

describe('installAsPack with forceFreshMaterialize', () => {
  let canonicalDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'install-as-pack-force-fresh-'));
    await mkdir(join(canonicalDir, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  function emptyCanonical(): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };
  }

  it('forceFreshMaterialize: true replaces existing pack instead of merging', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const existingPackDir = join(packsDir, 'my-pack');
    await mkdir(join(existingPackDir, 'skills', 'old-skill'), { recursive: true });
    await writeFile(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'), '# OLD');
    await writeFile(
      join(existingPackDir, 'pack.yaml'),
      [
        'name: my-pack',
        'source: github:org/repo',
        'source_kind: github',
        'installed_at: 2026-01-01T00:00:00.000Z',
        'updated_at: 2026-01-01T00:00:00.000Z',
        'content_hash: sha256:0000000000000000000000000000000000000000000000000000000000000000',
        'features:',
        '  - skills',
      ].join('\n'),
    );

    await installAsPack({
      canonicalDir,
      packName: 'my-pack',
      narrowed: emptyCanonical(),
      selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
      sourceForYaml: 'github:org/repo',
      sourceKind: 'github',
      entryFeatures: ['skills'],
      pick: undefined,
      forceFreshMaterialize: true,
    });

    const { exists } = await import('../../../src/utils/filesystem/fs.js');
    expect(await exists(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'))).toBe(false);
  });

  it('forceFreshMaterialize: false (default) preserves existing merge behavior', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const existingPackDir = join(packsDir, 'my-pack');
    await mkdir(join(existingPackDir, 'skills', 'old-skill'), { recursive: true });
    await writeFile(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'), '# OLD');
    await writeFile(
      join(existingPackDir, 'pack.yaml'),
      [
        'name: my-pack',
        'source: github:org/repo',
        'source_kind: github',
        'installed_at: 2026-01-01T00:00:00.000Z',
        'updated_at: 2026-01-01T00:00:00.000Z',
        'content_hash: sha256:0000000000000000000000000000000000000000000000000000000000000000',
        'features:',
        '  - skills',
      ].join('\n'),
    );

    await installAsPack({
      canonicalDir,
      packName: 'my-pack',
      narrowed: emptyCanonical(),
      selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
      sourceForYaml: 'github:org/repo',
      sourceKind: 'github',
      entryFeatures: ['skills'],
      pick: undefined,
    });

    const { exists } = await import('../../../src/utils/filesystem/fs.js');
    expect(await exists(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'))).toBe(true);
  });
});
