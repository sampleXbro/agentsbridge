import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLint } from '../../../src/core/linter.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/schema.js';

const TEST_DIR = join(tmpdir(), 'ab-mcp-linter-test');

function config(targets: ValidatedConfig['targets']): ValidatedConfig {
  return {
    version: 1,
    targets,
    features: ['rules', 'mcp'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function canonicalWithMcp(
  mcpServers: NonNullable<CanonicalFiles['mcp']>['mcpServers'],
): CanonicalFiles {
  return {
    rules: [
      {
        source: join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root',
        globs: [],
        body: 'Root',
      },
    ],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers },
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('MCP linting', () => {
  it('warns when Cursor MCP uses remote headers or env interpolation', async () => {
    const { diagnostics } = await runLint(
      config(['cursor']),
      canonicalWithMcp({
        remote: {
          type: 'http',
          url: 'https://example.com/mcp?token=${API_TOKEN}',
          headers: { Authorization: 'Bearer ${API_TOKEN}' },
          env: { API_TOKEN: '${API_TOKEN}' },
        },
      }),
      TEST_DIR,
    );

    expect(diagnostics).toContainEqual({
      level: 'warning',
      file: '.agentsbridge/mcp.json',
      target: 'cursor',
      message:
        'MCP server "remote" uses env vars or URL/header interpolation; Cursor handling may differ from canonical MCP.',
    });
  });

  it('warns when codex-cli cannot generate non-stdio MCP servers', async () => {
    const { diagnostics } = await runLint(
      config(['codex-cli']),
      canonicalWithMcp({
        remote: {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: {},
          env: {},
        },
      }),
      TEST_DIR,
    );

    expect(diagnostics).toContainEqual({
      level: 'warning',
      file: '.agentsbridge/mcp.json',
      target: 'codex-cli',
      message:
        'MCP server "remote" uses http transport; codex-cli only generates stdio MCP servers.',
    });
  });
});
