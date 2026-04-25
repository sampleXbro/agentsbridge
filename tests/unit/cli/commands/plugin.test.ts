import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import {
  writePluginEntry,
  removePluginEntry,
  readScopedConfigRaw,
} from '../../../../src/plugins/plugin-config.js';
import { runPlugin } from '../../../../src/cli/commands/plugin.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-plugin-cmd-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeConfig(data: Record<string, unknown>): Promise<void> {
  await writeFile(join(tmpDir, 'agentsmesh.yaml'), stringifyYaml(data));
}

async function readConfig(): Promise<Record<string, unknown>> {
  return readScopedConfigRaw(tmpDir) as Promise<Record<string, unknown>>;
}

describe('writePluginEntry', () => {
  it('appends a plugin entry to agentsmesh.yaml', async () => {
    await writeConfig({ version: 1, targets: [] });
    await writePluginEntry(tmpDir, { id: 'my-plugin', source: 'my-plugin-pkg' });
    const raw = await readConfig();
    expect(raw.plugins).toBeDefined();
    expect(Array.isArray(raw.plugins)).toBe(true);
    const plugins = raw.plugins as Array<{ id: string; source: string }>;
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({ id: 'my-plugin', source: 'my-plugin-pkg' });
  });

  it('dedupes: does not add if same id already exists', async () => {
    await writeConfig({
      version: 1,
      targets: [],
      plugins: [{ id: 'my-plugin', source: 'existing' }],
    });
    await writePluginEntry(tmpDir, { id: 'my-plugin', source: 'new-source' });
    const raw = await readConfig();
    const plugins = raw.plugins as Array<{ id: string; source: string }>;
    expect(plugins).toHaveLength(1);
    expect(plugins[0]!.source).toBe('existing');
  });

  it('creates agentsmesh.yaml if it does not exist', async () => {
    await writePluginEntry(tmpDir, { id: 'test-plugin', source: 'test-pkg' });
    const raw = await readConfig();
    const plugins = raw.plugins as Array<{ id: string }>;
    expect(plugins).toBeDefined();
    expect(plugins[0]!.id).toBe('test-plugin');
  });

  it('includes version when provided', async () => {
    await writePluginEntry(tmpDir, { id: 'v-plugin', source: 'pkg', version: '1.2.3' });
    const raw = await readConfig();
    const plugins = raw.plugins as Array<{ id: string; version?: string }>;
    expect(plugins[0]!.version).toBe('1.2.3');
  });
});

describe('removePluginEntry', () => {
  it('removes the matching plugin entry', async () => {
    await writeConfig({
      version: 1,
      plugins: [
        { id: 'keep-me', source: 'pkg-a' },
        { id: 'remove-me', source: 'pkg-b' },
      ],
    });
    const removed = await removePluginEntry(tmpDir, 'remove-me');
    expect(removed).toBe(true);
    const raw = await readConfig();
    const plugins = raw.plugins as Array<{ id: string }>;
    expect(plugins).toHaveLength(1);
    expect(plugins[0]!.id).toBe('keep-me');
  });

  it('also removes from pluginTargets', async () => {
    await writeConfig({
      version: 1,
      plugins: [{ id: 'target-plugin', source: 'pkg' }],
      pluginTargets: ['target-plugin', 'other-target'],
    });
    await removePluginEntry(tmpDir, 'target-plugin');
    const raw = await readConfig();
    expect(raw.pluginTargets).toEqual(['other-target']);
  });

  it('returns false if id not found', async () => {
    await writeConfig({ version: 1, plugins: [] });
    const removed = await removePluginEntry(tmpDir, 'nonexistent');
    expect(removed).toBe(false);
  });
});

describe('runPlugin', () => {
  it('plugin list does not throw when no plugins configured', async () => {
    await writeConfig({ version: 1, targets: [], plugins: [] });
    // Should succeed
    const code = await runPlugin({}, ['list'], tmpDir);
    expect(code).toBe(0);
  });

  it('plugin info <unknown-id> returns exit code 1', async () => {
    await writeConfig({ version: 1, targets: [], plugins: [] });
    const code = await runPlugin({}, ['info', 'nonexistent-id'], tmpDir);
    expect(code).toBe(1);
  });

  it('plugin remove <unknown-id> returns 0 with a warning', async () => {
    await writeConfig({ version: 1, targets: [], plugins: [] });
    const code = await runPlugin({}, ['remove', 'nonexistent-id'], tmpDir);
    expect(code).toBe(0);
  });

  it('unknown subcommand returns 2', async () => {
    const code = await runPlugin({}, ['unknown-subcommand'], tmpDir);
    expect(code).toBe(2);
  });

  it('no subcommand returns 0', async () => {
    const code = await runPlugin({}, [], tmpDir);
    expect(code).toBe(0);
  });
});
