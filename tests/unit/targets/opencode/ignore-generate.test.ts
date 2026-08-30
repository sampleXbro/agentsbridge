import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import {
  OPENCODE_CONFIG_FILE,
  OPENCODE_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/opencode/constants.js';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'am-opencode-ignore-'));
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function canonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

function config(features: ValidatedConfig['features']): ValidatedConfig {
  return {
    version: 1,
    targets: ['opencode'],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

describe('generate — opencode ignore (project scope)', () => {
  it('writes permission.read/permission.edit deny rules to opencode.json', async () => {
    const results = await generate({
      config: config(['ignore']),
      canonical: canonical({ ignore: ['.env', 'dist/'] }),
      projectRoot: TEST_DIR,
    });
    expect(results.map((r) => r.path)).toEqual([OPENCODE_CONFIG_FILE]);
    expect(JSON.parse(results[0]!.content)).toEqual({
      permission: {
        read: { '*.env': 'deny', '*dist/*': 'deny' },
        edit: { '*.env': 'deny', '*dist/*': 'deny' },
      },
    });
  });

  it('preserves unrelated keys already present in opencode.json', async () => {
    writeFileSync(
      join(TEST_DIR, OPENCODE_CONFIG_FILE),
      JSON.stringify({ model: 'anthropic/claude', theme: 'dark' }, null, 2),
    );
    const results = await generate({
      config: config(['ignore']),
      canonical: canonical({ ignore: ['.env'] }),
      projectRoot: TEST_DIR,
    });
    expect(JSON.parse(results[0]!.content)).toEqual({
      model: 'anthropic/claude',
      theme: 'dark',
      permission: { read: { '*.env': 'deny' }, edit: { '*.env': 'deny' } },
    });
  });

  it('emits mcp, permissions and ignore into one opencode.json without clobbering', async () => {
    const results = await generate({
      config: config(['mcp', 'permissions', 'ignore']),
      canonical: canonical({
        ignore: ['.env'],
        permissions: { allow: [], deny: ['bash'], ask: [] },
        mcp: {
          mcpServers: {
            fs: { type: 'stdio', command: 'npx', args: ['-y', 'server-fs'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
    });
    expect(results.map((r) => r.path)).toEqual([OPENCODE_CONFIG_FILE]);
    expect(JSON.parse(results[0]!.content)).toEqual({
      mcp: { fs: { type: 'local', command: ['npx', '-y', 'server-fs'] } },
      permission: {
        bash: 'deny',
        read: { '*.env': 'deny' },
        edit: { '*.env': 'deny' },
      },
    });
  });

  it('writes nothing when canonical ignore is empty', async () => {
    const results = await generate({
      config: config(['ignore']),
      canonical: canonical(),
      projectRoot: TEST_DIR,
    });
    expect(results).toEqual([]);
  });
});

describe('generate — opencode ignore (global scope)', () => {
  it('writes the rules to .config/opencode/opencode.json', async () => {
    mkdirSync(join(TEST_DIR, '.config', 'opencode'), { recursive: true });
    const results = await generate({
      config: config(['ignore']),
      canonical: canonical({ ignore: ['.env'] }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });
    expect(results.map((r) => r.path)).toEqual([OPENCODE_GLOBAL_CONFIG_FILE]);
    expect(JSON.parse(results[0]!.content)).toEqual({
      permission: { read: { '*.env': 'deny' }, edit: { '*.env': 'deny' } },
    });
  });
});
