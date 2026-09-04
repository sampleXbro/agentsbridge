/**
 * Regression: the six features routed through `generateFeature` (rules, commands,
 * agents, skills, mcp, ignore) used to emit WITHOUT the shared merge policy, so a
 * target whose output lands in a SHARED user config file had that whole file
 * replaced from canonical. Confirmed real-world loss: `~/.codex/config.toml`
 * (model / model_providers / shell_environment_policy / projects trust).
 *
 * Every assertion here reads the CONTENT RETURNED BY `generate()` — the CLI layer
 * is what writes to disk, so the returned result is the contract.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { generate } from '../../../../src/core/generate/engine.js';
import {
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { TargetLayoutScope } from '../../../../src/targets/catalog/target-descriptor.js';

const TEST_DIR = join(tmpdir(), 'am-shared-config-merge');

/** Canonical server, and the shape generators that pass it through verbatim emit. */
const SERVER = { type: 'stdio', command: 'npx', args: ['-y', 'fetch'], env: {} } as const;

function canonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers: { fetch: { ...SERVER, args: [...SERVER.args] } } },
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function config(target: string): ValidatedConfig {
  return {
    version: 1,
    targets: [target],
    features: ['mcp'],
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

async function generateOne(
  target: string,
  path: string,
  scope: TargetLayoutScope = 'project',
): Promise<string> {
  const results = await generate({
    config: config(target),
    canonical: canonical(),
    projectRoot: TEST_DIR,
    scope,
  });
  const matches = results.filter((r) => r.path === path);
  expect(matches).toHaveLength(1);
  return matches[0]!.content;
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('generate — shared user config files survive the generateFeature path', () => {
  it('codex-cli keeps model, model_providers, shell_environment_policy and projects trust', async () => {
    seed(
      '.codex/config.toml',
      [
        '# hand-written by the user',
        'model = "gpt-5"',
        'approval_policy = "on-request"',
        '',
        '[model_providers.openai]',
        'name = "OpenAI"',
        'base_url = "https://api.openai.com/v1"',
        '',
        '[shell_environment_policy]',
        'inherit = "core"',
        '',
        '[projects."/Users/me/work"]',
        'trust_level = "trusted"',
        '',
        '[mcp_servers.stale]',
        'command = "gone-from-canonical"',
        'args = []',
        '',
      ].join('\n'),
    );

    const content = await generateOne('codex-cli', '.codex/config.toml');

    expect(parseToml(content)).toEqual({
      model: 'gpt-5',
      approval_policy: 'on-request',
      model_providers: { openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1' } },
      shell_environment_policy: { inherit: 'core' },
      projects: { '/Users/me/work': { trust_level: 'trusted' } },
      mcp_servers: { fetch: { command: 'npx', args: ['-y', 'fetch'] } },
    });
    expect(content).toContain('# hand-written by the user');
  });

  it('crush keeps options.skills_paths and the rest of crush.json', async () => {
    seed(
      'crush.json',
      JSON.stringify({
        $schema: 'https://charm.land/crush.json',
        models: { large: { model: 'claude-opus' } },
        options: { skills_paths: ['~/skills'] },
      }),
    );

    const content = await generateOne('crush', 'crush.json');

    expect(JSON.parse(content)).toEqual({
      $schema: 'https://charm.land/crush.json',
      models: { large: { model: 'claude-opus' } },
      options: { skills_paths: ['~/skills'] },
      mcp: { fetch: SERVER },
    });
  });

  it('qwen-code keeps permissions, hooks and unrelated settings keys', async () => {
    seed(
      '.qwen/settings.json',
      JSON.stringify({
        theme: 'dark',
        selectedAuthType: 'oauth-personal',
        permissions: { allow: ['Read'] },
        hooks: { PreToolUse: [] },
      }),
    );

    const content = await generateOne('qwen-code', '.qwen/settings.json');

    expect(JSON.parse(content)).toEqual({
      theme: 'dark',
      selectedAuthType: 'oauth-personal',
      permissions: { allow: ['Read'] },
      hooks: { PreToolUse: [] },
      mcpServers: { fetch: SERVER },
    });
  });

  it('copilot keeps the .vscode/mcp.json inputs array and revokes removed servers', async () => {
    seed(
      '.vscode/mcp.json',
      JSON.stringify({
        inputs: [{ id: 'gh-token', type: 'promptString', password: true }],
        servers: { stale: { command: 'gone-from-canonical' } },
      }),
    );

    const content = await generateOne('copilot', '.vscode/mcp.json');

    expect(JSON.parse(content)).toEqual({
      inputs: [{ id: 'gh-token', type: 'promptString', password: true }],
      servers: { fetch: SERVER },
    });
  });

  it('claude-code global keeps ~/.claude.json account and project state', async () => {
    seed(
      '.claude.json',
      JSON.stringify({
        oauthAccount: { accountUuid: 'abc' },
        projects: { '/Users/me/work': { history: ['one'] } },
      }),
    );

    const content = await generateOne('claude-code', '.claude.json', 'global');

    expect(JSON.parse(content)).toEqual({
      oauthAccount: { accountUuid: 'abc' },
      projects: { '/Users/me/work': { history: ['one'] } },
      mcpServers: { fetch: SERVER },
    });
  });

  it('claude-code project keeps unrelated .mcp.json top-level keys', async () => {
    seed('.mcp.json', JSON.stringify({ $schema: 'https://example.test/mcp.json' }));

    const content = await generateOne('claude-code', '.mcp.json');

    expect(JSON.parse(content)).toEqual({
      $schema: 'https://example.test/mcp.json',
      mcpServers: { fetch: SERVER },
    });
  });
});

/**
 * Plugins are first-class: `mergeGeneratedOutputContent` is a TargetDescriptor
 * hook, so the widened `generateFeature` contract must reach a runtime-registered
 * PLUGIN descriptor exactly as it reaches a builtin one.
 */
describe('generate — plugin descriptor merge hook on the generateFeature path', () => {
  afterEach(() => resetRegistry());

  it('keeps a hand-written key in a plugin MCP output emitted by generateMcp', async () => {
    const mod: { descriptor: unknown } =
      await import('../../../fixtures/plugins/rich-plugin/index.js');
    registerTargetDescriptor(mod.descriptor as TargetDescriptor);
    seed('.rich/mcp.json', JSON.stringify({ keepMe: 'hand-written' }));

    const results = await generate({
      config: { ...config('rich-plugin'), targets: [], pluginTargets: ['rich-plugin'] },
      canonical: canonical(),
      projectRoot: TEST_DIR,
    });

    const matches = results.filter((r) => r.path === '.rich/mcp.json');
    expect(matches).toHaveLength(1);
    expect(JSON.parse(matches[0]!.content)).toEqual({
      keepMe: 'hand-written',
      mcpServers: { fetch: SERVER },
    });
  });
});
