import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlugin, loadAllPlugins } from '../../../src/plugins/load-plugin.js';
import { resetRegistry, getDescriptor } from '../../../src/targets/catalog/registry.js';

// Path to our hand-written fixture plugin
const FIXTURE_PLUGIN_PATH = join(process.cwd(), 'tests/fixtures/plugins/simple-plugin/index.js');
const FIXTURE_PLUGIN_URL = pathToFileURL(FIXTURE_PLUGIN_PATH).href;

const validEntry = {
  id: 'simple-plugin',
  source: FIXTURE_PLUGIN_URL,
};

beforeEach(() => {
  resetRegistry();
});

describe('loadPlugin', () => {
  it('loads a valid descriptor from a file URL source', async () => {
    const result = await loadPlugin(validEntry, process.cwd());
    expect(result.entry.id).toBe('simple-plugin');
    expect(result.descriptors).toHaveLength(1);
    expect(result.descriptors[0]!.id).toBe('simple-plugin');
  });

  it('registers the descriptor in the registry', async () => {
    await loadPlugin(validEntry, process.cwd());
    const desc = getDescriptor('simple-plugin');
    expect(desc).toBeDefined();
    expect(desc!.id).toBe('simple-plugin');
  });

  it('loads from file: URL source', async () => {
    const result = await loadPlugin(
      { id: 'simple-plugin', source: `file://${FIXTURE_PLUGIN_PATH}` },
      process.cwd(),
    );
    expect(result.descriptors).toHaveLength(1);
  });

  it('loads from ./ relative source', async () => {
    const result = await loadPlugin(
      { id: 'simple-plugin', source: './tests/fixtures/plugins/simple-plugin/index.js' },
      process.cwd(),
    );
    expect(result.descriptors).toHaveLength(1);
  });

  it('throws with source in message when descriptor is invalid', async () => {
    const badPlugin = {
      id: 'bad-source',
      // Create a temp module that exports an invalid descriptor
      // We use a data URL for a self-contained inline module
      source: `data:text/javascript,export const descriptor = { id: 'BAD_ID', generators: {}, capabilities: {}, emptyImportMessage: '', lintRules: null, project: { paths: {} }, buildImportPaths: async()=>{}, detectionPaths: [] };`,
    };
    await expect(loadPlugin(badPlugin, process.cwd())).rejects.toThrow(/data:/);
  });
});

describe('loadAllPlugins', () => {
  it('returns loaded plugins for valid entries', async () => {
    const results = await loadAllPlugins([validEntry], process.cwd());
    expect(results).toHaveLength(1);
    expect(results[0]!.descriptors).toHaveLength(1);
  });

  it('skips failing plugins and returns only passing ones', async () => {
    const badEntry = { id: 'nonexistent', source: 'nonexistent-package-xyz-12345' };
    const results = await loadAllPlugins([badEntry, validEntry], process.cwd());
    // Bad entry should be skipped; valid entry should succeed
    expect(results).toHaveLength(1);
    expect(results[0]!.entry.id).toBe('simple-plugin');
  });

  it('returns empty array when no entries', async () => {
    const results = await loadAllPlugins([], process.cwd());
    expect(results).toHaveLength(0);
  });
});
