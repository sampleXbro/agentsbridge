import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hasLockConflict, resolveLockConflict } from '../../../src/core/merger.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-merger-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('hasLockConflict', () => {
  it('returns true when lock contains conflict markers', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(
      join(abDir, '.lock'),
      `<<<<<<< HEAD
checksums:
  rules/_root.md: "sha256:aaa"
=======
checksums:
  rules/_root.md: "sha256:bbb"
>>>>>>> branch
`,
    );
    expect(await hasLockConflict(abDir)).toBe(true);
  });

  it('returns false when lock has no conflict markers', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(
      join(abDir, '.lock'),
      `generated_at: "2026-03-12T14:30:00Z"
checksums:
  rules/_root.md: "sha256:abc"
`,
    );
    expect(await hasLockConflict(abDir)).toBe(false);
  });

  it('returns false when lock does not exist', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    expect(await hasLockConflict(abDir)).toBe(false);
  });
});

describe('resolveLockConflict', () => {
  it('rebuilds lock from current canonical files', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# Rules\nUse TypeScript');
    writeFileSync(
      join(abDir, '.lock'),
      `<<<<<<< HEAD
checksums:
  rules/_root.md: "sha256:old"
=======
checksums:
  rules/_root.md: "sha256:other"
>>>>>>> branch
`,
    );

    await resolveLockConflict(abDir, '0.1.0');

    const { readLock } = await import('../../../src/config/lock.js');
    const lock = await readLock(abDir);
    expect(lock).not.toBeNull();
    expect(lock!.checksums['rules/_root.md']).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(lock!.libVersion).toBe('0.1.0');
    expect(lock!.generatedAt).toBeDefined();
  });

  it('throws when lock has no conflict', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(join(abDir, '.lock'), 'checksums:\n  rules/_root.md: "sha256:abc"');

    await expect(resolveLockConflict(abDir, '0.1.0')).rejects.toThrow(/no conflict/i);
  });

  it('throws when lock does not exist', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });

    await expect(resolveLockConflict(abDir, '0.1.0')).rejects.toThrow(/no conflict/i);
  });

  it('includes extend checksums when config has extends', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    const baseDir = join(TEST_DIR, 'base-config');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# Rules');
    writeFileSync(join(baseDir, '.agentsmesh', 'rules', '_root.md'), '# Base');
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ./base-config
    features: [rules]
`,
    );
    writeFileSync(
      join(abDir, '.lock'),
      `<<<<<<< HEAD
checksums:
  rules/_root.md: "sha256:old"
=======
checksums:
  rules/_root.md: "sha256:other"
>>>>>>> branch
`,
    );

    const config = await import('../../../src/config/loader.js').then((m) =>
      m.loadConfigFromDir(TEST_DIR).then((r) => r.config),
    );
    await resolveLockConflict(abDir, '0.1.0', config);

    const { readLock } = await import('../../../src/config/lock.js');
    const lock = await readLock(abDir);
    expect(lock).not.toBeNull();
    expect(lock!.extends).toBeDefined();
    expect(Object.keys(lock!.extends).length).toBeGreaterThan(0);
  });
});
