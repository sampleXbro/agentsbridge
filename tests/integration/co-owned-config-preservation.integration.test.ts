/**
 * Reproduction of the reported data loss, at the level the CLI actually runs:
 * generate -> write every result -> `cleanupStaleGeneratedOutputs`, twice.
 *
 *   run 1: features [mcp, rules]  -> the shared config gains agentsmesh's keys
 *   run 2: features [rules]       -> the run emits nothing for that path
 *
 * Before the fix, run 2 deleted the file outright (it is seeded stale from
 * `managedOutputs.files` and no longer appears in `expectedPaths`), taking the
 * user's own Codex model/provider config or Claude account state with it.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { generate } from '../../src/core/generate/engine.js';
import { cleanupStaleGeneratedOutputs } from '../../src/core/generate/stale-cleanup.js';
import type { CanonicalFiles, GenerateResult } from '../../src/core/types.js';
import type { ValidatedConfig } from '../../src/config/core/schema.js';
import type { TargetLayoutScope } from '../../src/targets/catalog/target-descriptor.js';

const TEST_DIR = join(tmpdir(), 'am-co-owned-preservation');

function canonical(): CanonicalFiles {
  return {
    rules: [
      {
        source: '_root.md',
        root: true,
        description: 'Root',
        body: 'Be careful.',
        globs: [],
        alwaysApply: true,
      } as unknown as CanonicalFiles['rules'][number],
    ],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers: { ctx: { type: 'stdio', command: 'npx', args: ['-y', 'ctx'], env: {} } } },
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function config(target: string, features: string[]): ValidatedConfig {
  return {
    version: 1,
    targets: [target],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function seed(relPath: string, content: string): void {
  const abs = join(TEST_DIR, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** One full CLI-shaped pass: generate, write results, evict stale outputs. */
async function runGeneratePass(
  target: string,
  features: string[],
  scope: TargetLayoutScope,
): Promise<GenerateResult[]> {
  const results = await generate({
    config: config(target, features),
    canonical: canonical(),
    projectRoot: TEST_DIR,
    scope,
  });
  for (const result of results) {
    const abs = join(TEST_DIR, result.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, result.content);
  }
  await cleanupStaleGeneratedOutputs({
    projectRoot: TEST_DIR,
    targets: [target],
    expectedPaths: results.map((result) => result.path),
    scope,
  });
  return results;
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('disabling a feature does not delete the co-owned config it wrote into', () => {
  it('keeps .codex/config.toml and every user key after mcp is disabled', async () => {
    seed(
      '.codex/config.toml',
      '# my config\nmodel = "gpt-5.4"\n\n[shell_environment_policy]\ninherit = "core"\n',
    );

    await runGeneratePass('codex-cli', ['mcp', 'rules'], 'project');
    const afterFirst = readFileSync(join(TEST_DIR, '.codex/config.toml'), 'utf8');
    expect(parseToml(afterFirst)).toMatchObject({
      model: 'gpt-5.4',
      shell_environment_policy: { inherit: 'core' },
      mcp_servers: { ctx: { command: 'npx' } },
    });

    await runGeneratePass('codex-cli', ['rules'], 'project');

    const configPath = join(TEST_DIR, '.codex/config.toml');
    expect(existsSync(configPath)).toBe(true);
    const afterSecond = readFileSync(configPath, 'utf8');
    expect(afterSecond).toContain('# my config');
    expect(parseToml(afterSecond)).toMatchObject({
      model: 'gpt-5.4',
      shell_environment_policy: { inherit: 'core' },
    });
  });

  it('keeps global .claude.json account state after mcp is disabled', async () => {
    seed(
      '.claude.json',
      JSON.stringify({
        oauthAccount: { accountUuid: 'abc' },
        projects: { '/Users/me/work': { history: ['one'] } },
      }),
    );

    await runGeneratePass('claude-code', ['mcp', 'rules'], 'global');
    expect(JSON.parse(readFileSync(join(TEST_DIR, '.claude.json'), 'utf8')).mcpServers).toEqual({
      ctx: { type: 'stdio', command: 'npx', args: ['-y', 'ctx'], env: {} },
    });

    await runGeneratePass('claude-code', ['rules'], 'global');

    const globalPath = join(TEST_DIR, '.claude.json');
    expect(existsSync(globalPath)).toBe(true);
    expect(JSON.parse(readFileSync(globalPath, 'utf8'))).toMatchObject({
      oauthAccount: { accountUuid: 'abc' },
      projects: { '/Users/me/work': { history: ['one'] } },
    });
  });
});
