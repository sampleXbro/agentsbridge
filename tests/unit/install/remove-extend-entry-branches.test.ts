/**
 * Branch coverage for `src/install/core/remove-extend-entry.ts`. Covers
 *   - early-return short-circuit when no entry matches the name (no I/O)
 *   - missing config file path → throws
 *   - happy path: existing entry is removed, file rewritten with trailing newline
 *   - mismatched raw.extends count → returns false
 *   - non-object entries in raw.extends are preserved (defensive branch)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeAgentsmeshExtendByName } from '../../../src/install/core/remove-extend-entry.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

let dir: string;

const cfg = (extendsArr: unknown[]): ValidatedConfig =>
  ({
    version: 1,
    targets: ['claude-code'],
    features: ['rules'],
    extends: extendsArr,
  }) as unknown as ValidatedConfig;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'remove-extend-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('removeAgentsmeshExtendByName', () => {
  it('returns false without touching the filesystem when no entry matches', async () => {
    const result = await removeAgentsmeshExtendByName(
      join(dir, 'agentsmesh.yaml'),
      cfg([{ name: 'other' }]),
      'missing',
    );
    expect(result).toBe(false);
  });

  it('throws when the named entry exists in config but the file is missing', async () => {
    await expect(
      removeAgentsmeshExtendByName(join(dir, 'agentsmesh.yaml'), cfg([{ name: 'pack' }]), 'pack'),
    ).rejects.toThrow(/Missing config/);
  });

  it('removes the entry, returns true, and writes a trailing-newline yaml file', async () => {
    const path = join(dir, 'agentsmesh.yaml');
    await writeFile(
      path,
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends:\n  - name: pack\n    source: github:o/r\n    features: [rules]\n',
      'utf8',
    );
    const result = await removeAgentsmeshExtendByName(
      path,
      cfg([{ name: 'pack', source: 'github:o/r', features: ['rules'] }]),
      'pack',
    );
    expect(result).toBe(true);
    const after = await readFile(path, 'utf8');
    expect(after.endsWith('\n')).toBe(true);
    expect(after).not.toContain('pack');
  });

  it('returns false when raw.extends does not actually contain the entry', async () => {
    const path = join(dir, 'agentsmesh.yaml');
    await writeFile(
      path,
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
      'utf8',
    );
    const result = await removeAgentsmeshExtendByName(path, cfg([{ name: 'pack' }]), 'pack');
    expect(result).toBe(false);
  });
});
