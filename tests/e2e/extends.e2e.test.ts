import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import * as tar from 'tar';

describe('extends and local overrides', () => {
  let dir = '';
  let cacheDir = '';

  afterEach(() => {
    delete process.env.AGENTSMESH_CACHE;
    if (dir) cleanup(dir);
    if (cacheDir) cleanup(cacheDir);
    dir = '';
    cacheDir = '';
  });

  it('local canonical rules override shared extends', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(dir, 'shared', '.agentsmesh', 'rules'), { recursive: true });

    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends:\n  - name: base\n    source: ./shared\n    features: [rules]\n',
    );
    writeFileSync(
      join(dir, 'shared', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Shared\n',
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Local wins\n',
    );

    const result = await runCli('generate', dir);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('Local wins');
  });

  it('agentsmesh.local.yaml overrides targets for local generation', async () => {
    dir = createTestProject('canonical-full');
    writeFileSync(join(dir, 'agentsmesh.local.yaml'), 'targets: [claude-code]\n');

    const result = await runCli('generate', dir);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('TypeScript strict');
    expect(() => readFileSync(join(dir, '.cursor', 'rules', '_root.mdc'), 'utf-8')).toThrow();
  });

  it('uses cached github extends in e2e flow', async () => {
    dir = createTestProject();
    cacheDir = createTestProject();
    rmSync(cacheDir, { recursive: true, force: true });
    mkdirSync(join(cacheDir, 'org--repo--v1.0.0', 'org-repo-v1.0.0', '.agentsmesh', 'rules'), {
      recursive: true,
    });
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(cacheDir, 'org--repo--v1.0.0', 'org-repo-v1.0.0', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Cached remote\n',
    );
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends:\n  - name: remote-base\n    source: github:org/repo@v1.0.0\n    features: [rules]\n',
    );
    process.env.AGENTSMESH_CACHE = cacheDir;

    const result = await runCli('generate', dir);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('Cached remote');
    expect(readFileSync(join(dir, '.agentsmesh', '.lock'), 'utf-8')).toContain('remote-base');
  });

  // Uses NODE_OPTIONS=--import=<file> to mock `fetch`. Windows path quoting
  // for NODE_OPTIONS doesn't pass the preload path cleanly, so the mock never
  // runs and the install hits real github.com — which CI runners block.
  // The behavior under test is platform-independent; skip on Windows.
  it.skipIf(process.platform === 'win32')(
    'refreshes cached github extends when --refresh-cache is used',
    async () => {
      dir = createTestProject();
      cacheDir = createTestProject();
      rmSync(cacheDir, { recursive: true, force: true });

      mkdirSync(join(cacheDir, 'org--repo--v1.0.0', 'org-repo-v1.0.0', '.agentsmesh', 'rules'), {
        recursive: true,
      });
      writeFileSync(
        join(cacheDir, 'org--repo--v1.0.0', 'org-repo-v1.0.0', '.agentsmesh', 'rules', '_root.md'),
        '---\nroot: true\n---\n# Stale remote\n',
      );

      const remoteSrc = join(dir, 'remote-src');
      mkdirSync(join(remoteSrc, 'org-repo-v1.0.0', '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(remoteSrc, 'org-repo-v1.0.0', '.agentsmesh', 'rules', '_root.md'),
        '---\nroot: true\n---\n# Refreshed remote\n',
      );
      const tarball = join(dir, 'remote.tar.gz');
      await tar.c({ file: tarball, gzip: true, cwd: remoteSrc }, ['org-repo-v1.0.0']);

      const preloadPath = join(dir, 'mock-fetch.mjs');
      writeFileSync(
        preloadPath,
        `import { readFile } from 'node:fs/promises';

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes('github.com/org/repo/tarball/v1.0.0')) {
    const bytes = await readFile(process.env.AB_TEST_TARBALL);
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => ab,
    };
  }
  return originalFetch(input, init);
};
`,
      );

      mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(dir, 'agentsmesh.yaml'),
        'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends:\n  - name: remote-base\n    source: github:org/repo@v1.0.0\n    features: [rules]\n',
      );

      const result = await runCli('generate --refresh-cache', dir, {
        AGENTSMESH_CACHE: cacheDir,
        AB_TEST_TARBALL: tarball,
        NODE_OPTIONS: `--import=${preloadPath}`,
      });

      expect(result.exitCode).toBe(0);
      expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
        'Refreshed remote',
      );
      expect(
        readFileSync(
          join(
            cacheDir,
            'org--repo--v1.0.0',
            'org-repo-v1.0.0',
            '.agentsmesh',
            'rules',
            '_root.md',
          ),
          'utf-8',
        ),
      ).toContain('Refreshed remote');
    },
  );
});
