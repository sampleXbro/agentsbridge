import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cursorHooksToCanonical,
  importIgnore,
  importSettings,
} from '../../../../src/targets/cursor/settings-helpers.js';
import type { ImportResult } from '../../../../src/core/result-types.js';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-cursor-extra-'));
});
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('cursorHooksToCanonical — uncovered branches', () => {
  it('skips entries when type=command and getHookCommand falls back to prompt', () => {
    const hooks = cursorHooksToCanonical({
      Foo: [
        {
          matcher: '*',
          hooks: [{ type: 'command', prompt: 'fallback prompt' }],
        },
      ],
    });
    // type='command' falls back to prompt when no command — this also exercises the 'command || prompt' branch
    expect(hooks).toEqual({
      Foo: [{ matcher: '*', type: 'command', command: 'fallback prompt' }],
    });
  });

  it('keeps timeout when number, omits when not number', () => {
    const hooks = cursorHooksToCanonical({
      X: [
        {
          matcher: '*',
          hooks: [
            { type: 'command', command: 'a', timeout: 5 },
            { type: 'command', command: 'b', timeout: '10' },
          ],
        },
      ],
    });
    expect(hooks.X).toEqual([
      { matcher: '*', type: 'command', command: 'a', timeout: 5 },
      { matcher: '*', type: 'command', command: 'b' },
    ]);
  });

  it('falls back to empty hooks when e.hooks is not array', () => {
    const hooks = cursorHooksToCanonical({
      X: [{ matcher: '*', hooks: 'not array' }],
    });
    expect(hooks).toEqual({});
  });

  it('skips matcher when not string', () => {
    const hooks = cursorHooksToCanonical({
      X: [{ matcher: 42, hooks: [{ type: 'command', command: 'a' }] }],
    });
    expect(hooks).toEqual({});
  });
});

describe('importSettings — uncovered branches', () => {
  it('returns silently when settings.json is missing', async () => {
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
  });

  it('handles invalid JSON in settings.json (no throw)', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursor', 'settings.json'), '{invalid');
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
  });

  it('skips permissions when rawPerms is array (not object)', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursor', 'settings.json'), JSON.stringify({ permissions: ['Read'] }));
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.filter((r) => r.feature === 'permissions')).toEqual([]);
  });

  it('skips permissions when allow and deny are both empty', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({ permissions: { allow: [], deny: [] } }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.filter((r) => r.feature === 'permissions')).toEqual([]);
  });

  it('skips permissions when allow/deny are non-array', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({ permissions: { allow: 'no', deny: 7 } }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.filter((r) => r.feature === 'permissions')).toEqual([]);
  });

  it('skips hooks from settings when rawHooks is array (not object)', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({ hooks: [{ matcher: '*' }] }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.filter((r) => r.feature === 'hooks')).toEqual([]);
  });

  it('skips hooks from settings when canonical hooks is empty (matcher missing)', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({
        hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'a' }] }] },
      }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.filter((r) => r.feature === 'hooks')).toEqual([]);
  });

  it('handles hooks.json with no hooks key gracefully', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursor', 'hooks.json'), JSON.stringify({}));
    writeFileSync(join(dir, '.cursor', 'settings.json'), JSON.stringify({}));
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
  });

  it('handles hooks.json with empty canonical (no valid entries)', async () => {
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursor', 'hooks.json'), JSON.stringify({ hooks: { Foo: [] } }));
    writeFileSync(join(dir, '.cursor', 'settings.json'), JSON.stringify({}));
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
  });
});

describe('importIgnore — uncovered branches', () => {
  it('returns silently when no ignore files exist', async () => {
    const results: ImportResult[] = [];
    await importIgnore(dir, results);
    expect(results).toEqual([]);
  });

  it('handles only .cursorindexingignore present', async () => {
    writeFileSync(join(dir, '.cursorindexingignore'), 'dist\n');
    const results: ImportResult[] = [];
    await importIgnore(dir, results);
    expect(results).toHaveLength(1);
    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe('dist\n');
  });

  it('returns silently when ignore files exist but contain only blank lines', async () => {
    writeFileSync(join(dir, '.cursorignore'), '\n\n   \n');
    const results: ImportResult[] = [];
    await importIgnore(dir, results);
    expect(results).toEqual([]);
  });
});
