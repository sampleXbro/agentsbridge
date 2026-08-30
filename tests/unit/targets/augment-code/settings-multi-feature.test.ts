/**
 * `.augment/settings.json` is written for mcp, hooks and permissions in the
 * same generate pass. Every enabled feature must survive into the final file.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { AUGMENT_CODE_SETTINGS_FILE } from '../../../../src/targets/augment-code/constants.js';

const TEST_DIR = join(tmpdir(), 'am-augment-settings-multi');

function canonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx', args: ['x'] } } },
    permissions: { allow: ['view'], deny: ['remove-files'], ask: ['launch-process'] },
    hooks: { PreToolUse: [{ matcher: 'launch-process', command: 'echo hi' }] },
    ignore: [],
  };
}

function config(features: ValidatedConfig['features']): ValidatedConfig {
  return {
    version: 1,
    targets: ['augment-code'],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

async function settings(
  features: ValidatedConfig['features'],
): Promise<Record<string, unknown> & { path: string }> {
  const results = await generate({
    config: config(features),
    canonical: canonical(),
    projectRoot: TEST_DIR,
  });
  const out = results.find((r) => r.path === AUGMENT_CODE_SETTINGS_FILE);
  if (!out) throw new Error(`no result for ${AUGMENT_CODE_SETTINGS_FILE}`);
  return { ...(JSON.parse(out.content) as Record<string, unknown>), path: out.path };
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('generate — augment-code settings.json carries every enabled feature', () => {
  it('keeps mcpServers, hooks and toolPermissions in the same file', async () => {
    const parsed = await settings(['mcp', 'hooks', 'permissions']);
    expect(parsed.path).toBe('.augment/settings.json');
    expect(parsed.mcpServers).toEqual({ srv: { type: 'stdio', command: 'npx', args: ['x'] } });
    expect(parsed.hooks).toEqual({
      PreToolUse: [{ matcher: 'launch-process', hooks: [{ type: 'command', command: 'echo hi' }] }],
    });
    expect(parsed.toolPermissions).toEqual([
      { toolName: 'view', permission: { type: 'allow' } },
      { toolName: 'remove-files', permission: { type: 'deny' } },
      { toolName: 'launch-process', permission: { type: 'ask-user' } },
    ]);
  });

  it('emits toolPermissions when permissions is the only enabled feature', async () => {
    const parsed = await settings(['permissions']);
    expect(Object.keys(parsed).filter((k) => k !== 'path')).toEqual(['toolPermissions']);
  });

  it('drops toolPermissions when permissions is disabled', async () => {
    const parsed = await settings(['mcp', 'hooks']);
    expect(parsed).not.toHaveProperty('toolPermissions');
  });

  it('preserves unmanaged keys already present in the file', async () => {
    mkdirSync(join(TEST_DIR, '.augment'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, AUGMENT_CODE_SETTINGS_FILE),
      JSON.stringify({ someUserKey: 'keep me' }),
    );
    const parsed = await settings(['mcp', 'hooks', 'permissions']);
    expect(parsed.someUserKey).toBe('keep me');
    expect(parsed).toHaveProperty('toolPermissions');
    expect(parsed).toHaveProperty('mcpServers');
    expect(parsed).toHaveProperty('hooks');
  });
});
