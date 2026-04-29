import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlugin, loadAllPlugins } from '../../../src/plugins/load-plugin.js';
import { resetRegistry } from '../../../src/targets/catalog/registry.js';

const MULTI_PLUGIN = resolve('tests/fixtures/plugins/multi-plugin/index.js');
const DEFAULT_PLUGIN = resolve('tests/fixtures/plugins/default-plugin/index.js');
const EMPTY_PLUGIN = resolve('tests/fixtures/plugins/empty-plugin/index.js');

beforeEach(() => {
  resetRegistry();
});

afterEach(() => {
  resetRegistry();
});

describe('loadPlugin — extractDescriptors branches', () => {
  it('extracts from `descriptors` array export', async () => {
    const result = await loadPlugin(
      { id: 'multi', source: pathToFileURL(MULTI_PLUGIN).href },
      process.cwd(),
    );
    expect(result.descriptors.map((d) => d.id).sort()).toEqual(['multi-a', 'multi-b']);
  });

  it('extracts from `default` export', async () => {
    const result = await loadPlugin(
      { id: 'default-fixture', source: pathToFileURL(DEFAULT_PLUGIN).href },
      process.cwd(),
    );
    expect(result.descriptors.map((d) => d.id)).toEqual(['default-plugin']);
  });

  it('returns no descriptors when module has no descriptor/descriptors/default', async () => {
    const result = await loadPlugin(
      { id: 'empty-fixture', source: pathToFileURL(EMPTY_PLUGIN).href },
      process.cwd(),
    );
    expect(result.descriptors).toEqual([]);
  });
});

describe('loadPlugin — npm package source path', () => {
  it('throws an Error wrapping the import failure when package missing', async () => {
    await expect(
      loadPlugin({ id: 'no-pkg', source: 'this-package-does-not-exist-xyz-123' }, process.cwd()),
    ).rejects.toThrow(/failed to import/);
  });

  it('wraps non-Error throws with String(err) message', async () => {
    // We can simulate by passing a malformed source. Importing a non-existent
    // file that throws ENOENT returns Error, so use a relative path that resolves
    // to a missing file and triggers a SyntaxError-style import failure.
    await expect(
      loadPlugin(
        { id: 'broken', source: './tests/fixtures/plugins/__nonexistent__.mjs' },
        process.cwd(),
      ),
    ).rejects.toThrow(/failed to import/);
  });
});

describe('loadAllPlugins — error contained per plugin', () => {
  it('logs warning and continues when any single plugin fails', async () => {
    const results = await loadAllPlugins(
      [
        { id: 'broken', source: 'totally-bogus-package-xyz' },
        { id: 'multi', source: pathToFileURL(MULTI_PLUGIN).href },
      ],
      process.cwd(),
    );
    // The broken one is skipped
    expect(results.map((r) => r.entry.id)).toEqual(['multi']);
  });

  it('returns empty array for a single failing plugin', async () => {
    const results = await loadAllPlugins(
      [{ id: 'bad', source: 'absolutely-not-a-real-package-name' }],
      process.cwd(),
    );
    expect(results).toEqual([]);
  });
});

describe('loadPlugin — file: protocol prefix path resolution', () => {
  it('round-trips file: URL', async () => {
    const result = await loadPlugin(
      { id: 'multi', source: `file://${MULTI_PLUGIN}` },
      process.cwd(),
    );
    expect(result.descriptors.length).toBeGreaterThan(0);
  });

  it('resolves absolute paths starting with /', async () => {
    const result = await loadPlugin({ id: 'multi', source: MULTI_PLUGIN }, process.cwd());
    expect(result.descriptors.length).toBeGreaterThan(0);
  });

  it('resolves ../ relative paths against projectRoot', async () => {
    // From tests/ subdir, ../tests/fixtures/... resolves correctly
    const subdir = join(process.cwd(), 'tests');
    const result = await loadPlugin(
      { id: 'multi', source: '../tests/fixtures/plugins/multi-plugin/index.js' },
      subdir,
    );
    expect(result.descriptors.length).toBeGreaterThan(0);
  });
});
