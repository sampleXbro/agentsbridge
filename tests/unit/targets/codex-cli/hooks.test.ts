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
