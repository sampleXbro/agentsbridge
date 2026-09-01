import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../../../src/core/generate/engine.js';
import { getTargetCapabilities } from '../../../../src/targets/catalog/builtin-targets.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { CONTINUE_SETTINGS } from '../../../../src/targets/continue/constants.js';

const TEST_DIR = join(tmpdir(), 'am-continue-generate-agents-hooks');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function makeConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['continue'],
    features: ['agents', 'hooks'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

function makeCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [
      {
        source: '/proj/.agentsmesh/agents/reviewer.md',
        name: 'reviewer',
        description: 'Reviews code',
        tools: ['Read'],
        disallowedTools: [],
        model: '',
        permissionMode: '',
        maxTurns: 0,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: 'You review code.',
      },
    ],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo pre' }] },
    ignore: [],
  };
}

describe('continue capabilities', () => {
  it('declares agents and hooks native at both scopes', () => {
    for (const scope of ['project', 'global'] as const) {
      const caps = getTargetCapabilities('continue', scope)!;
      expect(caps.agents.level).toBe('native');
      expect(caps.hooks.level).toBe('native');
    }
  });
});

describe('generate (continue) — agents and hooks', () => {
  it('emits exactly the project agent file and settings file', async () => {
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(),
      projectRoot: TEST_DIR,
      scope: 'project',
    });

    expect(results.map((r) => r.path).sort()).toEqual([
      '.continue/agents/reviewer.md',
      CONTINUE_SETTINGS,
    ]);
  });

  it('emits exactly the same agent file and settings file at global scope', async () => {
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    expect(results.map((r) => r.path).sort()).toEqual([
      '.continue/agents/reviewer.md',
      CONTINUE_SETTINGS,
    ]);
  });

  it('rewrites canonical references inside the agent body at both scopes', async () => {
    const canonical = makeCanonical();
    canonical.rules = [
      {
        source: '/proj/.agentsmesh/rules/typescript.md',
        root: false,
        targets: [],
        description: 'TS',
        globs: [],
        body: 'Strict.',
      },
    ];
    canonical.agents[0]!.body = 'See [rules](.agentsmesh/rules/typescript.md).';
    const config = { ...makeConfig(), features: ['rules', 'agents'] } as ValidatedConfig;

    for (const scope of ['project', 'global'] as const) {
      const results = await generate({ config, canonical, projectRoot: TEST_DIR, scope });
      const agentFile = results.find((r) => r.path === '.continue/agents/reviewer.md')!;
      expect(agentFile.content).toContain('[rules](../rules/typescript.md)');
      expect(agentFile.content).not.toContain('.agentsmesh/');
    }
  });

  it('folds hooks into an existing settings.json without touching other keys', async () => {
    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_SETTINGS),
      JSON.stringify({ description: 'my plugin', disableAllHooks: false }, null, 2),
    );

    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(),
      projectRoot: TEST_DIR,
      scope: 'project',
    });

    const settings = results.find((r) => r.path === CONTINUE_SETTINGS)!;
    expect(JSON.parse(settings.content)).toEqual({
      description: 'my plugin',
      disableAllHooks: false,
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo pre' }] }],
      },
    });
  });

  it('leaves a settings.json it cannot parse byte-for-byte intact', async () => {
    const broken = '{\n  "description": "my plugin",\n  "disableAllHooks": false,\n';
    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(join(TEST_DIR, CONTINUE_SETTINGS), broken);

    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(),
      projectRoot: TEST_DIR,
      scope: 'project',
    });

    expect(results.find((r) => r.path === CONTINUE_SETTINGS)!.content).toBe(broken);
  });
});
