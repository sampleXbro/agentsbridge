import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import { generate } from '../../../../src/core/generate/engine.js';
import { importFromWarp } from '../../../../src/targets/warp/importer.js';
import { WARP_GLOBAL_SETTINGS_FILE } from '../../../../src/targets/warp/constants.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles, Permissions } from '../../../../src/core/types.js';

const CANONICAL_PERMISSIONS = '.agentsmesh/permissions.yaml';

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

function writeSettings(root: string, lines: string[]): void {
  writeFileSync(join(root, WARP_GLOBAL_SETTINGS_FILE), lines.join('\n') + '\n', 'utf-8');
}

function readCanonical(root: string): Permissions {
  return parseYaml(readFileSync(join(root, CANONICAL_PERMISSIONS), 'utf-8')) as Permissions;
}

describe('warp global permissions import (~/.warp/settings.toml)', () => {
  it('imports [agents.profiles] back into canonical permissions', async () => {
    const root = tempRoot('perm-import');
    writeSettings(root, [
      '[agents.profiles]',
      'agent_mode_command_execution_allowlist = ["^git status(\\\\s.*)?$"]',
      'agent_mode_command_execution_denylist = ["rm -rf(\\\\s.*)?"]',
    ]);

    const results = await importFromWarp(root, { scope: 'global' });

    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeDefined();
    expect(permResult!.fromTool).toBe('warp');
    expect(permResult!.fromPath).toBe(join(root, WARP_GLOBAL_SETTINGS_FILE));
    expect(permResult!.toPath).toBe(CANONICAL_PERMISSIONS);
    expect(readCanonical(root)).toEqual({
      allow: ['Bash(git status:*)'],
      deny: ['Bash(rm -rf:*)'],
    });
    rmSync(root, { recursive: true, force: true });
  });

  it('does not import settings.toml at project scope', async () => {
    const root = tempRoot('perm-import-project');
    writeSettings(root, ['[agents.profiles]', 'agent_mode_command_execution_allowlist = ["^ls$"]']);

    const results = await importFromWarp(root, { scope: 'project' });

    expect(results.find((r) => r.feature === 'permissions')).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps a hand-written deny regex working through import then generate (W2)', async () => {
    const root = tempRoot('perm-user-regex');
    writeSettings(root, [
      '[agents.profiles]',
      'agent_mode_command_execution_denylist = ["rm -rf .*"]',
    ]);

    await importFromWarp(root, { scope: 'global' });
    expect(readCanonical(root).deny).toEqual(['Bash(rm -rf .*)']);

    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(readCanonical(root)),
      projectRoot: root,
      scope: 'global',
    });

    const profiles = (parseToml(results[0].content) as WarpSettings).agents!.profiles!;
    const denylist = profiles.agent_mode_command_execution_denylist as string[];
    expect(denylist).toEqual(['rm -rf .*']);
    expect(new RegExp(denylist[0]!).test('rm -rf /')).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it('preserves canonical ask and entries Warp cannot express (W6)', async () => {
    const root = tempRoot('perm-import-ask');
    writeFileSync(
      join(root, CANONICAL_PERMISSIONS),
      [
        'allow:',
        '  - Edit(src/**)',
        '  - Bash(stale:*)',
        'deny:',
        '  - Read(./.env)',
        'ask:',
        '  - Bash(git push:*)',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeSettings(root, ['[agents.profiles]', 'agent_mode_command_execution_allowlist = ["^ls$"]']);

    await importFromWarp(root, { scope: 'global' });

    expect(readCanonical(root)).toEqual({
      allow: ['Bash(ls)', 'Edit(src/**)'],
      deny: ['Read(./.env)'],
      ask: ['Bash(git push:*)'],
    });
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps the schema directive and comments in the canonical file', async () => {
    const root = tempRoot('perm-import-comments');
    writeFileSync(
      join(root, CANONICAL_PERMISSIONS),
      [
        '# yaml-language-server: $schema=https://agentsmesh.dev/schema/permissions.json',
        '# Tool permission allow/deny lists',
        'allow: []',
        'deny: []',
        'ask: []',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeSettings(root, ['[agents.profiles]', 'agent_mode_command_execution_allowlist = ["^ls$"]']);

    await importFromWarp(root, { scope: 'global' });

    const written = readFileSync(join(root, CANONICAL_PERMISSIONS), 'utf-8');
    expect(written).toContain('# yaml-language-server: $schema=');
    expect(written).toContain('# Tool permission allow/deny lists');
    expect(readCanonical(root)).toEqual({ allow: ['Bash(ls)'], deny: [], ask: [] });
    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips generate --global -> import --global without loss', async () => {
    const root = tempRoot('perm-rt');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical({
        allow: ['Bash(node build.js:*)', 'Read(./src/**)'],
        deny: ['Bash(rm -rf:*)'],
      }),
      projectRoot: root,
      scope: 'global',
    });
    writeFileSync(join(root, results[0].path), results[0].content, 'utf-8');

    await importFromWarp(root, { scope: 'global' });

    expect(readCanonical(root)).toEqual({
      allow: ['Bash(node build.js:*)', 'Read(./src/**)'],
      deny: ['Bash(rm -rf:*)'],
    });
    rmSync(root, { recursive: true, force: true });
  });
});
