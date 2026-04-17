import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { listRelativeFiles, readInstallManifest } from '../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'am-install-global-integration');

describe('install --global (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'home', '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(ROOT, 'upstream', '.agentsmesh', 'skills', 'demo'), { recursive: true });
    mkdirSync(join(ROOT, 'workspace'), { recursive: true });
    vi.stubEnv('HOME', join(ROOT, 'home'));
    vi.stubEnv('USERPROFILE', join(ROOT, 'home'));

    writeFileSync(
      join(ROOT, 'home', '.agentsmesh', 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
    );
    writeFileSync(
      join(ROOT, 'home', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Home Root\n',
    );
    writeFileSync(
      join(ROOT, 'upstream', '.agentsmesh', 'skills', 'demo', 'SKILL.md'),
      '---\ndescription: Demo skill\n---\n# Demo\n',
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('installs packs and generated outputs under the home canonical root', async () => {
    const home = join(ROOT, 'home');
    const workspace = join(ROOT, 'workspace');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ global: true, force: true, name: 'shared-pack' }, [upstream], workspace);

    expect(listRelativeFiles(join(home, '.agentsmesh', 'packs', 'shared-pack'))).toEqual([
      'pack.yaml',
      'skills/demo/SKILL.md',
    ]);
    expect(readInstallManifest(join(home, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        features: ['skills'],
        name: 'shared-pack',
        source: '../../upstream',
        source_kind: 'local',
      },
    ]);
    expect(listRelativeFiles(join(home, '.claude'))).toEqual(['CLAUDE.md', 'skills/demo/SKILL.md']);
    expect(readFileSync(join(home, '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8')).toContain(
      '# Demo',
    );
  });

  it('replays missing home packs from ~/.agentsmesh/installs.yaml', async () => {
    const home = join(ROOT, 'home');
    const workspace = join(ROOT, 'workspace');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ global: true, force: true, name: 'shared-pack' }, [upstream], workspace);
    rmSync(join(home, '.agentsmesh', 'packs'), { recursive: true, force: true });

    await runInstall({ global: true, sync: true, force: true }, [], workspace);

    expect(listRelativeFiles(join(home, '.agentsmesh', 'packs', 'shared-pack'))).toEqual([
      'pack.yaml',
      'skills/demo/SKILL.md',
    ]);
    expect(readFileSync(join(home, '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8')).toContain(
      '# Demo',
    );
  });
});
