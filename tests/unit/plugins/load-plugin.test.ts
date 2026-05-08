import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  loadPlugin,
  loadAllPlugins,
  resolveNpmSpecifier,
} from '../../../src/plugins/load-plugin.js';
import { resetRegistry, getDescriptor } from '../../../src/targets/catalog/registry.js';

// Path to our hand-written fixture plugin
const FIXTURE_PLUGIN_PATH = join(process.cwd(), 'tests/fixtures/plugins/simple-plugin/index.js');
const FIXTURE_PLUGIN_URL = pathToFileURL(FIXTURE_PLUGIN_PATH).href;
const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/plugins');

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
    const badEntry = {
      id: 'invalid-plugin',
      source: pathToFileURL(join(FIXTURES_DIR, 'invalid-plugin/index.js')).href,
    };
    await expect(loadPlugin(badEntry, process.cwd())).rejects.toThrow(/invalid-plugin/);
  });

  it('extracts a descriptors-array export (multi-descriptor plugin)', async () => {
    const result = await loadPlugin(
      {
        id: 'multi-plugin',
        source: pathToFileURL(join(FIXTURES_DIR, 'multi-plugin/index.js')).href,
      },
      process.cwd(),
    );
    expect(result.descriptors.length).toBeGreaterThan(1);
  });

  it('extracts a default export when no `descriptor`/`descriptors` named export exists', async () => {
    const result = await loadPlugin(
      {
        id: 'default-plugin',
        source: pathToFileURL(join(FIXTURES_DIR, 'default-plugin/index.js')).href,
      },
      process.cwd(),
    );
    expect(result.descriptors).toHaveLength(1);
    expect(result.descriptors[0]!.id).toBe('default-plugin');
  });

  it('returns no descriptors when the module has no descriptor exports', async () => {
    const result = await loadPlugin(
      {
        id: 'empty-plugin',
        source: pathToFileURL(join(FIXTURES_DIR, 'empty-plugin/index.js')).href,
      },
      process.cwd(),
    );
    expect(result.descriptors).toHaveLength(0);
  });
});

describe('resolveNpmSpecifier', () => {
  let tmpRoot: string;

  afterEach(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('resolves a real npm dependency to an absolute path in node_modules', () => {
    const resolved = resolveNpmSpecifier('yaml', process.cwd());
    expect(resolved).toContain('node_modules');
    expect(resolved).toContain('yaml');
  });

  it('throws for a non-existent package', () => {
    expect(() => resolveNpmSpecifier('totally-fake-pkg-xyz-999', process.cwd())).toThrow(
      /Cannot find package/,
    );
  });

  it('throws when package.json declares an entry that does not exist on disk', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'load-plugin-bad-entry-'));
    const pkgDir = join(tmpRoot, 'node_modules', 'broken-entry-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'broken-entry-pkg', main: 'lib/missing.js' }),
    );
    expect(() => resolveNpmSpecifier('broken-entry-pkg', tmpRoot)).toThrow(
      /entry 'lib\/missing\.js' does not exist/,
    );
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

  it('throws when a strict-tagged plugin fails to load (F3)', async () => {
    const badStrict = {
      id: 'nonexistent',
      source: 'nonexistent-strict-xyz-12345',
      strict: true,
    } as const;
    await expect(loadAllPlugins([badStrict], process.cwd())).rejects.toThrow(/strict load/);
  });

  it('throws when AGENTSMESH_STRICT_PLUGINS=1 even if strict is unset (F3)', async () => {
    const original = process.env.AGENTSMESH_STRICT_PLUGINS;
    process.env.AGENTSMESH_STRICT_PLUGINS = '1';
    try {
      const badEntry = { id: 'nonexistent', source: 'nonexistent-env-strict-xyz' };
      await expect(loadAllPlugins([badEntry], process.cwd())).rejects.toThrow(/strict load/);
    } finally {
      if (original === undefined) delete process.env.AGENTSMESH_STRICT_PLUGINS;
      else process.env.AGENTSMESH_STRICT_PLUGINS = original;
    }
  });

  it('also recognizes AGENTSMESH_STRICT_PLUGINS=true (string) (F3)', async () => {
    const original = process.env.AGENTSMESH_STRICT_PLUGINS;
    process.env.AGENTSMESH_STRICT_PLUGINS = 'true';
    try {
      const badEntry = { id: 'nonexistent', source: 'nonexistent-env-strict-true' };
      await expect(loadAllPlugins([badEntry], process.cwd())).rejects.toThrow(/strict load/);
    } finally {
      if (original === undefined) delete process.env.AGENTSMESH_STRICT_PLUGINS;
      else process.env.AGENTSMESH_STRICT_PLUGINS = original;
    }
  });

  it('does NOT escalate when AGENTSMESH_STRICT_PLUGINS has any other value (F3)', async () => {
    const original = process.env.AGENTSMESH_STRICT_PLUGINS;
    process.env.AGENTSMESH_STRICT_PLUGINS = 'no';
    try {
      const badEntry = { id: 'nonexistent', source: 'nonexistent-env-strict-no' };
      const results = await loadAllPlugins([badEntry], process.cwd());
      expect(results).toHaveLength(0);
    } finally {
      if (original === undefined) delete process.env.AGENTSMESH_STRICT_PLUGINS;
      else process.env.AGENTSMESH_STRICT_PLUGINS = original;
    }
  });

  it('still loads other plugins when one strict plugin fails (collects all failures)', async () => {
    const goodEntry = {
      id: 'good-strict',
      source: pathToFileURL(join(process.cwd(), 'tests/fixtures/plugins/simple-plugin/index.js'))
        .href,
      strict: true,
    } as const;
    const badEntry = {
      id: 'bad-strict',
      source: 'totally-missing-pkg-xyz-12345',
      strict: true,
    } as const;
    // Even though the good plugin loaded, the strict failure must surface
    await expect(loadAllPlugins([goodEntry, badEntry], process.cwd())).rejects.toThrow(
      /1 plugin\(s\) failed strict/,
    );
  });
});
