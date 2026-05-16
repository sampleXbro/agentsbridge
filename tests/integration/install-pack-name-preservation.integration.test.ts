/**
 * Pack-name preservation across re-installs (integration).
 *
 * Local re-install of the same Anthropic skill-pack source must NOT
 * create a second pack directory even when the caller supplies a
 * different `--name`. The existing `findExistingPack` path (matching by
 * source identity + target + `as` + features) already routes the second
 * install onto the same pack directory and merges contents in.
 *
 * Cross-protocol identity (https/ssh/`github:` shorthand) is exercised by
 * unit coverage of `findExistingInstallName` in
 * `tests/unit/install/core/install-name.test.ts`; replicating it at
 * integration scope would require network and is intentionally not
 * attempted here.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-pack-name-preservation-integration');

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

function writeSkill(upstream: string, name: string): void {
  const dir = join(upstream, 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFile(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}\n`,
  );
}

function buildUpstream(upstream: string): void {
  mkdirSync(upstream, { recursive: true });
  writeSkill(upstream, 'alpha');
  writeSkill(upstream, 'bravo');
  // Push classifier score over the skill-pack threshold.
  mkdirSync(join(upstream, 'agents'), { recursive: true });
  writeFile(
    join(upstream, 'agents', 'helper.md'),
    '---\nname: helper\ndescription: helper\n---\n# helper\n',
  );
  writeFile(join(upstream, 'CLAUDE.md'), '# Claude\n');
  writeFile(join(upstream, 'AGENTS.md'), '# Agents\n');
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFile(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills, agents]\nextends: []\n',
  );
  writeFile(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

interface InstallManifest {
  readonly source_type: string | null;
  readonly files: Readonly<Record<string, string>>;
}

describe('install pack-name preservation (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('preserves the original pack name when re-installing the same source under a different --name', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'pack-original' }, [upstream], project);
    expect(readdirSync(join(project, '.agentsmesh', 'packs')).sort()).toEqual(['pack-original']);

    // Add a new skill and re-install with a different --name. The second
    // install must hit the existing pack and NOT create a new directory.
    writeSkill(upstream, 'charlie');

    await runInstall({ force: true, name: 'pack-renamed' }, [upstream], project);

    const packsDir = join(project, '.agentsmesh', 'packs');
    expect(readdirSync(packsDir).sort()).toEqual(['pack-original']);
    expect(existsSync(join(packsDir, 'pack-renamed'))).toBe(false);

    // New skill is present in the preserved pack.
    expect(readdirSync(join(packsDir, 'pack-original', 'skills')).sort()).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('re-install is idempotent on identical content (manifest unchanged)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'pack-idem' }, [upstream], project);
    const packDir = join(project, '.agentsmesh', 'packs', 'pack-idem');
    const manifest1 = JSON.parse(
      readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8'),
    ) as InstallManifest;

    await runInstall({ force: true, name: 'pack-idem' }, [upstream], project);
    const manifest2 = JSON.parse(
      readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8'),
    ) as InstallManifest;

    expect(manifest2.source_type).toBe(manifest1.source_type);
    expect(Object.keys(manifest2.files).sort()).toEqual(Object.keys(manifest1.files).sort());
    for (const [path, hash] of Object.entries(manifest1.files)) {
      expect(manifest2.files[path]).toBe(hash);
    }
  });
});
