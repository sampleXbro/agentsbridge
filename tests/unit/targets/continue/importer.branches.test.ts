import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { importFromContinue } from '../../../../src/targets/continue/importer.js';
import {
  CONTINUE_MCP_DIR,
  CONTINUE_PROMPTS_DIR,
} from '../../../../src/targets/continue/constants.js';

describe('continue importer branch coverage', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-continue-branches-'));
    tempDirs.push(dir);
    return dir;
  }

  it('keeps nested prompt folders while renaming commands from frontmatter metadata', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, CONTINUE_PROMPTS_DIR, 'git'), { recursive: true });
    writeFileSync(
      join(dir, CONTINUE_PROMPTS_DIR, 'git', 'review.md'),
      [
        '---',
        'x-agentsmesh-kind: command',
        'x-agentsmesh-name: commit',
        '---',
        '',
        'Commit the current worktree.',
      ].join('\n'),
    );

    const results = await importFromContinue(dir);

    expect(results).toContainEqual({
      fromTool: 'continue',
      fromPath: join(dir, CONTINUE_PROMPTS_DIR, 'git', 'review.md'),
      toPath: '.agentsmesh/commands/git/commit.md',
      feature: 'commands',
    });
    expect(
      readFileSync(join(dir, '.agentsmesh', 'commands', 'git', 'commit.md'), 'utf-8'),
    ).toContain('description: ""');
  });

  it('merges valid MCP servers from yaml and json files and ignores invalid entries', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, CONTINUE_MCP_DIR), { recursive: true });
    writeFileSync(
      join(dir, CONTINUE_MCP_DIR, 'servers.yaml'),
      [
        'mcpServers:',
        '  docs:',
        '    command: npx',
        '    args: "@docs/mcp"',
        '    env:',
        '      TOKEN: abc',
        '  invalid:',
        '    args:',
        '      - missing-command',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, CONTINUE_MCP_DIR, 'override.json'),
      JSON.stringify(
        {
          mcpServers: {
            docs: { command: 'uvx', type: 'stdio', description: 'Override docs' },
            local: { command: 'node', args: ['server.js'] },
          },
        },
        null,
        2,
      ),
    );

    const results = await importFromContinue(dir);
    const mcpJson = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');

    expect(results.filter((result) => result.feature === 'mcp')).toHaveLength(2);
    expect(mcpJson).toContain('"docs"');
    expect(mcpJson).toContain('"docs"');
    expect(mcpJson).toContain('"local"');
    expect(mcpJson).not.toContain('"invalid"');
  });
});
