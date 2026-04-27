/**
 * Tests for uncovered error/edge-case branches in src/cli/commands/plugin.ts.
 * Mocks plugin-config and load-plugin so network/fs side-effects are avoided.
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
  tmpDir = await mkdtemp(join(tmpdir(), 'ab-plugin-err-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('runPlugin add', () => {
  it('returns 2 when no source arg is given', async () => {
    const code = await runPlugin({}, ['add'], tmpDir);
    expect(code).toBe(2);
  });

  it('returns 1 when writePluginEntry throws', async () => {
    mockWritePluginEntry.mockRejectedValueOnce(new Error('disk full'));
    const code = await runPlugin({}, ['add', 'my-pkg'], tmpDir);
    expect(code).toBe(1);
  });

  it('passes --version flag to writePluginEntry', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    const code = await runPlugin({ version: '2.0.0' }, ['add', 'my-pkg'], tmpDir);
    expect(code).toBe(0);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ version: '2.0.0' }),
    );
  });

  it('passes --id override flag to writePluginEntry', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    const code = await runPlugin({ id: 'custom-id' }, ['add', 'my-pkg'], tmpDir);
    expect(code).toBe(0);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'custom-id' }),
    );
  });

  it('strips scope and agentsmesh-target- prefix when deriving id', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    await runPlugin({}, ['add', '@org/agentsmesh-target-foo'], tmpDir);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'foo' }),
    );
  });

  it('strips file: prefix and .js extension when deriving id', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    await runPlugin({}, ['add', 'file:./plugins/my-plugin.js'], tmpDir);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'my-plugin' }),
    );
  });

  it('handles scoped package without slash in name', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    const code = await runPlugin({}, ['add', '@no-slash'], tmpDir);
    expect(code).toBe(0);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'no-slash' }),
    );
  });

  it('falls back to "plugin" id for all-special-char source', async () => {
    mockWritePluginEntry.mockResolvedValueOnce(undefined);
    await runPlugin({}, ['add', 'file:!!!'], tmpDir);
    expect(mockWritePluginEntry).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({ id: 'plugin' }),
    );
  });
});

describe('runPlugin list', () => {
  it('returns 1 when readScopedConfigRaw throws', async () => {
    mockReadScopedConfigRaw.mockRejectedValueOnce(new Error('parse error'));
    const code = await runPlugin({}, ['list'], tmpDir);
    expect(code).toBe(1);
  });

  it('returns 0 and marks plugin failed when loadPlugin throws', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'bad-plugin', source: 'nonexistent-pkg', version: '1.0.0' }],
    });
    mockLoadPlugin.mockRejectedValueOnce(new Error('cannot find module'));
    const code = await runPlugin({}, ['list'], tmpDir);
    expect(code).toBe(0);
  });

  it('returns 0 with successfully loaded plugin descriptors', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'good-plugin', source: 'some-pkg' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'good-plugin', source: 'some-pkg' },
      descriptors: [{ id: 'good-plugin', emptyImportMessage: 'None.' }],
    });
    const code = await runPlugin({}, ['list'], tmpDir);
    expect(code).toBe(0);
  });

  it('shows "(0 descriptors)" when plugin loads with empty descriptors', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'empty-plugin', source: 'some-pkg' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'empty-plugin', source: 'some-pkg' },
      descriptors: [],
    });
    const code = await runPlugin({}, ['list'], tmpDir);
    expect(code).toBe(0);
  });
});

describe('runPlugin remove', () => {
  it('returns 2 when no id arg is given', async () => {
    const code = await runPlugin({}, ['remove'], tmpDir);
    expect(code).toBe(2);
  });

  it('returns 1 when removePluginEntry throws', async () => {
    mockRemovePluginEntry.mockRejectedValueOnce(new Error('write error'));
    const code = await runPlugin({}, ['remove', 'some-plugin'], tmpDir);
    expect(code).toBe(1);
  });
});

describe('runPlugin info', () => {
  it('returns 2 when no id arg is given', async () => {
    const code = await runPlugin({}, ['info'], tmpDir);
    expect(code).toBe(2);
  });

  it('returns 1 when readScopedConfigRaw throws', async () => {
    mockReadScopedConfigRaw.mockRejectedValueOnce(new Error('read error'));
    const code = await runPlugin({}, ['info', 'some-plugin'], tmpDir);
    expect(code).toBe(1);
  });

  it('returns 1 when loadPlugin throws', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'my-plugin', source: 'some-pkg' }],
    });
    mockLoadPlugin.mockRejectedValueOnce(new Error('load error'));
    const code = await runPlugin({}, ['info', 'my-plugin'], tmpDir);
    expect(code).toBe(1);
  });

  it('returns 0 and logs all descriptors on success', async () => {
    mockReadScopedConfigRaw.mockResolvedValueOnce({
      plugins: [{ id: 'my-plugin', source: 'some-pkg', version: '1.0.0' }],
    });
    mockLoadPlugin.mockResolvedValueOnce({
      entry: { id: 'my-plugin', source: 'some-pkg', version: '1.0.0' },
      descriptors: [
        { id: 'my-plugin', emptyImportMessage: 'No config found.' },
        { id: 'my-plugin-extra', emptyImportMessage: 'Extra.' },
      ],
    });
    const code = await runPlugin({}, ['info', 'my-plugin'], tmpDir);
    expect(code).toBe(0);
  });
});
