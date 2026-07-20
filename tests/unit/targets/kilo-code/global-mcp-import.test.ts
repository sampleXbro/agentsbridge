import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importGlobalKiloMcp } from '../../../../src/targets/kilo-code/global-mcp-import.js';
import { KILO_GLOBAL_CONFIG_FILE } from '../../../../src/targets/kilo-code/constants.js';
import type { ImportResult } from '../../../../src/core/types.js';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'am-kilo-global-mcp-'));
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function writeGlobalConfig(content: unknown): void {
  mkdirSync(join(TEST_DIR, '.config', 'kilo'), { recursive: true });
  writeFileSync(join(TEST_DIR, KILO_GLOBAL_CONFIG_FILE), JSON.stringify(content));
}

function readCanonicalMcp(): Record<string, unknown> {
  const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
  return (JSON.parse(content) as { mcpServers: Record<string, unknown> }).mcpServers;
}

describe('importGlobalKiloMcp', () => {
  it('does nothing when the global config file does not exist', async () => {
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('does nothing when the config file has no mcp key', async () => {
    writeGlobalConfig({ permission: { allow: ['Read'] } });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('does nothing when the config file is invalid JSON', async () => {
    mkdirSync(join(TEST_DIR, '.config', 'kilo'), { recursive: true });
    writeFileSync(join(TEST_DIR, KILO_GLOBAL_CONFIG_FILE), '{not valid json');
    const results: ImportResult[] = [];
    await expect(importGlobalKiloMcp(TEST_DIR, results)).resolves.toBeUndefined();
    expect(results).toEqual([]);
  });

  it('imports a local (stdio) server into canonical mcp.json', async () => {
    writeGlobalConfig({
      mcp: {
        fs: { type: 'local', command: ['npx', '-y', 'server'], environment: { KEY: 'v' } },
      },
    });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toHaveLength(1);
    expect(results[0]!.toPath).toBe('.agentsmesh/mcp.json');
    const servers = readCanonicalMcp();
    expect(servers.fs).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { KEY: 'v' },
    });
  });

  it('imports a remote (url) server into canonical mcp.json', async () => {
    writeGlobalConfig({
      mcp: {
        remote: {
          type: 'remote',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer x' },
        },
      },
    });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    const servers = readCanonicalMcp();
    expect(servers.remote).toEqual({
      type: 'url',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer x' },
      env: {},
    });
  });

  it('preserves description when present', async () => {
    writeGlobalConfig({
      mcp: { fs: { type: 'local', command: ['node'], description: 'Filesystem tools' } },
    });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    const servers = readCanonicalMcp();
    expect((servers.fs as Record<string, unknown>).description).toBe('Filesystem tools');
  });

  it('skips entries with neither url nor a non-empty command array', async () => {
    writeGlobalConfig({ mcp: { broken: { type: 'local' } } });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('skips entries whose command array has a non-string first element', async () => {
    writeGlobalConfig({ mcp: { broken: { command: [123] } } });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('skips non-object entries and entries that are arrays', async () => {
    writeGlobalConfig({ mcp: { broken: 'not-an-object', arr: [1, 2] } });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('does nothing when mcp key is not an object', async () => {
    writeGlobalConfig({ mcp: 'nope' });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('does nothing when the top-level config is an array', async () => {
    mkdirSync(join(TEST_DIR, '.config', 'kilo'), { recursive: true });
    writeFileSync(join(TEST_DIR, KILO_GLOBAL_CONFIG_FILE), '[1,2,3]');
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('merges with existing canonical servers rather than clobbering them', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      JSON.stringify({ mcpServers: { existing: { type: 'stdio', command: 'a', args: [], env: {} } } }),
    );
    writeGlobalConfig({ mcp: { fs: { type: 'local', command: ['node'] } } });
    const results: ImportResult[] = [];
    await importGlobalKiloMcp(TEST_DIR, results);
    const servers = readCanonicalMcp();
    expect(servers.existing).toBeDefined();
    expect(servers.fs).toBeDefined();
  });
});
