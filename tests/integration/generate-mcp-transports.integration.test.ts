import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

describe('generate MCP transport variants (integration)', () => {
  let testDir = '';

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'ab-integration-mcp-transports-'));
  });

  afterEach(() => {
    if (testDir) rmSync(testDir, { recursive: true, force: true });
  });

  it('preserves URL-based MCP for Claude and Cursor while filtering Codex to stdio', () => {
    writeFileSync(
      join(testDir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code, cursor, codex-cli]
features: [rules, mcp]
`,
    );
    mkdirSync(join(testDir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'mcp.json'),
      `{
  "mcpServers": {
    "local": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    },
    "remote": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer \${TOKEN}" },
      "env": { "TOKEN": "\${TOKEN}" }
    }
  }
}`,
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, '.mcp.json'), 'utf-8')).toContain(
      '"url": "https://example.com/mcp"',
    );
    expect(readFileSync(join(testDir, '.cursor', 'mcp.json'), 'utf-8')).toContain(
      '"Authorization": "Bearer ${TOKEN}"',
    );
    const codexConfig = readFileSync(join(testDir, '.codex', 'config.toml'), 'utf-8');
    expect(codexConfig).toContain('command = "npx"');
    expect(codexConfig).not.toContain('https://example.com/mcp');
  });
});
