import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from './helpers/run-cli.js';
import { listRelativeFiles, snapshotProject } from './helpers/project-state.js';
import { readYaml } from './helpers/assertions.js';

function makeRoot(prefix: string): string {
  return join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function writeProject(root: string, features: string): string {
  const project = join(root, 'project');
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    `version: 1\ntargets: [claude-code]\nfeatures: [rules, ${features}]\nextends: []\n`,
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
  return project;
}

describe('install replay e2e', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  it('replays sibling installs from one source folder as one narrowed pack', async () => {
    root = makeRoot('am-e2e-install-sibling');
    const upstream = join(root, 'upstream');
    mkdirSync(join(upstream, 'agents', 'core'), { recursive: true });
    writeFileSync(
      join(upstream, 'agents', 'core', 'code-archaeologist.md'),
      '---\ndescription: Code archaeologist\ntools: Read, Grep\n---\n\nDig.\n',
    );
    writeFileSync(
      join(upstream, 'agents', 'core', 'documentation-specialist.md'),
      '---\ndescription: Documentation specialist\ntools: Read, Write\n---\n\nDocs.\n',
    );
    const project = writeProject(root, 'agents');

    expect(
      (
        await runCli(
          'install ../upstream --force --as agents --path agents/core/code-archaeologist.md',
          project,
        )
      ).exitCode,
    ).toBe(0);
    expect(
      (
        await runCli(
          'install ../upstream --force --as agents --path agents/core/documentation-specialist.md',
          project,
        )
      ).exitCode,
    ).toBe(0);

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'upstream-agents'))).toEqual([
      'agents/code-archaeologist.md',
      'agents/documentation-specialist.md',
      'pack.yaml',
    ]);

    const manifest = readYaml(join(project, '.agentsmesh', 'installs.yaml'));
    expect(manifest).toEqual({
      version: 1,
      installs: [
        {
          as: 'agents',
          features: ['agents'],
          name: 'upstream-agents',
          path: 'agents/core',
          pick: { agents: ['code-archaeologist', 'documentation-specialist'] },
          source: '../upstream',
          source_kind: 'local',
        },
      ],
    });

    rmSync(join(project, '.agentsmesh', 'packs'), { recursive: true, force: true });
    expect((await runCli('install --sync --force', project)).exitCode).toBe(0);
    expect(listRelativeFiles(join(project, '.claude', 'agents'))).toEqual([
      'code-archaeologist.md',
      'documentation-specialist.md',
    ]);
  });

  it('collapses multi-path installs from one repo into one pack and replays all paths on sync', async () => {
    root = makeRoot('am-e2e-install-multipath');
    const upstream = join(root, 'upstream');
    mkdirSync(join(upstream, 'agents', 'core'), { recursive: true });
    mkdirSync(join(upstream, 'agents', 'universal'), { recursive: true });
    writeFileSync(
      join(upstream, 'agents', 'core', 'code-archaeologist.md'),
      '---\ndescription: Code archaeologist\n---\n\nDig.\n',
    );
    writeFileSync(
      join(upstream, 'agents', 'universal', 'documentation-specialist.md'),
      '---\ndescription: Documentation specialist\n---\n\nDocs.\n',
    );
    const project = writeProject(root, 'agents');

    await runCli(
      'install ../upstream --force --as agents --path agents/core/code-archaeologist.md',
      project,
    );
    await runCli(
      'install ../upstream --force --as agents --path agents/universal/documentation-specialist.md',
      project,
    );

    const manifest = readYaml(join(project, '.agentsmesh', 'installs.yaml'));
    expect(manifest).toEqual({
      version: 1,
      installs: [
        {
          as: 'agents',
          features: ['agents'],
          name: 'upstream-agents',
          paths: ['agents/core', 'agents/universal'],
          pick: { agents: ['code-archaeologist', 'documentation-specialist'] },
          source: '../upstream',
          source_kind: 'local',
        },
      ],
    });

    rmSync(join(project, '.agentsmesh', 'packs'), { recursive: true, force: true });
    expect((await runCli('install --sync --force', project)).exitCode).toBe(0);
    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'upstream-agents'))).toEqual([
      'agents/code-archaeologist.md',
      'agents/documentation-specialist.md',
      'pack.yaml',
    ]);
  });

  it('keeps install --sync --dry-run side-effect free for packs, generated artifacts, and installs.yaml', async () => {
    root = makeRoot('am-e2e-install-sync-dry');
    const upstream = join(root, 'upstream');
    mkdirSync(join(upstream, '.agentsmesh', 'skills', 'demo'), { recursive: true });
    writeFileSync(
      join(upstream, '.agentsmesh', 'skills', 'demo', 'SKILL.md'),
      '---\ndescription: Demo\n---\n# Demo\n',
    );
    const project = writeProject(root, 'skills');

    expect((await runCli(`install ${upstream} --force --name shared-pack`, project)).exitCode).toBe(
      0,
    );

    rmSync(join(project, '.agentsmesh', 'packs', 'shared-pack'), { recursive: true, force: true });
    rmSync(join(project, '.claude', 'skills'), { recursive: true, force: true });
    const before = snapshotProject(project);

    const result = await runCli('install --sync --dry-run --force', project);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(snapshotProject(project)).toEqual(before);
  });
});
