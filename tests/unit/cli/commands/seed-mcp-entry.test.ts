/**
 * Unit tests for seed-mcp-entry helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  injectAgentsmeshEntry,
  seedAgentsmeshMcpEntry,
  MCP_AGENTSMESH_ENTRY_VALUE,
} from '../../../../src/cli/commands/seed-mcp-entry.js';

describe('injectAgentsmeshEntry', () => {
  it('injects entry into empty mcpServers and returns true', () => {
    const mcp = { mcpServers: {} };
    const result = injectAgentsmeshEntry(mcp);
    expect(result).toBe(true);
    expect(mcp.mcpServers).toHaveProperty('agentsmesh');
    expect(mcp.mcpServers.agentsmesh).toEqual(MCP_AGENTSMESH_ENTRY_VALUE);
  });

  it('is a no-op when agentsmesh entry already exists and returns false', () => {
    const existing = { type: 'stdio' as const, command: 'custom', args: ['serve'] };
    const mcp = { mcpServers: { agentsmesh: existing } };
    const result = injectAgentsmeshEntry(mcp);
    expect(result).toBe(false);
    expect(mcp.mcpServers.agentsmesh).toBe(existing);
  });

  it('adds agentsmesh entry while preserving other servers and returns true', () => {
    const other = { type: 'stdio' as const, command: 'other-mcp', args: [] };
    const mcp = { mcpServers: { other } };
    const result = injectAgentsmeshEntry(mcp);
    expect(result).toBe(true);
    expect(mcp.mcpServers).toHaveProperty('agentsmesh');
    expect(mcp.mcpServers).toHaveProperty('other');
    expect(mcp.mcpServers.other).toBe(other);
  });
});

describe('seedAgentsmeshMcpEntry', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `am-seed-mcp-test-${process.pid}-${Date.now()}`);
    mkdirSync(join(tempDir, '.agentsmesh'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates mcp.json with agentsmesh entry when file does not exist', async () => {
    const wrote = await seedAgentsmeshMcpEntry(tempDir);
    expect(wrote).toBe(true);
    const content = readFileSync(join(tempDir, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers).toHaveProperty('agentsmesh');
    expect(parsed.mcpServers.agentsmesh).toEqual(MCP_AGENTSMESH_ENTRY_VALUE);
  });

  it('is a no-op when file already contains the agentsmesh entry and returns false', async () => {
    const initial = { mcpServers: { agentsmesh: MCP_AGENTSMESH_ENTRY_VALUE } };
    writeFileSync(join(tempDir, '.agentsmesh', 'mcp.json'), JSON.stringify(initial));

    const wrote = await seedAgentsmeshMcpEntry(tempDir);
    expect(wrote).toBe(false);
  });

  it('preserves existing servers and injects agentsmesh entry when absent', async () => {
    const initial = {
      mcpServers: { github: { type: 'stdio', command: 'gh-mcp', args: [] } },
    };
    writeFileSync(join(tempDir, '.agentsmesh', 'mcp.json'), JSON.stringify(initial));

    const wrote = await seedAgentsmeshMcpEntry(tempDir);
    expect(wrote).toBe(true);

    const content = readFileSync(join(tempDir, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers).toHaveProperty('agentsmesh');
    expect(parsed.mcpServers).toHaveProperty('github');
  });
});
