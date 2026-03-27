import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from './helpers/run-cli.js';
import { listRelativeFiles } from './helpers/project-state.js';
import { readYaml } from './helpers/assertions.js';
import { createGithubRemoteStub } from './helpers/remote-install.js';

function makeRoot(prefix: string): string {
  return join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function writeProject(root: string): string {
  const project = join(root, 'project');
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
  return project;
}

describe('install remote github replay e2e', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  it('replays a narrowed GitHub tree URL without broadening to the whole repo', async () => {
    root = makeRoot('am-e2e-install-tree');
    const env = await createGithubRemoteStub(root);
    const project = writeProject(root);
    const url = 'https://github.com/example/demo/tree/main/skills/shared/alpha';

    const installResult = await runCli(`install ${url} --force --as skills`, project, env);
    expect(installResult.exitCode, installResult.stderr).toBe(0);

    expect(readYaml(join(project, '.agentsmesh', 'installs.yaml'))).toEqual({
      version: 1,
      installs: [
        {
          as: 'skills',
          features: ['skills'],
          name: 'example-demo-skills',
          path: 'skills/shared',
          pick: { skills: ['alpha'] },
          source: `github:example/demo@${env.AM_GITHUB_SHA}`,
          source_kind: 'github',
          version: env.AM_GITHUB_SHA,
        },
      ],
    });

    rmSync(join(project, '.agentsmesh', 'packs'), { recursive: true, force: true });
    rmSync(join(project, '.claude', 'skills'), { recursive: true, force: true });
    expect((await runCli('install --sync --force', project, env)).exitCode).toBe(0);
    expect(listRelativeFiles(join(project, '.claude', 'skills'))).toEqual(['alpha/SKILL.md']);
  });

  it('replays a narrowed GitHub blob URL without broadening to sibling skills', async () => {
    root = makeRoot('am-e2e-install-blob');
    const env = await createGithubRemoteStub(root);
    const project = writeProject(root);
    const url = 'https://github.com/example/demo/blob/main/skills/shared/beta/SKILL.md';

    const installResult = await runCli(`install ${url} --force --as skills`, project, env);
    expect(installResult.exitCode, installResult.stderr).toBe(0);

    expect(readYaml(join(project, '.agentsmesh', 'installs.yaml'))).toEqual({
      version: 1,
      installs: [
        {
          as: 'skills',
          features: ['skills'],
          name: 'example-demo-skills',
          path: 'skills/shared',
          pick: { skills: ['beta'] },
          source: `github:example/demo@${env.AM_GITHUB_SHA}`,
          source_kind: 'github',
          version: env.AM_GITHUB_SHA,
        },
      ],
    });

    rmSync(join(project, '.agentsmesh', 'packs'), { recursive: true, force: true });
    rmSync(join(project, '.claude', 'skills'), { recursive: true, force: true });
    expect((await runCli('install --sync --force', project, env)).exitCode).toBe(0);
    expect(listRelativeFiles(join(project, '.claude', 'skills'))).toEqual(['beta/SKILL.md']);
  });
});
