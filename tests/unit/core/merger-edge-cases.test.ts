/**
 * Senior-QA edge cases for `resolveLockConflict` that the existing
 * `merger.test.ts` does not cover. These pin behaviors that matter when
 * users actually hit `git merge` conflicts in `.agentsmesh/.lock`:
 *
 *  - lock metadata (generatedAt/libVersion) is rebuilt from current state,
 *    not preserved from the conflicted blob
 *  - canonical files are NOT mutated during merge resolution
 *  - pack checksums are populated from each pack pack.yaml
 *  - merge across many canonical files produces every checksum
 *  - re-running merge after a successful resolution is a no-op (no conflict)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hasLockConflict, resolveLockConflict } from '../../../src/core/merger.js';
import { readLock, buildChecksums } from '../../../src/config/core/lock.js';

const TEST_DIR = join(tmpdir(), 'am-merger-edge-' + String(process.pid));

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

const CONFLICTED_LOCK = [
  '<' + '<<<<<< HEAD',
  'generated_at: "2020-01-01T00:00:00Z"',
  'generated_by: "alice"',
  'lib_version: "0.0.1-old"',
  'checksums:',
  '  rules/_root.md: "sha256:aaa111"',
  'extends: {}',
  'packs: {}',
  '=' + '======',
  'generated_at: "2024-01-01T00:00:00Z"',
  'generated_by: "bob"',
  'lib_version: "0.0.1-other"',
  'checksums:',
  '  rules/_root.md: "sha256:bbb222"',
  'extends: {}',
  'packs: {}',
  '>' + '>>>>>> branch',
  '',
].join('\n');

describe('resolveLockConflict — metadata semantics', () => {
  it('rebuilds libVersion from the caller, not from the conflicted blob', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# Resolved');
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    await resolveLockConflict(abDir, '9.9.9');

    const lock = await readLock(abDir);
    expect(lock!.libVersion).toBe('9.9.9');
    expect(lock!.libVersion).not.toBe('0.0.1-old');
    expect(lock!.libVersion).not.toBe('0.0.1-other');
  });

  it('rebuilds generatedAt to a fresh ISO timestamp (not either side of the conflict)', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# Resolved');
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    const before = Date.now();
    await resolveLockConflict(abDir, '0.1.0');
    const lock = await readLock(abDir);
    const ts = Date.parse(lock!.generatedAt);
    expect(Number.isFinite(ts)).toBe(true);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now() + 1_000);
    expect(lock!.generatedAt).not.toBe('2020-01-01T00:00:00Z');
    expect(lock!.generatedAt).not.toBe('2024-01-01T00:00:00Z');
  });

  it('does not mutate canonical files during merge resolution', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    const body = '# untouched\n- one\n- two';
    writeFileSync(join(abDir, 'rules', '_root.md'), body);
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    await resolveLockConflict(abDir, '0.1.0');

    expect(readFileSync(join(abDir, 'rules', '_root.md'), 'utf-8')).toBe(body);
  });
});

describe('resolveLockConflict — checksum coverage', () => {
  it('emits a checksum for every canonical file across rules/commands/agents/skills/settings', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    mkdirSync(join(abDir, 'commands'), { recursive: true });
    mkdirSync(join(abDir, 'agents'), { recursive: true });
    mkdirSync(join(abDir, 'skills', 'demo'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), 'r');
    writeFileSync(join(abDir, 'commands', 'review.md'), 'c');
    writeFileSync(join(abDir, 'agents', 'foo.md'), 'a');
    writeFileSync(join(abDir, 'skills', 'demo', 'SKILL.md'), 's');
    writeFileSync(join(abDir, 'mcp.json'), '{}');
    writeFileSync(join(abDir, 'permissions.yaml'), 'allow: []');
    writeFileSync(join(abDir, 'hooks.yaml'), '{}');
    writeFileSync(join(abDir, 'ignore'), 'dist');
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    await resolveLockConflict(abDir, '0.1.0');
    const lock = await readLock(abDir);

    const expected = await buildChecksums(abDir);
    expect(Object.keys(lock!.checksums).sort()).toEqual(Object.keys(expected).sort());
    for (const path of Object.keys(expected)) {
      expect(lock!.checksums[path]).toBe(expected[path]);
    }
  });

  it('populates pack checksums from packs/*/pack.yaml', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# r');
    const packDir = join(abDir, 'packs', 'team-base');
    mkdirSync(packDir, { recursive: true });
    writeFileSync(
      join(packDir, 'pack.yaml'),
      [
        'name: team-base',
        'source: github:org/team-base@sha-abcdef',
        'source_kind: github',
        'installed_at: "2026-04-01T00:00:00Z"',
        'updated_at: "2026-04-01T00:00:00Z"',
        'content_hash: sha256:packhashvalue',
        'features:',
        '  - rules',
      ].join('\n'),
    );
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    await resolveLockConflict(abDir, '0.1.0');

    const lock = await readLock(abDir);
    expect(lock!.packs['team-base']).toBe('sha256:packhashvalue');
  });

  it('packs field defaults to {} when no packs directory exists', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# r');
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    await resolveLockConflict(abDir, '0.1.0');

    const lock = await readLock(abDir);
    expect(lock!.packs).toEqual({});
  });
});

describe('resolveLockConflict — repeat semantics', () => {
  it('after a successful resolve, hasLockConflict returns false', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# r');
    writeFileSync(join(abDir, '.lock'), CONFLICTED_LOCK);

    await resolveLockConflict(abDir, '0.1.0');
    expect(await hasLockConflict(abDir)).toBe(false);
    // A second resolve must throw — there is no conflict anymore.
    await expect(resolveLockConflict(abDir, '0.1.0')).rejects.toThrow(/no conflict/i);
  });
});
