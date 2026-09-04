/**
 * Repo-wide ownership invariant for `globalSupport.scopeExtras`.
 *
 * This is the oracle the previous two rounds of this bug did not have. Both
 * earlier invariant tests read `managedOutputs`, which says what stale cleanup
 * may DELETE — it says nothing about what a generator OVERWRITES. Three targets
 * therefore kept rewriting a user's tool config from canonical alone while every
 * ownership test in the repo stayed green.
 *
 * So this one drives the generators. It runs every registered scopeExtras with a
 * canonical file that exercises each feature and asserts that every path any of
 * them emits is accounted for by one of the three co-ownership mechanisms:
 *
 *   1. the descriptor's `mergeGeneratedOutputContent` claims it, or
 *      `mergeOutputContent`'s `SETTINGS_JSON_PATHS` fallback does;
 *   2. it is an agentsmesh-owned artifact, listed below with a reason;
 *   3. the generator merges internally, listed below with the citation that
 *      proves it reads the file it writes.
 *
 * Adding a row to either list is a deliberate act with a stated justification —
 * which is the point: a new scopeExtras path cannot be introduced silently.
 *
 * Known limit: generators that only emit when the file is already on disk (zed,
 * pi-agent, aider) contribute no path from an empty directory. All three are
 * merge-claimed by mechanism 1 anyway, so the gap does not hide anything today.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILTIN_TARGETS } from '../../../../src/targets/catalog/builtin-targets.js';
import { SETTINGS_JSON_PATHS } from '../../../../src/core/generate/settings.js';
import {
  getDescriptor,
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

/**
 * Paths agentsmesh owns outright: a rendered document or an agentsmesh-named
 * sidecar, with no user-authored region a merge could preserve.
 */
const AGENTSMESH_OWNED: readonly string[] = [
  // Per-entity rendered documents: the whole body is the canonical agent or
  // command, exactly like `.claude/agents/<name>.md`, which the shared policy
  // also replaces wholesale.
  'claude-code .claude/output-styles/reviewer.md',
  'claude-code .claude/output-styles/build.md',
  // Root-instruction compat mirrors: canonical rule prose, no config keys. Both
  // are declared root-instruction outputs of their target (`outputFamilies`).
  'copilot .copilot/AGENTS.md',
  'continue .continue/AGENTS.md',
  // agentsmesh's own hooks sidecar inside a dir agentsmesh creates; Copilot
  // loads every *.json there, so the user's hooks live in sibling files.
  'copilot .copilot/hooks/agentsmesh.json',
  // Wrapper scripts synthesised per canonical hook entry, inside the same dir.
  'copilot .copilot/hooks/scripts/sessionstart-0.sh',
  'copilot .copilot/hooks/scripts/pretooluse-0.sh',
  // The plugin fixture's scope marker, written into its own managed dir.
  'rich-plugin .rich/scope-info.txt',
];

/**
 * Paths whose generator reads the file it writes and folds canonical into it.
 * Each entry cites the read and the merge, so this list cannot become a way to
 * declare co-ownership without actually merging anything.
 */
const SELF_MERGED: readonly string[] = [
  // global-permissions.ts:91-92 reads the file and passes it to
  // `serializeAntigravitySettings`, which deletes only the three owned keys.
  'antigravity .gemini/antigravity-cli/settings.json',
  // global-mcp.ts:110-126 edits a yaml Document and rewrites only `extensions`,
  // keeping the entries it cannot represent (goose builtins).
  'goose .config/goose/config.yaml',
  // scope-extras.ts:26-27 -> permissions.ts:51-53 replaces only the `user`
  // category, keeping goose's own `smart_approve` cache.
  'goose .config/goose/permission.yaml',
  // scope-extras.ts:47-48 -> config-toml.ts:107-117 applies only `hooks` and
  // `permission.rules`; provider api_keys and models survive.
  'kimi-code .kimi-code/config.toml',
  // permissions-generate.ts:94-95 -> :70-83 keeps every rule the user wrote and
  // returns null rather than rewriting a file with YAML errors.
  'kiro .kiro/settings/permissions.yaml',
  // global-permissions.ts:34-35 -> permissions-format.ts:99-105 sets only
  // `shell.allow_list` and `startup.mode`.
  'deepagents-cli .deepagents/config.toml',
  // global-permissions.ts:34-35 -> permissions-toml.ts:51-67 replaces only the
  // owned profile keys under `agents.profiles`.
  'warp .warp/settings.toml',
  // global-permissions.ts:40-41 -> permissions-file.ts:77-112 is strictly
  // additive: foreign buckets and per-rule fields survive.
  'trae .trae/permission/global.json',
];

function canonicalFixture(): CanonicalFiles {
  return {
    rules: [
      {
        source: '_root.md',
        root: true,
        targets: [],
        description: 'Root',
        globs: [],
        body: 'Be careful.',
      },
    ],
    commands: [
      {
        source: 'build.md',
        name: 'build',
        description: 'Build it',
        allowedTools: ['Read'],
        outputStyle: true,
        body: 'Build the project.',
      },
    ],
    agents: [
      {
        source: 'reviewer.md',
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
        outputStyle: true,
      },
    ],
    skills: [],
    mcp: { mcpServers: { ctx: { type: 'stdio', command: 'npx', args: ['-y', 'ctx'], env: {} } } },
    permissions: { allow: ['Read', 'Bash(git:*)'], deny: ['Bash(rm:*)'], ask: [] },
    hooks: {
      SessionStart: [{ matcher: '', type: 'command', command: 'echo hi' }],
      PreToolUse: [{ matcher: 'Bash', type: 'command', command: 'echo pre' }],
    },
    ignore: ['secrets.env'],
  };
}

const FEATURES = new Set([
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'permissions',
  'hooks',
  'ignore',
]);

function mergeClaims(descriptor: TargetDescriptor, path: string): boolean {
  if (SETTINGS_JSON_PATHS.includes(path)) return true;
  const merger = descriptor.mergeGeneratedOutputContent;
  if (!merger) return false;
  try {
    return merger('{}', undefined, '{}', path) !== null;
  } catch {
    return true;
  }
}

let allDescriptors: readonly TargetDescriptor[] = [];
let root = '';

beforeAll(async () => {
  const mod: { descriptor: unknown } =
    await import('../../../fixtures/plugins/rich-plugin/index.js');
  registerTargetDescriptor(mod.descriptor as TargetDescriptor);
  allDescriptors = [...BUILTIN_TARGETS, getDescriptor('rich-plugin')!];
  root = mkdtempSync(join(tmpdir(), 'am-extras-ownership-'));
});

afterAll(() => {
  resetRegistry();
  rmSync(root, { recursive: true, force: true });
});

async function emittedPaths(): Promise<string[]> {
  const rows: string[] = [];
  for (const descriptor of allDescriptors) {
    const extras = descriptor.globalSupport?.scopeExtras;
    if (!extras) continue;
    for (const scope of ['global', 'project'] as const) {
      const results = await extras(canonicalFixture(), root, scope, FEATURES);
      for (const result of results) rows.push(`${descriptor.id} ${result.path}`);
    }
  }
  return [...new Set(rows)].sort();
}

describe('scopeExtras ownership invariant', () => {
  it('accounts for every path a scopeExtras generator emits', async () => {
    const unaccounted: string[] = [];
    for (const descriptor of allDescriptors) {
      const extras = descriptor.globalSupport?.scopeExtras;
      if (!extras) continue;
      for (const scope of ['global', 'project'] as const) {
        for (const result of await extras(canonicalFixture(), root, scope, FEATURES)) {
          const key = `${descriptor.id} ${result.path}`;
          if (mergeClaims(descriptor, result.path)) continue;
          if (AGENTSMESH_OWNED.includes(key) || SELF_MERGED.includes(key)) continue;
          unaccounted.push(key);
        }
      }
    }
    expect([...new Set(unaccounted)].sort()).toEqual([]);
  });

  it('every allowlisted path is still emitted, so no row outlives its generator', async () => {
    const emitted = new Set(await emittedPaths());
    const stale = [...AGENTSMESH_OWNED, ...SELF_MERGED].filter((row) => !emitted.has(row));
    expect(stale).toEqual([]);
  });

  it('covers the registered plugin descriptor, not just builtins', async () => {
    const emitted = await emittedPaths();
    expect(emitted).toContain('rich-plugin .rich/scope-info.txt');
    expect(emitted).toContain('rich-plugin .rich/mcp.json');
  });
});
