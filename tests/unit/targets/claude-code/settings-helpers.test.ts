import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  claudeHooksToCanonical,
  importMcpJson,
  importSettings,
} from '../../../../src/targets/claude-code/settings-helpers.js';

describe('claude settings helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-claude-settings-'));
    tempDirs.push(dir);
    return dir;
  }

  it('normalizes Claude hooks and drops invalid matcher or hook entries', () => {
    const hooks = claudeHooksToCanonical({
      PostToolUse: [
        {
          matcher: '*',
          hooks: [
            { type: 'command', command: 'pnpm lint', timeout: 10 },
            { type: 'prompt', command: 'Fallback prompt text' },
            { type: 'command' },
          ],
        },
        { matcher: '', hooks: [{ type: 'command', command: 'skip' }] },
      ],
      Other: {},
    });

    expect(hooks).toEqual({
      PostToolUse: [
        { matcher: '*', type: 'command', command: 'pnpm lint', timeout: 10 },
        { matcher: '*', type: 'prompt', command: 'Fallback prompt text' },
      ],
    });
  });

  it('imports .mcp.json when it contains mcpServers and ignores malformed json', async () => {
    const invalidDir = createTempDir();
    mkdirSync(invalidDir, { recursive: true });
    writeFileSync(join(invalidDir, '.mcp.json'), '{invalid');

    const invalidResults: Array<{ feature: string }> = [];
    await importMcpJson(invalidDir, invalidResults);
    expect(invalidResults).toEqual([]);

    const dir = createTempDir();
    writeFileSync(
      join(dir, '.mcp.json'),
      JSON.stringify({ mcpServers: { docs: { command: 'npx', args: ['-y'] } } }),
    );

    const results: Array<{ feature: string; toPath: string }> = [];
    await importMcpJson(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8')).toContain('"docs"');
  });

  it('imports settings mcp, permissions, and hooks, but skips mcp when already imported', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify(
        {
          mcpServers: { docs: { command: 'npx' } },
          permissions: { allow: ['Read'], deny: ['Bash', 7] },
          hooks: {
            PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'pnpm test' }] }],
          },
        },
        null,
        2,
      ),
    );

    const firstResults: Array<{ feature: string; toPath: string }> = [];
    await importSettings(dir, firstResults);
    expect(firstResults.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'mcp', toPath: '.agentsmesh/mcp.json' },
      { feature: 'permissions', toPath: '.agentsmesh/permissions.yaml' },
      { feature: 'hooks', toPath: '.agentsmesh/hooks.yaml' },
    ]);

    const secondResults = [...firstResults];
    await importSettings(dir, secondResults);
    expect(secondResults.filter((result) => result.feature === 'mcp')).toHaveLength(1);
    expect(readFileSync(join(dir, '.agentsmesh', 'hooks.yaml'), 'utf-8')).toContain('pnpm test');
  });
});
