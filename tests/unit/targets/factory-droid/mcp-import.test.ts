import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { ImportResult } from '../../../../src/core/types.js';
import { importFactoryDroidMcp } from '../../../../src/targets/factory-droid/mcp-import.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `factory-droid-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absPath = join(root, relativePath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }
  return root;
}

describe('importFactoryDroidMcp', () => {
  it('does nothing when file does not exist', async () => {
    const root = join(tmpdir(), `factory-droid-mcp-test-${Date.now()}-missing`);
    mkdirSync(root, { recursive: true });
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when file contains invalid JSON', async () => {
    const root = setupFixture({ '.factory/mcp.json': '{ broken json' });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when top-level JSON value is an array', async () => {
    const root = setupFixture({ '.factory/mcp.json': JSON.stringify([]) });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when mcpServers entry is null', async () => {
    const root = setupFixture({
      '.factory/mcp.json': JSON.stringify({ mcpServers: { bad: null } }),
    });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when mcpServers entry is a string', async () => {
    const root = setupFixture({
      '.factory/mcp.json': JSON.stringify({ mcpServers: { bad: 'not-an-object' } }),
    });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when mcpServers entry is an array', async () => {
    const root = setupFixture({
      '.factory/mcp.json': JSON.stringify({ mcpServers: { bad: ['a', 'b'] } }),
    });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when all mcpServers entries are invalid', async () => {
    const root = setupFixture({
      '.factory/mcp.json': JSON.stringify({
        mcpServers: { a: null, b: 'string', c: [1, 2] },
      }),
    });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('pushes result when valid mcpServers entries are found', async () => {
    const root = setupFixture({
      '.factory/mcp.json': JSON.stringify({
        mcpServers: {
          filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
        },
      }),
    });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(1);
    expect(results[0].feature).toBe('mcp');
    expect(results[0].fromTool).toBe('factory-droid');
    expect(results[0].toPath).toBe('.agentsmesh/mcp.json');
    rmSync(root, { recursive: true, force: true });
  });

  it('skips invalid entries and imports only valid ones', async () => {
    const root = setupFixture({
      '.factory/mcp.json': JSON.stringify({
        mcpServers: {
          bad: null,
          good: { command: 'node', args: ['server.js'] },
        },
      }),
    });
    const results: ImportResult[] = [];
    await importFactoryDroidMcp(root, '.factory/mcp.json', results);
    expect(results).toHaveLength(1);
    expect(results[0].feature).toBe('mcp');
    rmSync(root, { recursive: true, force: true });
  });
});
