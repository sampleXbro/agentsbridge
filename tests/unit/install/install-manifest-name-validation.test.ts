/**
 * Security: a poisoned `installs.yaml` with a `name` containing path
 * separators or `..` would cause `agentsmesh uninstall <name>` to compute
 * `packDir = join(packsDir, name)` and then `rm -rf` outside `.agentsmesh/`.
 *
 * Strategy: drop malformed entries at parse time so they never reach the
 * uninstall planner. `installManifestSchema` already absorbs parse failures
 * via the surrounding try/catch in `readInstallManifest`, so a malformed
 * entry is filtered without crashing the whole manifest.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  installManifestEntrySchema,
  readInstallManifest,
} from '../../../src/install/core/install-manifest.js';

let canonicalDir = '';

beforeEach(() => {
  canonicalDir = mkdtempSync(join(tmpdir(), 'am-install-manifest-name-'));
});

afterEach(() => {
  rmSync(canonicalDir, { recursive: true, force: true });
});

const REJECTED = ['../escape', 'a/b', 'a\\b', '..', '.', 'NUL\0byte'];
const ACCEPTED = ['valid-name', 'valid_name', '123-pack', 'pack.v2'];

describe('installManifestEntrySchema — name validation', () => {
  for (const bad of REJECTED) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      const result = installManifestEntrySchema.safeParse({
        name: bad,
        source: 'github:org/repo',
        source_kind: 'github',
        features: ['rules'],
      });
      expect(result.success).toBe(false);
    });
  }

  for (const good of ACCEPTED) {
    it(`accepts ${JSON.stringify(good)}`, () => {
      const result = installManifestEntrySchema.safeParse({
        name: good,
        source: 'github:org/repo',
        source_kind: 'github',
        features: ['rules'],
      });
      expect(result.success).toBe(true);
    });
  }
});

describe('readInstallManifest — defense-in-depth', () => {
  it('returns [] when manifest contains a name with path traversal', async () => {
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(
      join(canonicalDir, 'installs.yaml'),
      [
        'version: 1',
        'installs:',
        '  - name: "../../../tmp/victim"',
        '    source: "github:org/repo"',
        '    source_kind: "github"',
        '    features:',
        '      - rules',
        '',
      ].join('\n'),
    );

    // The row fails validation and is skipped with a warning, so
    // readInstallManifest returns []. An attacker cannot weaponize the entry
    // because the uninstall planner never sees it.
    const installs = await readInstallManifest(canonicalDir);
    expect(installs).toEqual([]);
  });
});
