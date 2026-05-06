/**
 * Integration test: agentsmesh init seeds the agentsmesh MCP server entry in .agentsmesh/mcp.json.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { parseMcp } from '../../src/canonical/features/mcp.js';

const TEST_DIR = join(tmpdir(), 'am-integration-init-mcp-template');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh init: mcp.json template (integration)', () => {
  it('produces a parseable mcp.json with the agentsmesh server entry', async () => {
    execSync(`node ${CLI_PATH} init`, { cwd: TEST_DIR });

    const mcpPath = join(TEST_DIR, '.agentsmesh', 'mcp.json');
    const result = await parseMcp(mcpPath);

    expect(result).not.toBeNull();
    expect(result?.mcpServers).toHaveProperty('agentsmesh');

    const entry = result?.mcpServers['agentsmesh'];
    expect(entry).toMatchObject({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'agentsmesh', 'mcp'],
    });
  });
});
