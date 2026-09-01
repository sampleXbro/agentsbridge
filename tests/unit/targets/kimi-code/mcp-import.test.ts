import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { importFromKimiCode } from '../../../../src/targets/kimi-code/importer.js';
import { parseKimiMcp } from '../../../../src/targets/kimi-code/mcp-import.js';

let dir = '';

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function project(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'kimi-mcp-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

describe('parseKimiMcp', () => {
  it('reads Kimi Code transport in preference to the canonical type', () => {
    expect(
      parseKimiMcp(
        '{"mcpServers":{"events":{"transport":"sse","url":"https://e.example.com/sse"},"api":{"transport":"http","type":"stdio","url":"https://a.example.com/mcp"}}}',
      ),
    ).toEqual({
      events: {
        type: 'sse',
        url: 'https://e.example.com/sse',
        headers: {},
        env: {},
        description: undefined,
      },
      api: {
        type: 'http',
        url: 'https://a.example.com/mcp',
        headers: {},
        env: {},
        description: undefined,
      },
    });
  });

  it('falls back to type, then to the shape, when transport is absent', () => {
    const servers = parseKimiMcp(
      '{"mcpServers":{"a":{"type":"sse","url":"https://a.example.com"},"b":{"url":"https://b.example.com"},"c":{"command":"npx","args":["x"],"env":{"K":"v"},"description":"d"}}}',
    );
    expect(servers.a!.type).toBe('sse');
    expect(servers.b!.type).toBe('http');
    expect(servers.c).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['x'],
      env: { K: 'v' },
      description: 'd',
    });
  });

  it('ignores documents and entries it cannot use', () => {
    expect(parseKimiMcp('not json')).toEqual({});
    expect(parseKimiMcp('[]')).toEqual({});
    expect(parseKimiMcp('{"mcpServers":[]}')).toEqual({});
    expect(parseKimiMcp('{"mcpServers":{"a":1,"b":{"note":"neither"}}}')).toEqual({});
  });
});

describe('importFromKimiCode MCP', () => {
  it('keeps an sse server sse all the way into canonical', async () => {
    const root = project({
      '.kimi-code/mcp.json':
        '{"mcpServers":{"events":{"transport":"sse","url":"https://e.example.com/sse"}}}',
    });

    const results = await importFromKimiCode(root, { scope: 'project' });

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/mcp.json']);
    const canonical = JSON.parse(readFileSync(join(root, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(canonical.mcpServers.events.type).toBe('sse');
  });

  it('merges into servers another target already imported', async () => {
    const root = project({
      '.agentsmesh/mcp.json': '{"mcpServers":{"other":{"type":"stdio","command":"other"}}}',
      '.kimi-code/mcp.json': '{"mcpServers":{"events":{"transport":"sse","url":"https://e.io"}}}',
    });
    await importFromKimiCode(root, { scope: 'project' });
    const canonical = JSON.parse(readFileSync(join(root, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(Object.keys(canonical.mcpServers).sort()).toEqual(['events', 'other']);
  });

  it('reports nothing for an empty or unusable mcp.json', async () => {
    expect(await importFromKimiCode(project({ '.kimi-code/mcp.json': '{}' }))).toEqual([]);
    expect(await importFromKimiCode(project({}), { scope: 'global' })).toEqual([]);
  });
});
