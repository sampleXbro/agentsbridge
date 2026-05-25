/**
 * Branch coverage for src/targets/crush/importer.ts line 120-128:
 * - url-server import path.
 * - type field fallback (default 'http' for url servers).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCrush } from '../../../../src/targets/crush/importer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-crush-imp-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importFromCrush — url MCP server branches', () => {
  it('imports url-type server with explicit type', async () => {
    writeFileSync(
      join(projectRoot, 'crush.json'),
      JSON.stringify({
        mcp: {
          web: {
            type: 'http',
            url: 'https://example.com',
            headers: { Auth: 'tok' },
            description: 'web srv',
          },
        },
      }),
    );
    const results = await importFromCrush(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeDefined();
    const mcpPath = join(projectRoot, '.agentsmesh', 'mcp.json');
    expect(existsSync(mcpPath)).toBe(true);
    const mcp = JSON.parse(readFileSync(mcpPath, 'utf-8')) as {
      mcpServers: Record<string, { type: string; url: string }>;
    };
    expect(mcp.mcpServers.web!.url).toBe('https://example.com');
  });

  it('imports url-type server with implicit default type "http"', async () => {
    writeFileSync(
      join(projectRoot, 'crush.json'),
      JSON.stringify({
        mcp: { web: { url: 'https://example.com' } },
      }),
    );
    const results = await importFromCrush(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeDefined();
  });

  it('skips entries that have neither command nor url', async () => {
    writeFileSync(
      join(projectRoot, 'crush.json'),
      JSON.stringify({
        mcp: { broken: { type: 'stdio', notes: 'no command/url' } },
      }),
    );
    const results = await importFromCrush(projectRoot);
    // No MCP entries → no mcp result.
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('skips crush.json with invalid JSON (catch branch)', async () => {
    writeFileSync(join(projectRoot, 'crush.json'), '{ broken');
    const results = await importFromCrush(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('skips crush.json when mcp is an array', async () => {
    writeFileSync(join(projectRoot, 'crush.json'), JSON.stringify({ mcp: [] }));
    const results = await importFromCrush(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });
});
