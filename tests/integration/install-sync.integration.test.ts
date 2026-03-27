import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { listRelativeFiles, readInstallManifest } from '../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'am-install-sync-integration');

describe('install --sync (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'upstream', '.agentsmesh', 'skills', 'demo'), { recursive: true });
    mkdirSync(join(ROOT, 'project', '.agentsmesh', 'rules'), { recursive: true });

    writeFileSync(
      join(ROOT, 'upstream', '.agentsmesh', 'skills', 'demo', 'SKILL.md'),
      '---\ndescription: Demo skill\n---\n# Demo\n',
    );
    writeFileSync(
      join(ROOT, 'project', 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('reinstalls missing packs from the install manifest', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'shared-pack' }, [upstream], project);
    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'shared-pack'))).toEqual([
      'pack.yaml',
      'skills/demo/SKILL.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        features: ['skills'],
        name: 'shared-pack',
        source: '../upstream',
        source_kind: 'local',
      },
    ]);

    rmSync(join(project, '.agentsmesh', 'packs'), { recursive: true, force: true });

    await runInstall({ sync: true, force: true }, [], project);

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'shared-pack'))).toEqual([
      'pack.yaml',
      'skills/demo/SKILL.md',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/demo/SKILL.md',
    ]);
    expect(readFileSync(join(project, '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8')).toContain(
      '# Demo',
    );
  });

  it('reinstalls only the saved pick subset from the install manifest', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');
    writeFileSync(
      join(project, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, agents]\nextends: []\n',
    );
    mkdirSync(join(upstream, 'agents', 'core'), { recursive: true });
    writeFileSync(
      join(upstream, 'agents', 'core', 'code-archaeologist.md'),
      '---\ndescription: Code archaeologist\ntools: Read, Grep\n---\n\nDig.\n',
    );
    writeFileSync(
      join(upstream, 'agents', 'core', 'documentation-specialist.md'),
      '---\ndescription: Documentation specialist\ntools: Read, Write\n---\n\nDocs.\n',
    );
    writeFileSync(
      join(upstream, 'agents', 'core', 'performance-optimizer.md'),
      '---\ndescription: Performance optimizer\ntools: Read, Grep, Write\n---\n\nSpeed.\n',
    );
    writeFileSync(
      join(project, '.agentsmesh', 'installs.yaml'),
      [
        'version: 1',
        'installs:',
        '  - name: core-agents',
        '    source: ../upstream',
        '    source_kind: local',
        '    features:',
        '      - agents',
        '    pick:',
        '      agents:',
        '        - code-archaeologist',
        '        - performance-optimizer',
        '    target: claude-code',
        '    path: agents/core',
        '    as: agents',
      ].join('\n'),
    );

    await runInstall({ sync: true, force: true }, [], project);

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'core-agents'))).toEqual([
      'agents/code-archaeologist.md',
      'agents/performance-optimizer.md',
      'pack.yaml',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'agents/code-archaeologist.md',
      'agents/performance-optimizer.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'agents',
        features: ['agents'],
        name: 'core-agents',
        path: 'agents/core',
        pick: { agents: ['code-archaeologist', 'performance-optimizer'] },
        source: '../upstream',
        source_kind: 'local',
        target: 'claude-code',
      },
    ]);
  });

  it('replays legacy nested-skill manifests that point at a container skill path', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');
    mkdirSync(join(upstream, 'skills', 'engineering', 'release-manager', 'references'), {
      recursive: true,
    });
    mkdirSync(join(upstream, 'skills', 'engineering', 'quality-gates'), { recursive: true });
    writeFileSync(
      join(upstream, 'skills', 'engineering', 'SKILL.md'),
      '---\ndescription: Engineering umbrella\n---\n',
    );
    writeFileSync(
      join(upstream, 'skills', 'engineering', 'release-manager', 'SKILL.md'),
      '---\ndescription: Release manager\n---\n# Release\n',
    );
    writeFileSync(
      join(upstream, 'skills', 'engineering', 'release-manager', 'references', 'guide.md'),
      '# Guide\n',
    );
    writeFileSync(
      join(upstream, 'skills', 'engineering', 'quality-gates', 'SKILL.md'),
      '---\ndescription: Quality gates\n---\n# Quality\n',
    );
    writeFileSync(
      join(project, '.agentsmesh', 'installs.yaml'),
      [
        'version: 1',
        'installs:',
        '  - name: engineering-pack',
        '    source: ../upstream',
        '    source_kind: local',
        '    features:',
        '      - skills',
        '    pick:',
        '      skills:',
        '        - release-manager',
        '    path: skills/engineering',
        '    as: skills',
      ].join('\n'),
    );

    await runInstall({ sync: true, force: true }, [], project);

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'engineering-pack'))).toEqual([
      'pack.yaml',
      'skills/release-manager/SKILL.md',
      'skills/release-manager/references/guide.md',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/release-manager/SKILL.md',
      'skills/release-manager/references/guide.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'engineering-pack',
        path: 'skills',
        pick: { skills: ['release-manager'] },
        source: '../upstream',
        source_kind: 'local',
      },
    ]);
  });

  it('replays nested descendant skill picks from a skills collection root', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');
    mkdirSync(join(upstream, 'skills', 'engineering', 'release-manager', 'references'), {
      recursive: true,
    });
    mkdirSync(join(upstream, 'skills', 'quality-gates'), { recursive: true });
    writeFileSync(
      join(upstream, 'skills', 'engineering', 'release-manager', 'SKILL.md'),
      '---\ndescription: Release manager\n---\n# Release\n',
    );
    writeFileSync(
      join(upstream, 'skills', 'engineering', 'release-manager', 'references', 'guide.md'),
      '# Guide\n',
    );
    writeFileSync(
      join(upstream, 'skills', 'quality-gates', 'SKILL.md'),
      '---\ndescription: Quality gates\n---\n# Quality\n',
    );
    writeFileSync(
      join(project, '.agentsmesh', 'installs.yaml'),
      [
        'version: 1',
        'installs:',
        '  - name: release-root-pack',
        '    source: ../upstream',
        '    source_kind: local',
        '    features:',
        '      - skills',
        '    pick:',
        '      skills:',
        '        - release-manager',
        '    path: skills',
        '    as: skills',
      ].join('\n'),
    );

    await runInstall({ sync: true, force: true }, [], project);

    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/release-manager/SKILL.md',
      'skills/release-manager/references/guide.md',
    ]);
    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'release-root-pack'))).toEqual([
      'pack.yaml',
      'skills/release-manager/SKILL.md',
      'skills/release-manager/references/guide.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'release-root-pack',
        path: 'skills',
        pick: { skills: ['release-manager'] },
        source: '../upstream',
        source_kind: 'local',
      },
    ]);
  });
});
