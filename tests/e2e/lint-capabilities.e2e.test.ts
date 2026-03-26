import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

describe('lint capabilities', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('reports command, MCP, permissions, and hook translation warnings', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [copilot, cursor, gemini-cli, codex-cli]\nfeatures: [rules, commands, mcp, hooks, permissions]\n',
    );
    writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Rules\n');
    writeFileSync(
      join(dir, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Review\nallowed-tools:\n  - Bash(git diff)\n---\nReview.\n',
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'mcp.json'),
      '{\n  "mcpServers": {\n    "context7": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@upstash/context7-mcp"],\n      "env": { "TOKEN": "secret" }\n    },\n    "github": {\n      "description": "GitHub MCP server for repo operations",\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"],\n      "env": {}\n    }\n  }\n}\n',
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'permissions.yaml'),
      'allow:\n  - Bash(npm run test:*)\ndeny:\n  - Read(./.env)\n',
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'hooks.yaml'),
      'UserPromptSubmit:\n  - matcher: "*"\n    command: "./scripts/validate.sh $TOOL_INPUT"\n',
    );

    const result = await runCli('lint', dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/copilot.*allowed-tools/i);
    expect(result.stdout + result.stderr).toMatch(/cursor.*permissions/i);
    expect(result.stdout + result.stderr).toMatch(/cursor.*env/i);
    expect(result.stdout + result.stderr).toMatch(/codex-cli.*descriptions?/i);
    expect(result.stdout + result.stderr).toMatch(/gemini-cli.*UserPromptSubmit/i);
  });
});
