import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generateHooks, importContinueHooks } from '../../../../src/targets/continue/hooks.js';
import { lintHooks } from '../../../../src/targets/continue/lint.js';
import { CONTINUE_SETTINGS } from '../../../../src/targets/continue/constants.js';
import { importFromContinue } from '../../../../src/targets/continue/importer.js';

const TEST_DIR = join(tmpdir(), 'am-continue-hooks-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('generateHooks (continue)', () => {
  it('writes the Claude-compatible hooks key into .continue/settings.json', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: 'Bash', command: 'echo pre', timeout: 30 }],
          Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: 'Summarize.' }],
        },
      }),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(CONTINUE_SETTINGS);
    expect(JSON.parse(results[0]!.content)).toEqual({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo pre', timeout: 30 }] },
        ],
        Stop: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'Summarize.' }] }],
      },
    });
  });

  it('returns empty for null, empty, and textless hooks', () => {
    expect(generateHooks(makeCanonical())).toEqual([]);
    expect(generateHooks(makeCanonical({ hooks: {} }))).toEqual([]);
    expect(
      generateHooks(makeCanonical({ hooks: { PreToolUse: [{ matcher: 'Bash', command: '  ' }] } })),
    ).toEqual([]);
  });
});

describe('importContinueHooks', () => {
  it('imports the hooks key back into canonical hooks.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_SETTINGS),
      JSON.stringify({
        disableAllHooks: false,
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo pre', timeout: 30 }] },
          ],
        },
      }),
    );

    const results: Awaited<ReturnType<typeof importFromContinue>> = [];
    await importContinueHooks(TEST_DIR, results);

    expect(results).toEqual([
      {
        fromTool: 'continue',
        fromPath: join(TEST_DIR, CONTINUE_SETTINGS),
        toPath: '.agentsmesh/hooks.yaml',
        feature: 'hooks',
      },
    ]);
    expect(yamlParse(readFileSync(join(TEST_DIR, '.agentsmesh/hooks.yaml'), 'utf-8'))).toEqual({
      PreToolUse: [{ matcher: 'Bash', type: 'command', command: 'echo pre', timeout: 30 }],
    });
  });

  it('writes nothing when the file is missing, unparsable, or carries no hooks', async () => {
    const results: Awaited<ReturnType<typeof importFromContinue>> = [];
    await importContinueHooks(TEST_DIR, results);

    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(join(TEST_DIR, CONTINUE_SETTINGS), '{ broken');
    await importContinueHooks(TEST_DIR, results);

    writeFileSync(join(TEST_DIR, CONTINUE_SETTINGS), JSON.stringify({ hooks: [] }));
    await importContinueHooks(TEST_DIR, results);

    writeFileSync(join(TEST_DIR, CONTINUE_SETTINGS), JSON.stringify({ description: 'x' }));
    await importContinueHooks(TEST_DIR, results);

    expect(results).toEqual([]);
    expect(existsSync(join(TEST_DIR, '.agentsmesh/hooks.yaml'))).toBe(false);
  });

  it('is reached by importFromContinue at both scopes', async () => {
    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_SETTINGS),
      JSON.stringify({
        hooks: { Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo bye' }] }] },
      }),
    );

    for (const scope of ['project', 'global'] as const) {
      const results = await importFromContinue(TEST_DIR, { scope });
      expect(results.filter((r) => r.feature === 'hooks')).toHaveLength(1);
    }
  });
});

describe('lintHooks (continue)', () => {
  it('warns for events Continue never fires', () => {
    const diagnostics = lintHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '*', command: 'echo ok' }],
          NotAContinueEvent: [{ matcher: '*', command: 'echo nope' }],
        },
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ level: 'warning', target: 'continue' });
    expect(diagnostics[0]!.message).toContain('NotAContinueEvent');
  });

  it('stays silent for the full Continue event set and for empty hooks', () => {
    expect(
      lintHooks(
        makeCanonical({
          hooks: {
            PostToolUseFailure: [{ matcher: '*', command: 'echo a' }],
            PermissionRequest: [{ matcher: '*', command: 'echo b' }],
            WorktreeRemove: [{ matcher: '*', command: 'echo c' }],
            TeammateIdle: [{ matcher: '*', command: 'echo d' }],
          },
        }),
      ),
    ).toEqual([]);
    expect(lintHooks(makeCanonical())).toEqual([]);
  });
});
