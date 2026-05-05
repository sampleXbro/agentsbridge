/**
 * Extra branch coverage tests for src/cli/commands/plugin.ts.
 * Targets ternaries / conditional-expression branches not covered by
 * tests/unit/cli/commands/plugin*.test.ts:
 *   - version handling, id derivation, error propagation, empty subcommand.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockWritePluginEntry = vi.hoisted(() => vi.fn());
const mockRemovePluginEntry = vi.hoisted(() => vi.fn());
const mockReadScopedConfigRaw = vi.hoisted(() => vi.fn());
const mockLoadPlugin = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/plugins/plugin-config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/plugins/plugin-config.js')>();
  return {
    ...actual,
    writePluginEntry: mockWritePluginEntry,
    removePluginEntry: mockRemovePluginEntry,
    readScopedConfigRaw: mockReadScopedConfigRaw,
  };
});

vi.mock('../../../../src/plugins/load-plugin.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/plugins/load-plugin.js')>();
  return { ...actual, loadPlugin: mockLoadPlugin };
});

import { runPlugin } from '../../../../src/cli/commands/plugin.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'ab-plugin-extra-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('runPlugin add — version branch', () => {
  it('formats hint with @latest when version is undefined', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    const result = await runPlugin({}, ['add', 'pkg-no-version'], tmpDir);
    expect(result.exitCode).toBe(0);
    // No version flag → writePluginEntry gets version: undefined
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ version: undefined }),
    );
    if (result.data.subcommand === 'add') {
      expect(result.data.version).toBe('latest');
    }
  });

  it('passes version literal exactly when --version is a string', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    const result = await runPlugin({ version: '0.0.1' }, ['add', 'pkg'], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ version: '0.0.1' }),
    );
  });

  it('treats --version as a boolean (no string) → undefined version, @latest hint branch', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    const result = await runPlugin({ version: true }, ['add', 'pkg'], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ version: undefined }),
    );
  });

  it('propagates writePluginEntry error', async () => {
    mockWritePluginEntry.mockRejectedValueOnce('plain-string-error');
    await expect(runPlugin({}, ['add', 'some-pkg'], tmpDir)).rejects.toBe('plain-string-error');
  });
});

describe('runPlugin list — version display branch', () => {
  it('omits @version segment when entry.version is undefined', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'no-ver-plugin', source: 'pkg' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'no-ver-plugin', source: 'pkg' },
      descriptors: [{ id: 'no-ver-plugin', emptyImportMessage: 'm' }],
    });
    const result = await runPlugin({}, ['list'], tmpDir);
    expect(result.exitCode).toBe(0);
    if (result.data.subcommand === 'list') {
      expect(result.data.plugins[0]!.version).toBeUndefined();
    }
  });

  it('renders @version segment when entry.version is defined', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'with-ver', source: 'pkg', version: '2.1.0' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'with-ver', source: 'pkg', version: '2.1.0' },
      descriptors: [{ id: 'with-ver', emptyImportMessage: 'm' }],
    });
    const result = await runPlugin({}, ['list'], tmpDir);
    expect(result.exitCode).toBe(0);
    if (result.data.subcommand === 'list') {
      expect(result.data.plugins[0]!.version).toBe('2.1.0');
    }
  });

  it('handles missing plugins array (??[] branch) by treating as empty', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({});
    const result = await runPlugin({}, ['list'], tmpDir);
    expect(result.exitCode).toBe(0);
    if (result.data.subcommand === 'list') {
      expect(result.data.plugins).toEqual([]);
    }
  });

  it('propagates readScopedConfigRaw error on list', async () => {
    mockReadScopedConfigRaw.mockRejectedValueOnce({ raw: 'object-error' });
    await expect(runPlugin({}, ['list'], tmpDir)).rejects.toEqual({ raw: 'object-error' });
  });
});

describe('runPlugin remove — error formatting branch', () => {
  it('propagates removePluginEntry error', async () => {
    mockRemovePluginEntry.mockRejectedValueOnce('disk-fail');
    await expect(runPlugin({}, ['remove', 'foo'], tmpDir)).rejects.toBe('disk-fail');
  });

  it('returns 0 with found: true when entry is removed', async () => {
    mockRemovePluginEntry.mockResolvedValueOnce(true);
    const result = await runPlugin({}, ['remove', 'foo'], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.data).toEqual({ subcommand: 'remove', id: 'foo', found: true });
  });
});

describe('runPlugin info — version display + error formatting branches', () => {
  it('formats info source line with @version when version is defined', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'p', source: 'pkg', version: '1.0.0' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'p', source: 'pkg', version: '1.0.0' },
      descriptors: [{ id: 'p', emptyImportMessage: 'no-config' }],
    });
    const result = await runPlugin({}, ['info', 'p'], tmpDir);
    expect(result.exitCode).toBe(0);
    if (result.data.subcommand === 'info') {
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('formats info source line without @version when version is undefined', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'p', source: 'pkg' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'p', source: 'pkg' },
      descriptors: [],
    });
    const result = await runPlugin({}, ['info', 'p'], tmpDir);
    expect(result.exitCode).toBe(0);
    if (result.data.subcommand === 'info') {
      expect(result.data.version).toBeUndefined();
    }
  });

  it('handles missing plugins array (??[] branch) when finding entry', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({});
    const result = await runPlugin({}, ['info', 'never'], tmpDir);
    expect(result.exitCode).toBe(1);
  });

  it('propagates readScopedConfigRaw error on info', async () => {
    mockReadScopedConfigRaw.mockRejectedValueOnce(123);
    await expect(runPlugin({}, ['info', 'p'], tmpDir)).rejects.toBe(123);
  });

  it('returns exitCode 1 when loadPlugin throws', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'p', source: 'pkg' }],
    });
    mockLoadPlugin.mockRejectedValueOnce('module-not-found');
    const result = await runPlugin({}, ['info', 'p'], tmpDir);
    expect(result.exitCode).toBe(1);
  });
});

describe('runPlugin — empty subcommand branch', () => {
  it('treats empty-string subcommand as missing (showHelp, returns 0)', async () => {
    const result = await runPlugin({}, [''], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
  });
});

describe('derivePluginId — extension stripping branches', () => {
  it('strips .ts extension', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    await runPlugin({}, ['add', 'file:./plugin/foo.ts'], tmpDir);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'foo' }),
    );
  });

  it('keeps id when source is bare name (no scope, no prefix, no extension)', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    await runPlugin({}, ['add', 'simple-name'], tmpDir);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'simple-name' }),
    );
  });

  it('strips windows-style backslashes when deriving id', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    await runPlugin({}, ['add', 'C:\\some\\nested\\my-plugin.js'], tmpDir);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'my-plugin' }),
    );
  });
});
