import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { NewExtendEntry } from '../../../../src/install/core/merge-extend-entry.js';
import { writeAgentsmeshWithNewExtend } from '../../../../src/install/core/yaml-writer.js';

vi.mock('yaml', async (importOriginal) => {
  const real = await importOriginal<typeof import('yaml')>();
  return { ...real, stringify: vi.fn(real.stringify) };
});

const ENTRY: NewExtendEntry = {
  name: 'pack-a',
  source: 'github:org/repo@abc',
  version: 'abc',
  features: ['skills'],
};

function config(extendsList: ValidatedConfig['extends'] = []): ValidatedConfig {
  return {
    version: 1,
    targets: ['claude-code'],
    features: ['rules'],
    extends: extendsList,
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    plugins: [],
    pluginTargets: [],
  };
}

let dir: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'am-'));
  configPath = join(dir, 'agentsmesh.yaml');
  vi.mocked(stringify).mockClear();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeAgentsmeshWithNewExtend', () => {
  it('rejects when the config file is missing', async () => {
    await expect(writeAgentsmeshWithNewExtend(configPath, config(), ENTRY)).rejects.toThrow(
      /Missing config/,
    );
  });

  it('appends the new extends entry, keeps other keys and ends with a newline', async () => {
    await writeFile(configPath, 'version: 1\ntargets: [claude-code]\n', 'utf-8');

    await writeAgentsmeshWithNewExtend(configPath, config(), ENTRY);

    const out = await readFile(configPath, 'utf-8');
    expect(out.endsWith('\n')).toBe(true);
    expect(parseYaml(out)).toEqual({
      version: 1,
      targets: ['claude-code'],
      extends: [
        { name: 'pack-a', source: 'github:org/repo@abc', version: 'abc', features: ['skills'] },
      ],
    });
  });

  it('merges features into an existing entry with the same source', async () => {
    const existing: ValidatedConfig['extends'] = [
      { name: 'pack-a', source: 'github:org/repo@abc', version: 'abc', features: ['rules'] },
    ];
    await writeFile(configPath, stringify({ version: 1, extends: existing }), 'utf-8');

    await writeAgentsmeshWithNewExtend(configPath, config(existing), ENTRY);

    const parsed = parseYaml(await readFile(configPath, 'utf-8')) as { extends: unknown[] };
    expect(parsed.extends).toEqual([
      {
        name: 'pack-a',
        source: 'github:org/repo@abc',
        version: 'abc',
        features: ['rules', 'skills'],
      },
    ]);
  });

  it('pads a trailing newline when the YAML serializer omits one', async () => {
    await writeFile(configPath, 'version: 1\n', 'utf-8');
    const real = await vi.importActual<typeof import('yaml')>('yaml');
    vi.mocked(stringify).mockImplementationOnce((value) =>
      real.stringify(value).replace(/\n$/, ''),
    );

    await writeAgentsmeshWithNewExtend(configPath, config(), ENTRY);

    const out = await readFile(configPath, 'utf-8');
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
    expect(parseYaml(out)).toEqual({ version: 1, extends: [{ ...ENTRY }] });
  });
});
