import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import { generate } from '../../../../src/core/generate/engine.js';
import { WARP_GLOBAL_SETTINGS_FILE } from '../../../../src/targets/warp/constants.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles, GenerateResult, Permissions } from '../../../../src/core/types.js';

interface WarpSettings {
  agents?: { profiles?: Record<string, unknown>; [key: string]: unknown };
  [key: string]: unknown;
}

function makeCanonical(permissions: Permissions | null): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions,
    hooks: null,
    ignore: [],
  };
}

function makeConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['warp'],
    features: ['permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

function tempRoot(label: string): string {
  const root = join(tmpdir(), `warp-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  mkdirSync(join(root, '.warp'), { recursive: true });
  return root;
}

async function generateGlobal(
  root: string,
  permissions: Permissions | null,
): Promise<GenerateResult[]> {
  return generate({
    config: makeConfig(),
    canonical: makeCanonical(permissions),
    projectRoot: root,
    scope: 'global',
  });
}

function profilesOf(content: string): Record<string, unknown> {
  return (parseToml(content) as WarpSettings).agents!.profiles!;
}

const PERMISSIONS: Permissions = {
  allow: ['Bash(git status:*)', 'Read(./src/**)'],
  deny: ['Bash(rm -rf:*)'],
  ask: ['Bash(git push:*)'],
};

describe('warp global permissions (~/.warp/settings.toml)', () => {
  it('emits exactly settings.toml with the permission keys under [agents.profiles]', async () => {
    const root = tempRoot('perm-global');
    const results = await generateGlobal(root, PERMISSIONS);

    expect(results.map((r) => r.path)).toEqual([WARP_GLOBAL_SETTINGS_FILE]);
    const parsed = parseToml(results[0].content) as WarpSettings;
    expect(Object.keys(parsed)).toEqual(['agents']);
    expect(parsed.agents!.profiles).toEqual({
      agent_mode_command_execution_allowlist: ['^git status(\\s.*)?$'],
      agent_mode_command_execution_denylist: ['rm -rf(\\s.*)?'],
      agent_mode_coding_file_read_allowlist: ['./src/**'],
      agent_mode_coding_permissions: 'allow_reading_specific_files',
    });
    rmSync(root, { recursive: true, force: true });
  });

  it('merges into an existing settings.toml instead of rewriting it', async () => {
    const root = tempRoot('perm-merge');
    writeFileSync(
      join(root, WARP_GLOBAL_SETTINGS_FILE),
      [
        'theme = "Dracula"',
        '[agents.profiles]',
        'agent_mode_execute_readonly_commands = true',
        '',
      ].join('\n'),
      'utf-8',
    );

    const results = await generateGlobal(root, { allow: ['Bash(git status:*)'], deny: [] });

    const parsed = parseToml(results[0].content) as WarpSettings;
    expect(parsed.theme).toBe('Dracula');
    expect(parsed.agents!.profiles!.agent_mode_execute_readonly_commands).toBe(true);
    expect(results[0].status).toBe('updated');
    rmSync(root, { recursive: true, force: true });
  });

  it('drops a revoked entry on the next generate (W1)', async () => {
    const root = tempRoot('perm-revoke');
    const granted = await generateGlobal(root, { allow: ['Bash(curl:*)'], deny: [] });
    writeFileSync(join(root, granted[0].path), granted[0].content, 'utf-8');

    const revoked = await generateGlobal(root, { allow: ['Read(./src/**)'], deny: [] });

    expect(profilesOf(revoked[0].content).agent_mode_command_execution_allowlist).toEqual([]);
    expect(revoked[0].status).toBe('updated');
    rmSync(root, { recursive: true, force: true });
  });

  it('reports drift and clears the owned keys when everything is revoked (W1)', async () => {
    const root = tempRoot('perm-revoke-all');
    const granted = await generateGlobal(root, PERMISSIONS);
    writeFileSync(join(root, granted[0].path), granted[0].content, 'utf-8');

    const cleared = await generateGlobal(root, { allow: [], deny: [], ask: [] });

    expect(cleared.map((r) => r.path)).toEqual([WARP_GLOBAL_SETTINGS_FILE]);
    expect(cleared[0].status).toBe('updated');
    expect(profilesOf(cleared[0].content)).toEqual({
      agent_mode_command_execution_allowlist: [],
    });
    rmSync(root, { recursive: true, force: true });
  });

  it('writes nothing when there is no canonical permissions file at all', async () => {
    const root = tempRoot('perm-none');
    expect(await generateGlobal(root, null)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it('does not disable Warp defaults for a freshly initialised empty permissions.yaml', async () => {
    const root = tempRoot('perm-fresh');
    expect(await generateGlobal(root, { allow: [], deny: [], ask: [] })).toEqual([]);

    writeFileSync(
      join(root, WARP_GLOBAL_SETTINGS_FILE),
      '[agents.profiles]\nagent_mode_execute_readonly_commands = true\n',
      'utf-8',
    );
    expect(await generateGlobal(root, { allow: [], deny: [], ask: [] })).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it('never emits settings.toml at project scope', async () => {
    const root = tempRoot('perm-project');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(PERMISSIONS),
      projectRoot: root,
      scope: 'project',
    });

    expect(results).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});
