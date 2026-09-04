import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { deepagentsCliScopeExtras } from '../../../../src/targets/deepagents-cli/scope-extras.js';
import {
  DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
  DEEPAGENTS_CLI_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/deepagents-cli/constants.js';

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

const FULL = makeCanonical({
  hooks: { SessionStart: [{ matcher: '', command: 'echo hi' }] },
  permissions: { allow: ['Bash(npm run test:*)'], deny: [] },
});

describe('deepagentsCliScopeExtras', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = join(
      tmpdir(),
      `deepagents-cli-scope-extras-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(projectRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns [] at project scope (both surfaces are global-only)', async () => {
    const results = await deepagentsCliScopeExtras(
      FULL,
      projectRoot,
      'project',
      new Set(['hooks', 'permissions']),
    );
    expect(results).toEqual([]);
  });

  it('emits both the hooks file and the config.toml at global scope', async () => {
    const results = await deepagentsCliScopeExtras(
      FULL,
      projectRoot,
      'global',
      new Set(['hooks', 'permissions']),
    );
    expect(results.map((r) => r.path)).toEqual([
      DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
      DEEPAGENTS_CLI_GLOBAL_CONFIG_FILE,
    ]);
  });

  it('emits only config.toml when hooks are disabled', async () => {
    const results = await deepagentsCliScopeExtras(
      FULL,
      projectRoot,
      'global',
      new Set(['permissions']),
    );
    expect(results.map((r) => r.path)).toEqual([DEEPAGENTS_CLI_GLOBAL_CONFIG_FILE]);
  });

  it('emits only the hooks file when permissions are disabled', async () => {
    const results = await deepagentsCliScopeExtras(FULL, projectRoot, 'global', new Set(['hooks']));
    expect(results.map((r) => r.path)).toEqual([DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE]);
  });

  it('returns [] at global scope when canonical has neither hooks nor permissions', async () => {
    const results = await deepagentsCliScopeExtras(
      makeCanonical(),
      projectRoot,
      'global',
      new Set(['hooks', 'permissions']),
    );
    expect(results).toEqual([]);
  });
});
