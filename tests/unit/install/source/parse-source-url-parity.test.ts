/**
 * Strict parity test: parseSourceUrl (refresh planner) vs parseInstallSource
 * (install pipeline). For every source format that install supports, both
 * parsers must agree on remoteUrl + ref extraction. A divergence here means
 * refresh fetches the wrong upstream.
 *
 * Comparison key: parseInstallSource returns rawRef + gitRemoteUrl;
 * parseSourceUrl returns ref + remoteUrl. We assert them equal per format.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { afterAll, beforeAll } from 'vitest';
import { parseSourceUrl } from '../../../../src/install/source/parse-source-url.js';
import { parseInstallSource } from '../../../../src/install/source/parse-install-source.js';

// A temporary dir is needed for parseInstallSource (it resolves local paths
// against configDir). We never feed local paths to the comparison helper, but
// a real directory is required for the function signature.
let configDir: string;
beforeAll(async () => {
  configDir = await mkdtemp(join(tmpdir(), 'parity-test-'));
  await mkdir(configDir, { recursive: true });
});
afterAll(async () => {
  await rm(configDir, { recursive: true, force: true });
});

/**
 * For remote sources: compare remoteUrl + ref across both parsers.
 * parseInstallSource uses gitRemoteUrl + rawRef; parseSourceUrl uses remoteUrl + ref.
 */
async function assertParity(
  input: string,
  expectedRemoteUrl: string,
  expectedRef: string,
): Promise<void> {
  const fromNew = parseSourceUrl(input);
  const fromOld = await parseInstallSource(input, configDir);

  // New parser
  expect(fromNew, `parseSourceUrl returned null for: ${input}`).not.toBeNull();
  expect(fromNew!.remoteUrl, `parseSourceUrl remoteUrl mismatch for: ${input}`).toBe(
    expectedRemoteUrl,
  );
  expect(fromNew!.ref, `parseSourceUrl ref mismatch for: ${input}`).toBe(expectedRef);

  // Old parser
  expect(fromOld.kind, `parseInstallSource kind mismatch for: ${input}`).not.toBe('local');
  expect(
    (fromOld as { gitRemoteUrl?: string }).gitRemoteUrl,
    `parseInstallSource remoteUrl mismatch for: ${input}`,
  ).toBe(expectedRemoteUrl);
  expect(
    (fromOld as { rawRef?: string }).rawRef,
    `parseInstallSource rawRef mismatch for: ${input}`,
  ).toBe(expectedRef);
}

describe('parse-source-url parity: parseSourceUrl vs parseInstallSource', () => {
  // ── github: shorthand ──────────────────────────────────────────────────────

  it('github:org/repo (bare) → HEAD', async () => {
    await assertParity('github:org/repo', 'https://github.com/org/repo.git', 'HEAD');
  });

  it('github:org/repo@<sha40> → exact SHA', async () => {
    const sha = 'a'.repeat(40);
    await assertParity(`github:org/repo@${sha}`, 'https://github.com/org/repo.git', sha);
  });

  it('github:org/repo@main (branch) → main', async () => {
    await assertParity('github:org/repo@main', 'https://github.com/org/repo.git', 'main');
  });

  it('github:org/repo@v1.2.3 (tag) → v1.2.3', async () => {
    await assertParity('github:org/repo@v1.2.3', 'https://github.com/org/repo.git', 'v1.2.3');
  });

  // ── gitlab: shorthand ─────────────────────────────────────────────────────

  it('gitlab:ns/repo (bare) → HEAD', async () => {
    await assertParity('gitlab:ns/repo', 'https://gitlab.com/ns/repo.git', 'HEAD');
  });

  it('gitlab:ns/repo@<ref> → exact ref', async () => {
    await assertParity('gitlab:ns/repo@develop', 'https://gitlab.com/ns/repo.git', 'develop');
  });

  // ── git+ prefix ───────────────────────────────────────────────────────────

  it('git+https://example.com/foo.git (no ref) → HEAD', async () => {
    await assertParity('git+https://example.com/foo.git', 'https://example.com/foo.git', 'HEAD');
  });

  it('git+https://example.com/foo.git#<ref> → ref', async () => {
    await assertParity(
      'git+https://example.com/foo.git#mybranch',
      'https://example.com/foo.git',
      'mybranch',
    );
  });

  it('git+ssh://git@example.com/org/repo.git → HEAD', async () => {
    await assertParity(
      'git+ssh://git@example.com/org/repo.git',
      'ssh://git@example.com/org/repo.git',
      'HEAD',
    );
  });

  // ── HTTPS GitHub URLs ─────────────────────────────────────────────────────

  it('https://github.com/org/repo → HEAD', async () => {
    await assertParity('https://github.com/org/repo', 'https://github.com/org/repo.git', 'HEAD');
  });

  it('https://github.com/org/repo.git → HEAD', async () => {
    await assertParity(
      'https://github.com/org/repo.git',
      'https://github.com/org/repo.git',
      'HEAD',
    );
  });

  it('https://github.com/org/repo/tree/<branch> → branch ref', async () => {
    await assertParity(
      'https://github.com/org/repo/tree/main/src',
      'https://github.com/org/repo.git',
      'main',
    );
  });

  it('https://github.com/org/repo/blob/<branch>/<path> → branch ref', async () => {
    await assertParity(
      'https://github.com/org/repo/blob/main/skills/foo.md',
      'https://github.com/org/repo.git',
      'main',
    );
  });

  // ── SCP-style SSH ─────────────────────────────────────────────────────────

  it('git@github.com:org/repo.git → HEAD', async () => {
    await assertParity('git@github.com:org/repo.git', 'https://github.com/org/repo.git', 'HEAD');
  });

  // ── local: prefix — parsers intentionally diverge; verify parseSourceUrl ──
  // parseInstallSource resolves local: as a filesystem path (configDir-relative).
  // parseSourceUrl returns {kind:'local'} with no remoteUrl. These are NOT
  // required to be equivalent — refresh's createDefaultResolveRef short-circuits
  // on source_kind === 'local' before calling parseSourceUrl.

  it('parseSourceUrl returns kind=local for local: prefix (no remoteUrl/ref)', () => {
    const result = parseSourceUrl('local:./relative');
    expect(result).toEqual({ kind: 'local' });
  });

  // ── file:/// — neither parser supports it ─────────────────────────────────

  it('parseSourceUrl returns null for file:/// (unsupported format)', () => {
    expect(parseSourceUrl('file:///absolute/path')).toBeNull();
  });
});
