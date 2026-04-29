import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  readScopedConfigRaw,
  removePluginEntry,
  writePluginEntry,
} from '../../../src/plugins/plugin-config.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-plugin-cfg-'));
});

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = '';
});

describe('readScopedConfigRaw', () => {
  it('returns empty object when agentsmesh.yaml is missing', async () => {
    const raw = await readScopedConfigRaw(projectRoot);
    expect(raw).toEqual({});
  });

  it('returns parsed config when present', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\nplugins:\n  - id: foo\n    source: ./foo\n',
    );
    const raw = await readScopedConfigRaw(projectRoot);
    expect(raw.plugins).toEqual([{ id: 'foo', source: './foo' }]);
  });

  it('returns empty object when YAML parses to null', async () => {
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), '');
    const raw = await readScopedConfigRaw(projectRoot);
    expect(raw).toEqual({});
  });
});

describe('writePluginEntry', () => {
  it('creates agentsmesh.yaml when missing', async () => {
    await writePluginEntry(projectRoot, { id: 'p1', source: './p1' });
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string; source: string }[];
    };
    expect(raw.plugins).toEqual([{ id: 'p1', source: './p1' }]);
  });

  it('appends to existing plugins array', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\nplugins:\n  - id: existing\n    source: ./existing\n',
    );
    await writePluginEntry(projectRoot, { id: 'new', source: './new' });
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string; source: string }[];
    };
    expect(raw.plugins.map((p) => p.id)).toEqual(['existing', 'new']);
  });

  it('dedupes entries by id (no-op when id already present)', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\nplugins:\n  - id: dup\n    source: ./old\n',
    );
    await writePluginEntry(projectRoot, { id: 'dup', source: './new' });
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string; source: string }[];
    };
    expect(raw.plugins).toEqual([{ id: 'dup', source: './old' }]);
  });

  it('persists optional version when provided', async () => {
    await writePluginEntry(projectRoot, { id: 'v', source: './v', version: '1.2.3' });
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string; source: string; version?: string }[];
    };
    expect(raw.plugins[0]).toEqual({ id: 'v', source: './v', version: '1.2.3' });
  });

  it('omits version when undefined', async () => {
    await writePluginEntry(projectRoot, { id: 'nv', source: './nv' });
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string; source: string; version?: string }[];
    };
    expect(raw.plugins[0]).toEqual({ id: 'nv', source: './nv' });
    expect(raw.plugins[0]).not.toHaveProperty('version');
  });

  it('initializes plugins array when raw config has no plugins key', async () => {
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\n');
    await writePluginEntry(projectRoot, { id: 'init', source: './init' });
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string; source: string }[];
    };
    expect(raw.plugins).toEqual([{ id: 'init', source: './init' }]);
  });
});

describe('removePluginEntry', () => {
  it('returns false when agentsmesh.yaml is missing', async () => {
    const removed = await removePluginEntry(projectRoot, 'foo');
    expect(removed).toBe(false);
  });

  it('returns false when id is not present', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\nplugins:\n  - id: keep\n    source: ./keep\n',
    );
    const removed = await removePluginEntry(projectRoot, 'absent');
    expect(removed).toBe(false);
  });

  it('removes entry by id and returns true', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\nplugins:\n  - id: a\n    source: ./a\n  - id: b\n    source: ./b\n',
    );
    const removed = await removePluginEntry(projectRoot, 'a');
    expect(removed).toBe(true);
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string }[];
    };
    expect(raw.plugins.map((p) => p.id)).toEqual(['b']);
  });

  it('also removes id from pluginTargets when present', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      [
        'version: 1',
        'plugins:',
        '  - id: x',
        '    source: ./x',
        'pluginTargets:',
        '  - x',
        '  - y',
        '',
      ].join('\n'),
    );
    const removed = await removePluginEntry(projectRoot, 'x');
    expect(removed).toBe(true);
    const raw = parseYaml(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf8')) as {
      plugins: { id: string }[];
      pluginTargets: string[];
    };
    expect(raw.plugins).toEqual([]);
    expect(raw.pluginTargets).toEqual(['y']);
  });

  it('handles missing plugins array gracefully (returns false)', async () => {
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\n');
    const removed = await removePluginEntry(projectRoot, 'anything');
    expect(removed).toBe(false);
  });
});
