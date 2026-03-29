import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cursorHooksToCanonical,
  importIgnore,
  importSettings,
} from '../../../../src/targets/cursor/settings-helpers.js';
import type { ImportResult } from '../../../../src/core/result-types.js';

describe('cursor settings helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-cursor-settings-'));
    tempDirs.push(dir);
    return dir;
  }

  it('normalizes Cursor hooks and ignores malformed entries', () => {
    const hooks = cursorHooksToCanonical({
      PreToolUse: [
        {
          matcher: 'src/**/*.ts',
          hooks: [
            { type: 'command', command: 'pnpm lint', timeout: 5 },
            { type: 'prompt', prompt: 'Ask for approval' },
            { type: 'command' },
          ],
        },
        { matcher: '', hooks: [{ type: 'command', command: 'skip' }] },
        null,
      ],
      Invalid: 'nope',
    });

    expect(hooks).toEqual({
      PreToolUse: [
        { matcher: 'src/**/*.ts', type: 'command', command: 'pnpm lint', timeout: 5 },
        { matcher: 'src/**/*.ts', type: 'prompt', command: 'Ask for approval' },
      ],
    });
  });

  it('prefers hooks.json for hooks while still importing settings permissions', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'pnpm lint' }] }],
        },
      }),
    );
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Read', 7], deny: ['Bash'] },
        hooks: {
          PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'pnpm test' }] }],
        },
      }),
    );

    const results: ImportResult[] = [];
    await importSettings(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'hooks', toPath: '.agentsmesh/hooks.yaml' },
      { feature: 'permissions', toPath: '.agentsmesh/permissions.yaml' },
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', 'hooks.yaml'), 'utf-8')).toContain('pnpm lint');
    expect(readFileSync(join(dir, '.agentsmesh', 'hooks.yaml'), 'utf-8')).not.toContain(
      'pnpm test',
    );
    expect(readFileSync(join(dir, '.agentsmesh', 'permissions.yaml'), 'utf-8')).toContain('Read');
  });

  it('falls back to settings hooks when hooks.json is absent or invalid', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursor', 'hooks.json'), '{invalid');
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'Summarize changes' }] }],
        },
      }),
    );

    const results: ImportResult[] = [];
    await importSettings(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'hooks', toPath: '.agentsmesh/hooks.yaml' },
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', 'hooks.yaml'), 'utf-8')).toContain(
      'Summarize changes',
    );
  });

  it('merges Cursor ignore files, removes duplicates, and skips blank lines', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursorignore'), 'dist\n\nnode_modules\n');
    writeFileSync(join(dir, '.cursorindexingignore'), 'node_modules\ncoverage\n');

    const results: ImportResult[] = [];
    await importIgnore(dir, results);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'ignore', toPath: '.agentsmesh/ignore' },
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe(
      'dist\nnode_modules\ncoverage\n',
    );
  });
});
