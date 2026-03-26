import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

describe('MCP transport variants', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('generates remote MCP transports for Claude/Cursor and warns for Cursor/Codex limitations', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code, cursor, codex-cli]\nfeatures: [rules, mcp]\n',
    );
    writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
    writeFileSync(
      join(dir, '.agentsmesh', 'mcp.json'),
      '{\n  "mcpServers": {\n    "local": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@upstash/context7-mcp"],\n      "env": {}\n    },\n    "remote": {\n      "type": "http",\n      "url": "https://example.com/mcp?token=${TOKEN}",\n      "headers": { "Authorization": "Bearer ${TOKEN}" },\n      "env": { "TOKEN": "${TOKEN}" }\n    }\n  }\n}\n',
    );

    const generate = await runCli('generate', dir);
    expect(generate.exitCode).toBe(0);
    expect(readFileSync(join(dir, '.mcp.json'), 'utf-8')).toContain(
      '"url": "https://example.com/mcp?token=${TOKEN}"',
    );
    expect(readFileSync(join(dir, '.cursor', 'mcp.json'), 'utf-8')).toContain(
      '"Authorization": "Bearer ${TOKEN}"',
    );
    expect(readFileSync(join(dir, '.codex', 'config.toml'), 'utf-8')).not.toContain(
      'https://example.com/mcp',
    );

    const lint = await runCli('lint', dir);
    expect(lint.exitCode).toBe(0);
    expect(lint.stdout + lint.stderr).toMatch(/cursor.*URL\/header interpolation/i);
    expect(lint.stdout + lint.stderr).toMatch(/codex-cli.*only generates stdio MCP servers/i);
  });
});
