/**
 * Unit tests for agentsmesh merge command.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runMerge } from '../../../../src/cli/commands/merge.js';
import { readLock } from '../../../../src/config/lock.js';

const TEST_DIR = join(tmpdir(), 'ab-merge-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

function setupProject(): void {
  writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Rules',
  );
}

describe('runMerge', () => {
  it('resolves lock conflict when .lock has conflict markers', async () => {
    setupProject();
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `<<<<<<< HEAD
checksums:
  rules/_root.md: "sha256:aaa"
=======
checksums:
  rules/_root.md: "sha256:bbb"
>>>>>>> branch
`,
    );

    await runMerge({}, TEST_DIR);

    const abDir = join(TEST_DIR, '.agentsmesh');
    const lock = await readLock(abDir);
    expect(lock).not.toBeNull();
    expect(lock!.checksums['rules/_root.md']).toBeDefined();
    expect(lock!.checksums['rules/_root.md']).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('does not modify lock when no conflict markers', async () => {
    setupProject();
    const originalContent = 'checksums:\n  rules/_root.md: "sha256:abc"\nextends: {}';
    writeFileSync(join(TEST_DIR, '.agentsmesh', '.lock'), originalContent);

    await runMerge({}, TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', '.lock'), 'utf-8');
    expect(content).toContain('sha256:abc');
  });

  it('runMerge handles conflict when agentsmesh.yaml has no extends', async () => {
    setupProject();
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `<<<<<<< HEAD\nchecksums:\n  rules/_root.md: "sha256:aaa"\n=======\nchecksums:\n  rules/_root.md: "sha256:bbb"\n>>>>>>> branch\n`,
    );
    const config = readFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'utf-8');
    expect(config).toContain('version: 1');
    await runMerge({}, TEST_DIR);
    const lock = await readLock(join(TEST_DIR, '.agentsmesh'));
    expect(lock).not.toBeNull();
  });

  it('throws when not in agentsmesh project', async () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });

    await expect(runMerge({}, TEST_DIR)).rejects.toThrow(/no agentsmesh\.yaml found/i);
  });
});
