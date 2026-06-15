/**
 * Copilot MCP importer tests.
 *
 * Copilot generates `.vscode/mcp.json` under the `servers` key (VS Code format),
 * NOT `mcpServers`. The importer must read `servers` and produce canonical
 * `.agentsmesh/mcp.json` with `mcpServers`, completing the round-trip.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCopilot } from '../../../../src/targets/copilot/importer.js';
import { COPILOT_MCP_JSON } from '../../../../src/targets/copilot/constants.js';

const TEST_DIR = join(tmpdir(), 'am-copilot-importer-mcp-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromCopilot — MCP', () => {
  it('imports .vscode/mcp.json `servers` key into canonical mcpServers', async () => {
    mkdirSync(join(TEST_DIR, '.vscode'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_MCP_JSON),
      JSON.stringify({
        servers: {
          foo: { type: 'stdio', command: 'npx', args: ['-y', 'foo-server'], env: {} },
        },
      }),
    );

    const results = await importFromCopilot(TEST_DIR);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('copilot');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    const canonical = JSON.parse(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8'),
    ) as { mcpServers: Record<string, { command?: string; args?: string[] }> };
    expect(Object.keys(canonical.mcpServers)).toEqual(['foo']);
    expect(canonical.mcpServers.foo!.command).toBe('npx');
    expect(canonical.mcpServers.foo!.args).toEqual(['-y', 'foo-server']);
  });

  it('imports http servers from `servers` key', async () => {
    mkdirSync(join(TEST_DIR, '.vscode'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_MCP_JSON),
      JSON.stringify({
        servers: {
          remote: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'x' } },
        },
      }),
    );

    const results = await importFromCopilot(TEST_DIR);
    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();

    const canonical = JSON.parse(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8'),
    ) as { mcpServers: Record<string, { url?: string; type?: string }> };
    expect(canonical.mcpServers.remote!.url).toBe('https://example.com/mcp');
    expect(canonical.mcpServers.remote!.type).toBe('http');
  });

  it('does not produce an mcp result when no .vscode/mcp.json exists', async () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), '# Root\n');
    const results = await importFromCopilot(TEST_DIR);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });
});
