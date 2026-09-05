/**
 * One bad row in `installs.yaml` must not wipe the manifest.
 *
 * Reads keep every valid row and warn about the rest; writes carry the
 * rejected rows through verbatim so nothing is dropped silently, and refuse to
 * rewrite a file whose YAML could not be parsed at all.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildInstallManifestEntry,
  readInstallManifest,
  removeInstallManifestEntry,
  upsertInstallManifestEntry,
} from '../../../src/install/core/install-manifest.js';
import { logger } from '../../../src/utils/output/logger.js';

const MIXED_MANIFEST = `version: 1
installs:
  - name: good-pack
    source: github:org/good@v1
    source_kind: github
    features: [rules]
  - name: broken-pack
    source: github:org/broken@v1
    source_kind: svn
    features: [rules]
`;

const UNPARSEABLE = 'version: 1\ninstalls:\n  - name: [unterminated\n';

let canonicalDir = '';
let warnSpy: ReturnType<typeof vi.spyOn>;

function manifestPath(): string {
  return join(canonicalDir, 'installs.yaml');
}

beforeEach(() => {
  canonicalDir = mkdtempSync(join(tmpdir(), 'am-'));
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(canonicalDir, { recursive: true, force: true });
});

describe('readInstallManifest — invalid rows', () => {
  it('keeps the valid row and warns about the invalid one with the zod message', async () => {
    writeFileSync(manifestPath(), MIXED_MANIFEST);

    const installs = await readInstallManifest(canonicalDir);

    expect(installs.map((e) => e.name)).toEqual(['good-pack']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]![0]);
    expect(message).toContain('installs.yaml');
    expect(message).toContain('broken-pack');
    expect(message).toContain('source_kind');
  });

  it('returns [] and warns when the YAML itself cannot be parsed', async () => {
    writeFileSync(manifestPath(), UNPARSEABLE);

    await expect(readInstallManifest(canonicalDir)).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain('installs.yaml');
  });
});

describe('upsertInstallManifestEntry — invalid rows', () => {
  it('preserves the valid row and carries the invalid row through verbatim', async () => {
    writeFileSync(manifestPath(), MIXED_MANIFEST);

    await upsertInstallManifestEntry(
      canonicalDir,
      buildInstallManifestEntry({
        name: 'new-pack',
        source: 'github:org/new@v1',
        sourceKind: 'github',
        features: ['skills'],
      }),
    );

    const written = readFileSync(manifestPath(), 'utf-8');
    expect(written).toContain('name: good-pack');
    expect(written).toContain('name: new-pack');
    expect(written).toContain('name: broken-pack');
    expect(written).toContain('source_kind: svn');
    expect((await readInstallManifest(canonicalDir)).map((e) => e.name)).toEqual([
      'good-pack',
      'new-pack',
    ]);
  });

  it('refuses to rewrite a manifest whose YAML cannot be parsed', async () => {
    writeFileSync(manifestPath(), UNPARSEABLE);

    await expect(
      upsertInstallManifestEntry(
        canonicalDir,
        buildInstallManifestEntry({
          name: 'new-pack',
          source: 'github:org/new@v1',
          sourceKind: 'github',
          features: ['skills'],
        }),
      ),
    ).rejects.toThrow(/installs\.yaml.*could not be parsed/);
    expect(readFileSync(manifestPath(), 'utf-8')).toBe(UNPARSEABLE);
  });
});

describe('removeInstallManifestEntry — invalid rows', () => {
  it('removes the named valid row and keeps the invalid row', async () => {
    writeFileSync(manifestPath(), MIXED_MANIFEST);

    await expect(removeInstallManifestEntry(canonicalDir, 'good-pack')).resolves.toBe(true);

    const written = readFileSync(manifestPath(), 'utf-8');
    expect(written).not.toContain('name: good-pack');
    expect(written).toContain('name: broken-pack');
  });

  it('refuses to rewrite a manifest whose YAML cannot be parsed', async () => {
    writeFileSync(manifestPath(), UNPARSEABLE);

    await expect(removeInstallManifestEntry(canonicalDir, 'anything')).rejects.toThrow(
      /installs\.yaml.*could not be parsed/,
    );
    expect(readFileSync(manifestPath(), 'utf-8')).toBe(UNPARSEABLE);
  });
});
