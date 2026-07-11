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

  it('generates remote MCP transports for Claude/Cursor/Codex and warns about their respective limitations', async () => {
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
    // codex-cli now also generates the remote (url) transport, per
    // https://developers.openai.com/codex/mcp — url/bearer_token_env_var/http_headers.
    const codexConfig = readFileSync(join(dir, '.codex', 'config.toml'), 'utf-8');
    expect(codexConfig).toContain('url = "https://example.com/mcp?token=${TOKEN}"');
    expect(codexConfig).toContain('bearer_token_env_var = "TOKEN"');

    const lint = await runCli('lint', dir);
    expect(lint.exitCode).toBe(0);
    expect(lint.stdout + lint.stderr).toMatch(/cursor.*URL\/header interpolation/i);
    // codex-cli has no config.toml key for arbitrary env vars on the remote transport.
    expect(lint.stdout + lint.stderr).toMatch(/codex-cli.*does not project env vars/i);
  });
});
