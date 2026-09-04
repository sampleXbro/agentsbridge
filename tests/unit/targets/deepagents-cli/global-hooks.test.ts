import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateDeepagentsCliGlobalHooks,
  importDeepagentsCliGlobalHooks,
} from '../../../../src/targets/deepagents-cli/global-hooks.js';
import { DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE } from '../../../../src/targets/deepagents-cli/constants.js';

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

describe('generateDeepagentsCliGlobalHooks', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = join(
      tmpdir(),
      `deepagents-cli-global-hooks-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(projectRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns [] when hooks feature is disabled', async () => {
    const canonical = makeCanonical({
      hooks: { SessionStart: [{ matcher: '', command: 'echo hi' }] },
    });
    const results = await generateDeepagentsCliGlobalHooks(canonical, projectRoot, new Set());
    expect(results).toEqual([]);
  });

  it('returns [] when canonical.hooks is null', async () => {
    const results = await generateDeepagentsCliGlobalHooks(
      makeCanonical(),
      projectRoot,
      new Set(['hooks']),
    );
    expect(results).toEqual([]);
  });

  it('returns [] when every canonical event is unmapped', async () => {
    const canonical = makeCanonical({ hooks: { PreToolUse: [{ matcher: '*', command: 'a' }] } });
    const results = await generateDeepagentsCliGlobalHooks(
      canonical,
      projectRoot,
      new Set(['hooks']),
    );
    expect(results).toEqual([]);
  });

  it('emits ~/.deepagents/hooks.json in the real Deep Agents array shape', async () => {
    const canonical = makeCanonical({
      hooks: { SessionStart: [{ matcher: '', command: 'echo hi' }] },
    });
    const results = await generateDeepagentsCliGlobalHooks(
      canonical,
      projectRoot,
      new Set(['hooks']),
    );
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE);
    expect(results[0].status).toBe('created');
    const parsed = JSON.parse(results[0].content) as { hooks: unknown[] };
    expect(parsed.hooks).toEqual([
      { command: ['bash', '-c', 'echo hi'], events: ['session.start'] },
    ]);
  });

  it('reports status "updated" when file content differs from existing', async () => {
    mkdirSync(join(projectRoot, '.deepagents'), { recursive: true });
    writeFileSync(join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE), '{"hooks":[]}');
    const canonical = makeCanonical({
      hooks: { SessionStart: [{ matcher: '', command: 'echo hi' }] },
    });
    const results = await generateDeepagentsCliGlobalHooks(
      canonical,
      projectRoot,
      new Set(['hooks']),
    );
    expect(results[0].status).toBe('updated');
  });
});

describe('importDeepagentsCliGlobalHooks', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = join(
      tmpdir(),
      `deepagents-cli-global-hooks-import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(projectRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports ~/.deepagents/hooks.json into canonical hooks.yaml', async () => {
    mkdirSync(join(projectRoot, '.deepagents'), { recursive: true });
    writeFileSync(
      join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE),
      JSON.stringify({
        hooks: [{ command: ['bash', '-c', 'echo hi'], events: ['session.start'] }],
      }),
    );

    const results: import('../../../../src/core/types.js').ImportResult[] = [];
    await importDeepagentsCliGlobalHooks(projectRoot, results);

    expect(results).toHaveLength(1);
    expect(results[0].toPath).toBe('.agentsmesh/hooks.yaml');
    expect(results[0].fromTool).toBe('deepagents-cli');
    const destPath = join(projectRoot, '.agentsmesh', 'hooks.yaml');
    expect(existsSync(destPath)).toBe(true);
    expect(readFileSync(destPath, 'utf-8')).toContain('SessionStart');
  });

  it('does nothing when the hooks file does not exist', async () => {
    const results: import('../../../../src/core/types.js').ImportResult[] = [];
    await importDeepagentsCliGlobalHooks(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('does nothing when the hooks file is malformed JSON', async () => {
    mkdirSync(join(projectRoot, '.deepagents'), { recursive: true });
    writeFileSync(join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE), '{ broken');
    const results: import('../../../../src/core/types.js').ImportResult[] = [];
    await importDeepagentsCliGlobalHooks(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('does nothing when the parsed JSON top level is null', async () => {
    mkdirSync(join(projectRoot, '.deepagents'), { recursive: true });
    writeFileSync(join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE), 'null');
    const results: import('../../../../src/core/types.js').ImportResult[] = [];
    await importDeepagentsCliGlobalHooks(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('does nothing when the parsed JSON top level is a primitive (not an object)', async () => {
    mkdirSync(join(projectRoot, '.deepagents'), { recursive: true });
    writeFileSync(join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE), '42');
    const results: import('../../../../src/core/types.js').ImportResult[] = [];
    await importDeepagentsCliGlobalHooks(projectRoot, results);
    expect(results).toHaveLength(0);
  });

  it('does nothing when no events map to a canonical equivalent', async () => {
    mkdirSync(join(projectRoot, '.deepagents'), { recursive: true });
    writeFileSync(
      join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE),
      JSON.stringify({ hooks: [{ command: ['echo', 'hi'], events: ['tool.error'] }] }),
    );
    const results: import('../../../../src/core/types.js').ImportResult[] = [];
    await importDeepagentsCliGlobalHooks(projectRoot, results);
    expect(results).toHaveLength(0);
  });
});
