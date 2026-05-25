/**
 * Branch coverage for `writeInstallAsExtend` / `toNewExtendEntry` in
 * `src/install/core/install-extend-entry.ts`. Covers:
 *   - dry-run skip branch (no agentsmesh.yaml write, logs preview)
 *   - happy path: writes agentsmesh.yaml with the new entry
 *   - name-collision (same name + different source) → throws via
 *     `assertExtendNameAvailable`
 *   - `toNewExtendEntry` yamlTarget parsing branch and omission branch
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  toNewExtendEntry,
  writeInstallAsExtend,
} from '../../../src/install/core/install-extend-entry.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';
import { logger } from '../../../src/utils/output/logger.js';

let configDir: string;

const baseConfig = (): ValidatedConfig =>
  ({
    version: 1,
    targets: ['claude-code'],
    features: ['rules'],
    extends: [],
  }) as unknown as ValidatedConfig;

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), 'install-extend-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(configDir, { recursive: true, force: true });
});

describe('toNewExtendEntry', () => {
  it('parses yamlTarget into a validated target schema value', () => {
    const entry = toNewExtendEntry({
      name: 'pack',
      source: 'github:o/r@abc',
      features: ['rules'],
      yamlTarget: 'claude-code',
    });
    expect(entry.target).toBe('claude-code');
  });

  it('leaves target undefined when yamlTarget is omitted', () => {
    const entry = toNewExtendEntry({
      name: 'pack',
      source: 'github:o/r@abc',
      features: ['rules'],
    });
    expect(entry.target).toBeUndefined();
  });
});

describe('writeInstallAsExtend', () => {
  it('does not write agentsmesh.yaml on dry-run and logs a preview', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await writeInstallAsExtend({
      configDir,
      config: baseConfig(),
      entryArgs: {
        name: 'pack',
        source: 'github:o/r@abc',
        features: ['rules'],
      },
      dryRun: true,
    });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringMatching(/dry-run.*Would add extend/));
    await expect(readFile(join(configDir, 'agentsmesh.yaml'), 'utf8')).rejects.toThrow();
  });

  it('throws when an extend with the same name already points at a different source', async () => {
    const cfg = baseConfig();
    cfg.extends = [
      { name: 'pack', source: 'github:o/other@def', features: ['rules'] },
    ] as unknown as ValidatedConfig['extends'];

    await expect(
      writeInstallAsExtend({
        configDir,
        config: cfg,
        entryArgs: { name: 'pack', source: 'github:o/r@abc', features: ['rules'] },
        dryRun: false,
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('writes the new entry into agentsmesh.yaml on the happy path', async () => {
    await writeFile(
      join(configDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
      'utf8',
    );
    const successSpy = vi.spyOn(logger, 'success').mockImplementation(() => undefined);

    await writeInstallAsExtend({
      configDir,
      config: baseConfig(),
      entryArgs: { name: 'pack', source: 'github:o/r@abc', features: ['rules'] },
      dryRun: false,
    });

    const yaml = await readFile(join(configDir, 'agentsmesh.yaml'), 'utf8');
    expect(yaml).toContain('name: pack');
    expect(yaml).toContain('source: github:o/r@abc');
    expect(successSpy).toHaveBeenCalledWith(expect.stringMatching(/Wrote extends entry "pack"/));
  });
});
