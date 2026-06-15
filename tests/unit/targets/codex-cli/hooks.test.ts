import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { descriptor } from '../../../../src/targets/codex-cli/index.js';
import { generateHooks } from '../../../../src/targets/codex-cli/generator.js';
import { importFromCodex } from '../../../../src/targets/codex-cli/importer.js';
import { importCodexHooks } from '../../../../src/targets/codex-cli/importer-hooks.js';
import type { ImportResult } from '../../../../src/core/types.js';

const TEST_DIR = join(tmpdir(), 'am-codex-hooks-test');

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

describe('generateHooks (codex-cli)', () => {
  it('generates command handlers and skips prompt handlers', () => {
    const results = generateHooks(
      canonicalWithHooks({
        PostToolUse: [
          { matcher: 'Write', type: 'command', command: 'prettier', timeout: 30 },
          { matcher: 'Edit', type: 'prompt', command: 'Review the edit' },
        ],
      }),
    );

    expect(results).toEqual([
      {
        path: '.codex/hooks.json',
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

  it('generates the same hooks.json path in global scope', async () => {
    const results = await generate({
      config: {
        version: 1,
        targets: ['codex-cli'],
        features: ['hooks'],
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      },
      canonical: canonicalWithHooks({
        Stop: [{ matcher: '.*', command: 'notify-send done', type: 'command' }],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    expect(results.map((result) => result.path)).toEqual(['.codex/hooks.json']);
  });

  it('does not generate hooks.json without supported command handlers', () => {
    expect(
      generateHooks(
        canonicalWithHooks({
          UserPromptSubmit: [{ matcher: '.*', type: 'prompt', command: 'Review this' }],
        }),
      ),
    ).toEqual([]);
  });

  it('returns empty when canonical hooks is null', () => {
    expect(generateHooks(canonicalWithHooks(null))).toEqual([]);
  });

  it('skips non-array hook event entries', () => {
    const results = generateHooks(
      canonicalWithHooks({
        PreToolUse: 'not-an-array' as unknown as CanonicalFiles['hooks'][string],
        PostToolUse: [{ matcher: 'Write', type: 'command', command: 'prettier' }],
      }),
    );
    expect(results).toEqual([
      {
        path: '.codex/hooks.json',
        content: JSON.stringify(
          {
            hooks: {
              PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier' }] }],
            },
          },
          null,
          2,
        ),
      },
    ]);
  });
});

describe('importFromCodex: hooks', () => {
  it.each(['project', 'global'] as const)(
    'imports command handlers and skips prompt or agent handlers in %s scope',
    async (scope) => {
      mkdirSync(join(TEST_DIR, '.codex'), { recursive: true });
      writeFileSync(
        join(TEST_DIR, '.codex/hooks.json'),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write',
                hooks: [
                  { type: 'command', command: 'prettier', timeout: 30 },
                  { type: 'prompt', prompt: 'Review this' },
                  { type: 'agent', agent: 'reviewer' },
                ],
              },
            ],
          },
        }),
      );

      const results = await importFromCodex(TEST_DIR, { scope });
      expect(results.filter((result) => result.feature === 'hooks')).toHaveLength(1);
      expect(results.find((result) => result.feature === 'hooks')?.toPath).toBe(
        '.agentsmesh/hooks.yaml',
      );
      const hooks = parseYaml(
        readFileSync(join(TEST_DIR, '.agentsmesh/hooks.yaml'), 'utf-8'),
      ) as Record<string, unknown>;
      expect(hooks).toEqual({
        PostToolUse: [{ matcher: 'Write', type: 'command', command: 'prettier', timeout: 30 }],
      });
    },
  );
});

describe('importCodexHooks — malformed input guards', () => {
  async function runImport(raw: string): Promise<ImportResult[]> {
    mkdirSync(join(TEST_DIR, '.codex'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.codex/hooks.json'), raw);
    const results: ImportResult[] = [];
    await importCodexHooks(TEST_DIR, results);
    return results;
  }

  it('returns nothing when there is no hooks.json', async () => {
    const results: ImportResult[] = [];
    await importCodexHooks(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('returns nothing for invalid JSON', async () => {
    expect(await runImport('{ not json')).toEqual([]);
  });

  it('returns nothing when parsed JSON is not an object', async () => {
    expect(await runImport(JSON.stringify('a string'))).toEqual([]);
  });

  it('returns nothing when parsed JSON is null', async () => {
    expect(await runImport('null')).toEqual([]);
  });

  it('returns nothing when hooks key is missing', async () => {
    expect(await runImport(JSON.stringify({ other: 1 }))).toEqual([]);
  });

  it('returns nothing when hooks is an array', async () => {
    expect(await runImport(JSON.stringify({ hooks: [] }))).toEqual([]);
  });

  it('skips events whose value is not an array', async () => {
    expect(await runImport(JSON.stringify({ hooks: { PreToolUse: 'nope' } }))).toEqual([]);
  });

  it('skips groups that are not objects and missing-hooks groups', async () => {
    const results = await runImport(
      JSON.stringify({ hooks: { PreToolUse: ['scalar', { matcher: 'Bash' }] } }),
    );
    expect(results).toEqual([]);
  });

  it('skips non-object raw hook entries', async () => {
    const results = await runImport(
      JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [null, 42] }] } }),
    );
    expect(results).toEqual([]);
  });

  it('defaults a missing matcher to "*" and keeps valid command hooks', async () => {
    const results = await runImport(
      JSON.stringify({
        hooks: {
          PostToolUse: [{ hooks: [{ type: 'command', command: 'fmt' }] }],
        },
      }),
    );
    expect(results.filter((r) => r.feature === 'hooks')).toHaveLength(1);
    const hooks = parseYaml(
      readFileSync(join(TEST_DIR, '.agentsmesh/hooks.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(hooks).toEqual({
      PostToolUse: [{ matcher: '*', type: 'command', command: 'fmt' }],
    });
  });
});

describe('codex-cli hook descriptor contract', () => {
  it('declares partial hook support with managed hooks.json detection', () => {
    expect(descriptor.capabilities).toMatchObject({
      hooks: 'partial',
      permissions: 'none',
    });
    expect(descriptor.globalSupport?.capabilities).toMatchObject({
      hooks: 'partial',
      permissions: 'none',
    });
    expect(descriptor.project.managedOutputs?.files).toContain('.codex/hooks.json');
    expect(descriptor.globalSupport?.layout.managedOutputs?.files).toContain('.codex/hooks.json');
    expect(descriptor.detectionPaths).toContain('.codex/hooks.json');
    expect(descriptor.globalSupport?.detectionPaths).toContain('.codex/hooks.json');
  });
});
