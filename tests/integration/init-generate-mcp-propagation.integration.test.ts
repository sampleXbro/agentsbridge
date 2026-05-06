/**
 * Integration test: agentsmesh init + generate propagates the agentsmesh MCP server
 * entry into every MCP-native target's native config file.
 *
 * Uses the CLI subprocess for generate (which writes files to disk) and the
 * programmatic API for the init-time seed step.
 * Covers claude-code (.mcp.json) and cursor (.cursor/mcp.json).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { seedAgentsmeshMcpEntry } from '../../src/cli/commands/seed-mcp-entry.js';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'am-init-gen-mcp-'));
  await mkdir(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });

  // Minimal project with mcp feature enabled for claude-code and cursor
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules, mcp]\n',
    'utf8',
  );
  await writeFile(
    join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\ndescription: root\n---\n\nRoot instructions.\n',
    'utf8',
  );

  // Simulate what `agentsmesh init` does: seed the agentsmesh MCP entry
  await seedAgentsmeshMcpEntry(projectRoot);
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('init → generate: MCP propagation (integration)', () => {
  it('seeded .agentsmesh/mcp.json contains the agentsmesh entry after init', async () => {
    const raw = await readFile(join(projectRoot, '.agentsmesh', 'mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };

    expect(parsed.mcpServers).toHaveProperty('agentsmesh');
    expect(parsed.mcpServers['agentsmesh']).toMatchObject({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'agentsmesh', 'mcp'],
    });
  });

  it('generate propagates agentsmesh MCP entry to claude-code .mcp.json', async () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: projectRoot });

    const raw = await readFile(join(projectRoot, '.mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };

    expect(parsed.mcpServers).toHaveProperty('agentsmesh');
    expect(parsed.mcpServers['agentsmesh']).toMatchObject({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'agentsmesh', 'mcp'],
    });
  });

  it('generate propagates agentsmesh MCP entry to cursor .cursor/mcp.json', async () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: projectRoot });

    const raw = await readFile(join(projectRoot, '.cursor', 'mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };

    expect(parsed.mcpServers).toHaveProperty('agentsmesh');
    expect(parsed.mcpServers['agentsmesh']).toMatchObject({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'agentsmesh', 'mcp'],
    });
  });

  it('seeding is idempotent: second seedAgentsmeshMcpEntry call does not duplicate the entry', async () => {
    // Seed again (simulates a second init/import)
    const modified = await seedAgentsmeshMcpEntry(projectRoot);
    expect(modified).toBe(false); // already present — no write

    const raw = await readFile(join(projectRoot, '.agentsmesh', 'mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };
    const keys = Object.keys(parsed.mcpServers).filter((k) => k === 'agentsmesh');
    expect(keys).toHaveLength(1);
  });

  it('targets without mcp feature produce no .mcp.json output file', async () => {
    // Reconfigure: mcp feature disabled
    await writeFile(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
      'utf8',
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: projectRoot });

    // .mcp.json must not exist when mcp is not a configured feature
    await expect(readFile(join(projectRoot, '.mcp.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
