import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  importClineMcp,
  mapClineServerToCanonical,
} from '../../../../src/targets/cline/mcp-mapper.js';
import type { ImportResult } from '../../../../src/core/result-types.js';

describe('cline MCP mapper', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-cline-mcp-'));
    tempDirs.push(dir);
    return dir;
  }

  it('maps transportType and filters invalid env entries', () => {
    expect(mapClineServerToCanonical(null)).toBeNull();
    expect(mapClineServerToCanonical({ args: ['missing command'] })).toBeNull();
    expect(
      mapClineServerToCanonical({
        transportType: 'sse',
        command: 'npx',
        args: ['-y', 7],
        env: { TOKEN: 'abc', INVALID: 42 },
        description: 'Docs',
      }),
    ).toEqual({
      type: 'sse',
      command: 'npx',
      args: ['-y'],
      env: { TOKEN: 'abc' },
      description: 'Docs',
    });
  });

  it('maps url-only HTTP/SSE servers (no command) instead of dropping them', () => {
    expect(
      mapClineServerToCanonical({
        type: 'http',
        url: 'https://mcp.example.com',
        headers: { Authorization: 'Bearer x', INVALID: 9 },
        env: { TOKEN: 'abc' },
        description: 'Remote',
      }),
    ).toEqual({
      type: 'http',
      url: 'https://mcp.example.com',
      headers: { Authorization: 'Bearer x' },
      env: { TOKEN: 'abc' },
      description: 'Remote',
    });
    // Defaults type to 'http' when absent, and honors transportType.
    expect(mapClineServerToCanonical({ url: 'https://x' })).toEqual({
      type: 'http',
      url: 'https://x',
      headers: {},
      env: {},
    });
    expect(mapClineServerToCanonical({ transportType: 'sse', url: 'https://x' })).toEqual({
      type: 'sse',
      url: 'https://x',
      headers: {},
      env: {},
    });
  });

  it('imports a url-only MCP server through the full importClineMcp path', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline'), { recursive: true });
    writeFileSync(
      join(dir, '.cline', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          remote: { type: 'sse', url: 'https://mcp.example.com/sse', headers: { A: 'b' } },
        },
      }),
    );
    const results: ImportResult[] = [];
    await importClineMcp(dir, results);
    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
    ]);
    const mcp = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"remote"');
    expect(mcp).toContain('https://mcp.example.com/sse');
  });

  it('returns without writing anything for malformed or empty MCP settings', async () => {
    const invalidDir = createTempDir();
    mkdirSync(join(invalidDir, '.cline'), { recursive: true });
    writeFileSync(join(invalidDir, '.cline', 'mcp.json'), '{invalid');
    const invalidResults: ImportResult[] = [];
    await importClineMcp(invalidDir, invalidResults);
    expect(invalidResults).toEqual([]);

    const emptyDir = createTempDir();
    mkdirSync(join(emptyDir, '.cline'), { recursive: true });
    writeFileSync(join(emptyDir, '.cline', 'mcp.json'), JSON.stringify({ mcpServers: {} }));
    const emptyResults: ImportResult[] = [];
    await importClineMcp(emptyDir, emptyResults);
    expect(emptyResults).toEqual([]);
  });

  it('imports valid Cline MCP servers and skips invalid ones', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline'), { recursive: true });
    writeFileSync(
      join(dir, '.cline', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          docs: { command: 'npx', args: ['-y'], env: { TOKEN: 'abc' } },
          invalid: { args: ['missing command'] },
        },
      }),
    );

    const results: ImportResult[] = [];
    await importClineMcp(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
    ]);
    const mcp = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"docs"');
    expect(mcp).not.toContain('"invalid"');
  });

  it('imports the primary .cline/mcp.json path (CLI docs)', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline'), { recursive: true });
    writeFileSync(
      join(dir, '.cline', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
        },
      }),
    );

    const results: ImportResult[] = [];
    await importClineMcp(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
    ]);
    const mcp = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"context7"');
  });

  it('imports the legacy .cline/mcp_settings.json path for backward compatibility', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline'), { recursive: true });
    writeFileSync(
      join(dir, '.cline', 'mcp_settings.json'),
      JSON.stringify({
        mcpServers: {
          context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
        },
      }),
    );

    const results: ImportResult[] = [];
    await importClineMcp(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
    ]);
    const mcp = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"context7"');
  });

  it('imports the legacy agentsmesh-generated .cline/cline_mcp_settings.json filename', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline'), { recursive: true });
    writeFileSync(
      join(dir, '.cline', 'cline_mcp_settings.json'),
      JSON.stringify({
        mcpServers: {
          context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
        },
      }),
    );

    const results: ImportResult[] = [];
    await importClineMcp(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
    ]);
    const mcp = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"context7"');
  });
});
