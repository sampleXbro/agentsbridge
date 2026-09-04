import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, ImportResult } from '../../../../src/core/types.js';
import {
  generateDeepagentsCliGlobalPermissions,
  importDeepagentsCliGlobalPermissions,
} from '../../../../src/targets/deepagents-cli/global-permissions.js';
import { DEEPAGENTS_CLI_GLOBAL_CONFIG_FILE } from '../../../../src/targets/deepagents-cli/constants.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

function makeRoot(label: string): string {
  const root = join(
    tmpdir(),
    `deepagents-cli-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  return root;
}

function writeConfig(root: string, content: string): void {
  mkdirSync(join(root, '.deepagents'), { recursive: true });
  writeFileSync(join(root, DEEPAGENTS_CLI_GLOBAL_CONFIG_FILE), content, 'utf-8');
}

describe('generateDeepagentsCliGlobalPermissions', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = makeRoot('global-permissions');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('emits ~/.deepagents/config.toml with shell.allow_list and startup.mode', async () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Read', 'Bash(npm run test:*)'], deny: ['WebFetch'] },
    });

    const results = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['permissions']),
    );

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('deepagents-cli');
    expect(results[0].path).toBe('.deepagents/config.toml');
    expect(results[0].status).toBe('created');
    expect(parseToml(results[0].content)).toEqual({
      shell: { allow_list: ['npm run test'] },
      startup: { mode: 'manual' },
    });
  });

  it('returns [] when the permissions feature is disabled', async () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash(ls:*)'], deny: [] },
    });
    const results = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['hooks']),
    );
    expect(results).toEqual([]);
  });

  it('returns [] when canonical permissions are null', async () => {
    const results = await generateDeepagentsCliGlobalPermissions(
      makeCanonical(),
      projectRoot,
      new Set(['permissions']),
    );
    expect(results).toEqual([]);
  });

  it('returns [] when no allow entry maps to a shell command', async () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Read'], deny: ['Bash(curl:*)'], ask: ['Grep'] },
    });
    const results = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['permissions']),
    );
    expect(results).toEqual([]);
  });

  it('merges into an existing config.toml, preserving unrelated keys', async () => {
    writeConfig(
      projectRoot,
      'model = "claude-opus-4"\n\n[credentials]\napi_key = "sk-secret"\n\n[display]\ntheme = "dark"\n',
    );
    const canonical = makeCanonical({ permissions: { allow: ['Bash(ls:*)'], deny: [] } });

    const results = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['permissions']),
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('updated');
    expect(parseToml(results[0].content)).toEqual({
      model: 'claude-opus-4',
      credentials: { api_key: 'sk-secret' },
      display: { theme: 'dark' },
      shell: { allow_list: ['ls'] },
      startup: { mode: 'manual' },
    });
    expect(results[0].currentContent).toContain('sk-secret');
  });

  it('reports status "unchanged" when the merged content already matches', async () => {
    const canonical = makeCanonical({ permissions: { allow: ['Bash(ls:*)'], deny: [] } });
    const first = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['permissions']),
    );
    writeConfig(projectRoot, first[0].content);

    const second = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['permissions']),
    );
    expect(second[0].status).toBe('unchanged');
  });
});

describe('importDeepagentsCliGlobalPermissions', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = makeRoot('global-permissions-import');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports shell.allow_list into canonical permissions.yaml', async () => {
    writeConfig(
      projectRoot,
      '[shell]\nallow_list = [ "npm run test" ]\n\n[startup]\nmode = "manual"\n',
    );
    const results: ImportResult[] = [];

    await importDeepagentsCliGlobalPermissions(projectRoot, results);

    expect(results).toHaveLength(1);
    expect(results[0].fromTool).toBe('deepagents-cli');
    expect(results[0].feature).toBe('permissions');
    expect(results[0].toPath).toBe('.agentsmesh/permissions.yaml');
    const destPath = join(projectRoot, '.agentsmesh', 'permissions.yaml');
    expect(existsSync(destPath)).toBe(true);
    expect(parseYaml(readFileSync(destPath, 'utf-8'))).toEqual({
      allow: ['Bash(npm run test:*)'],
      deny: [],
    });
  });

  it('does nothing when config.toml does not exist', async () => {
    const results: ImportResult[] = [];
    await importDeepagentsCliGlobalPermissions(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('does nothing when config.toml has no shell allow list', async () => {
    writeConfig(projectRoot, '[startup]\nmode = "yolo"\n');
    const results: ImportResult[] = [];
    await importDeepagentsCliGlobalPermissions(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('does nothing when config.toml is malformed', async () => {
    writeConfig(projectRoot, '[[[bad');
    const results: ImportResult[] = [];
    await importDeepagentsCliGlobalPermissions(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('round-trips generated content back to the canonical allow list', async () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash(npm run test:*)', 'Bash(git status:*)'], deny: [] },
    });
    const generated = await generateDeepagentsCliGlobalPermissions(
      canonical,
      projectRoot,
      new Set(['permissions']),
    );
    writeConfig(projectRoot, generated[0].content);

    const results: ImportResult[] = [];
    await importDeepagentsCliGlobalPermissions(projectRoot, results);

    const imported = parseYaml(
      readFileSync(join(projectRoot, '.agentsmesh', 'permissions.yaml'), 'utf-8'),
    ) as { allow: string[] };
    expect(imported.allow).toEqual(['Bash(npm run test:*)', 'Bash(git status:*)']);
  });
});
