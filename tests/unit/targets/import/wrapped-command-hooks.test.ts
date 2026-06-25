import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, ImportResult } from '../../../../src/core/types.js';
import {
  buildWrappedCommandHooks,
  importWrappedCommandHooks,
} from '../../../../src/targets/import/wrapped-command-hooks.js';

const TEST_DIR = join(tmpdir(), 'am-wrapped-hooks-test');
const HOOKS_FILE = '.factory/hooks.json';
const CANONICAL_HOOKS = '.agentsmesh/hooks.yaml';

function canonicalWithHooks(hooks: CanonicalFiles['hooks']): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks,
    ignore: [],
  };
}

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('buildWrappedCommandHooks', () => {
  it('wraps command hooks under a top-level "hooks" key at the given path', () => {
    const results = buildWrappedCommandHooks(
      canonicalWithHooks({
        PostToolUse: [
          { matcher: 'Write', type: 'command', command: 'prettier', timeout: 30 },
          { matcher: 'Edit', type: 'prompt', command: 'Review the edit' },
        ],
      }),
      HOOKS_FILE,
    );

    expect(results).toEqual([
      {
        path: HOOKS_FILE,
        content: JSON.stringify(
          {
            hooks: {
              PostToolUse: [
                {
                  matcher: 'Write',
                  hooks: [{ type: 'command', command: 'prettier', timeout: 30 }],
                },
              ],
            },
          },
          null,
          2,
        ),
      },
    ]);
  });

  it('returns [] when canonical hooks is null', () => {
    expect(buildWrappedCommandHooks(canonicalWithHooks(null), HOOKS_FILE)).toEqual([]);
  });

  it('returns [] when only prompt handlers are present', () => {
    expect(
      buildWrappedCommandHooks(
        canonicalWithHooks({
          UserPromptSubmit: [{ matcher: '.*', type: 'prompt', command: 'Review this' }],
        }),
        HOOKS_FILE,
      ),
    ).toEqual([]);
  });
});

describe('importWrappedCommandHooks', () => {
  async function runImport(raw: string): Promise<ImportResult[]> {
    mkdirSync(join(TEST_DIR, '.factory'), { recursive: true });
    writeFileSync(join(TEST_DIR, HOOKS_FILE), raw);
    const results: ImportResult[] = [];
    await importWrappedCommandHooks({
      projectRoot: TEST_DIR,
      hooksFile: HOOKS_FILE,
      canonicalHooksPath: CANONICAL_HOOKS,
      targetName: 'factory-droid',
      results,
    });
    return results;
  }

  it('reads parsed.hooks and writes canonical YAML (command-only)', async () => {
    const results = await runImport(
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'prettier', timeout: 30 },
                { type: 'prompt', prompt: 'Review this' },
              ],
            },
          ],
        },
      }),
    );

    const hooksResult = results.find((r) => r.feature === 'hooks');
    expect(hooksResult).toBeDefined();
    expect(hooksResult!.fromTool).toBe('factory-droid');
    expect(hooksResult!.toPath).toBe(CANONICAL_HOOKS);
    const hooks = parseYaml(readFileSync(join(TEST_DIR, CANONICAL_HOOKS), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(hooks).toEqual({
      PostToolUse: [{ matcher: 'Write', type: 'command', command: 'prettier', timeout: 30 }],
    });
  });

  it('returns nothing for the bare (unwrapped) Claude Code shape', async () => {
    expect(
      await runImport(
        JSON.stringify({
          PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'x' }] }],
        }),
      ),
    ).toEqual([]);
  });

  it('returns nothing for invalid JSON', async () => {
    expect(await runImport('{ not json')).toEqual([]);
  });

  it('defaults a missing matcher to "*"', async () => {
    await runImport(
      JSON.stringify({
        hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'fmt' }] }] },
      }),
    );
    const hooks = parseYaml(readFileSync(join(TEST_DIR, CANONICAL_HOOKS), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(hooks).toEqual({ PostToolUse: [{ matcher: '*', type: 'command', command: 'fmt' }] });
  });
});
