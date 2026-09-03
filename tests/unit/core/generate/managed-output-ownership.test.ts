/**
 * Repo-wide ownership invariant for `managedOutputs`.
 *
 * `managedOutputs.files` is the DELETE list: `cleanupStaleGeneratedOutputs`
 * rm -rf's every entry the current run did not emit. A file the user co-owns
 * (a shared tool config agentsmesh only writes some keys into) must therefore
 * never appear there — disabling one feature would destroy the whole file.
 * Those paths belong in `managedOutputs.coOwnedFiles`, which stale cleanup
 * never reads.
 *
 * A path claimed by the descriptor's `mergeGeneratedOutputContent` is exactly
 * the signal that agentsmesh writes into a file it does not own outright, so
 * "merge-claimed" and "in files" must be mutually exclusive.
 *
 * Runs over builtins AND the registered rich-plugin fixture: the contract is a
 * descriptor contract, not a builtin one.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUILTIN_TARGETS } from '../../../../src/targets/catalog/builtin-targets.js';
import { SETTINGS_JSON_PATHS } from '../../../../src/core/generate/settings.js';
import {
  getDescriptor,
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type {
  TargetDescriptor,
  TargetLayout,
  TargetLayoutScope,
} from '../../../../src/targets/catalog/target-descriptor.js';

/**
 * The ONLY merge-claimed paths allowed to stay in `files`. Each is an
 * agentsmesh-dedicated sidecar inside a directory agentsmesh creates wholesale
 * (`.agents/plugins/agentsmesh/`, named after agentsmesh itself), so nothing a
 * user authored can live there. Their merge hook exists only to keep `cwd` and
 * `$schema` byte-stable across rewrites — not because a user co-owns the file —
 * and delete-on-disable is the documented, intended behaviour
 * (src/targets/goose/index.ts). Adding a row here is a deliberate decision that
 * a new target cannot make silently.
 */
const AGENTSMESH_OWNED_MERGED_FILES: readonly string[] = [
  'goose project .agents/plugins/agentsmesh/.mcp.json',
  'openhands project .agents/plugins/agentsmesh/.mcp.json',
  'openhands global .agents/plugins/agentsmesh/.mcp.json',
];

interface ScopedLayout {
  readonly id: string;
  readonly scope: TargetLayoutScope;
  readonly layout: TargetLayout;
  readonly descriptor: TargetDescriptor;
}

function scopedLayouts(descriptors: readonly TargetDescriptor[]): ScopedLayout[] {
  const rows: ScopedLayout[] = [];
  for (const descriptor of descriptors) {
    const pairs: [TargetLayoutScope, TargetLayout | undefined][] = [
      ['project', descriptor.project],
      ['global', descriptor.globalSupport?.layout],
    ];
    for (const [scope, layout] of pairs) {
      if (layout) rows.push({ id: descriptor.id, scope, layout, descriptor });
    }
  }
  return rows;
}

/**
 * True when `path` is co-owned with the user, by either mechanism:
 * a descriptor merge hook, or the `SETTINGS_JSON_PATHS` fallback in
 * `mergeOutputContent`. Missing the second one is how `.claude/settings.json`
 * — which holds the user's model, env and auth — stayed on the delete list.
 */
function mergeClaims(descriptor: TargetDescriptor, path: string): boolean {
  if (SETTINGS_JSON_PATHS.includes(path)) return true;
  const merger = descriptor.mergeGeneratedOutputContent;
  if (!merger) return false;
  try {
    return merger('{}', undefined, '{}', path) !== null;
  } catch {
    // A hook that parses `path`-specific content and throws still claims it.
    return true;
  }
}

let allDescriptors: readonly TargetDescriptor[] = [];

beforeAll(async () => {
  const mod: { descriptor: unknown } =
    await import('../../../fixtures/plugins/rich-plugin/index.js');
  registerTargetDescriptor(mod.descriptor as TargetDescriptor);
  const plugin = getDescriptor('rich-plugin');
  expect(plugin).toBeDefined();
  allDescriptors = [...BUILTIN_TARGETS, plugin!];
});

afterAll(() => resetRegistry());

describe('managedOutputs ownership invariant', () => {
  it('covers every builtin plus the registered plugin descriptor', () => {
    expect(allDescriptors).toHaveLength(BUILTIN_TARGETS.length + 1);
    expect(allDescriptors.map((d) => d.id)).toContain('rich-plugin');
  });

  it('never lists a merge-claimed path in managedOutputs.files', () => {
    const violations: string[] = [];
    for (const row of scopedLayouts(allDescriptors)) {
      for (const file of row.layout.managedOutputs?.files ?? []) {
        if (!mergeClaims(row.descriptor, file)) continue;
        const key = `${row.id} ${row.scope} ${file}`;
        if (AGENTSMESH_OWNED_MERGED_FILES.includes(key)) continue;
        violations.push(key);
      }
    }
    expect(violations).toEqual([]);
  });

  /**
   * Co-ownership declared by a `scopeExtras` generator that reads the existing
   * file and merges internally, rather than by a descriptor merge hook. Each
   * entry needs a cited generator that demonstrably preserves foreign content —
   * this list is what stops `coOwnedFiles` becoming a way to opt a path out of
   * cleanup without actually merging anything.
   */
  const SCOPE_EXTRAS_MERGED: readonly string[] = [
    // src/targets/goose/scope-extras.ts:26-27 reads the file and
    // `serializeGoosePermissions` merges canonical into the `user` category,
    // preserving goose's own `smart_approve` runtime cache.
    'goose global .config/goose/permission.yaml',
  ];

  it('claims every coOwnedFiles path with a merge hook or a cited scopeExtras merge', () => {
    const unclaimed: string[] = [];
    for (const row of scopedLayouts(allDescriptors)) {
      for (const file of row.layout.managedOutputs?.coOwnedFiles ?? []) {
        const key = `${row.id} ${row.scope} ${file}`;
        if (SCOPE_EXTRAS_MERGED.includes(key)) continue;
        if (!mergeClaims(row.descriptor, file)) unclaimed.push(key);
      }
    }
    expect(unclaimed).toEqual([]);
  });

  it('keeps files and coOwnedFiles disjoint', () => {
    const overlaps: string[] = [];
    for (const row of scopedLayouts(allDescriptors)) {
      const managed = row.layout.managedOutputs;
      if (!managed) continue;
      for (const file of managed.coOwnedFiles ?? []) {
        if (managed.files.includes(file)) overlaps.push(`${row.id} ${row.scope} ${file}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('declares exactly the 41 co-owned paths the audit identified', () => {
    const rows: string[] = [];
    for (const row of scopedLayouts(allDescriptors)) {
      for (const file of row.layout.managedOutputs?.coOwnedFiles ?? []) {
        if (row.id === 'rich-plugin') continue;
        rows.push(`${row.id} ${row.scope} ${file}`);
      }
    }
    expect(rows.sort()).toEqual(
      [
        'amp global .config/amp/settings.json',
        'amp project .amp/settings.json',
        'antigravity global .gemini/config/mcp_config.json',
        'antigravity project .agents/mcp_config.json',
        'augment-code global .augment/settings.json',
        'augment-code project .augment/settings.json',
        'claude-code global .claude.json',
        // Co-owned via the SETTINGS_JSON_PATHS fallback, not a descriptor hook:
        // holds the user's model, env and hook config.
        'claude-code global .claude/settings.json',
        'claude-code project .claude/settings.json',
        'claude-code project .mcp.json',
        'codex-cli global .codex/config.toml',
        'codex-cli project .codex/config.toml',
        // Continue's personal assistant config (models, apiKey, context
        // providers) and the approval cache Continue writes when the user picks
        // "always allow"; agentsmesh owns only some keys of each.
        'continue global .continue/config.yaml',
        'continue global .continue/permissions.yaml',
        // Only agentsmesh's `hooks` key; the file also holds the user's
        // `description` and `disableAllHooks`. Declared at both scopes so the
        // revocation invariant can see it — it used to be in NEITHER list.
        'continue global .continue/settings.json',
        'continue project .continue/settings.json',
        // Written by `copilot mcp add`; agentsmesh owns only the server set.
        'copilot global .copilot/mcp-config.json',
        'copilot project .vscode/mcp.json',
        'crush global .config/crush/crush.json',
        'crush project crush.json',
        'deepagents-cli global .deepagents/.mcp.json',
        // The tool's only documented hooks file, so users hand-edit it;
        // agentsmesh owns only entries on the five events it maps.
        'deepagents-cli global .deepagents/hooks.json',
        'deepagents-cli project .mcp.json',
        // The tool's own user-tier policy dir: agentsmesh owns only the
        // `[[rule]]` blocks it marked. Listed at both scopes because the
        // workspace-tier copy an older agentsmesh wrote must not be deleted
        // either — a user may have added rules to it since.
        'gemini-cli global .gemini/policies/permissions.toml',
        'gemini-cli global .gemini/settings.json',
        'gemini-cli project .gemini/policies/permissions.toml',
        'gemini-cli project .gemini/settings.json',
        'goose global .config/goose/permission.yaml',
        'junie global .junie/config.json',
        'kilo-code global .config/kilo/kilo.jsonc',
        'kilo-code project kilo.jsonc',
        'opencode global .config/opencode/opencode.json',
        'opencode project opencode.json',
        'openhands global .openhands/hooks.json',
        'openhands project .openhands/hooks.json',
        'qwen-code global .qwen/settings.json',
        'qwen-code project .qwen/settings.json',
        // Roo Code writes this itself when the user creates a Global mode;
        // agentsmesh owns only the modes carrying its marker comment.
        'roo-code global .roo/settings/custom_modes.yaml',
        // Roo's own project custom-modes store: it writes here whenever the
        // user creates a mode at Project scope, so agentsmesh owns only the
        // modes carrying its marker comment (modes-merge.ts).
        'roo-code project .roomodes',
        'roo-code project .vscode/settings.json',
        'rovodev global .rovodev/config.yml',
      ].sort(),
    );
  });

  it('declares the plugin fixture co-owned file', () => {
    const plugin = allDescriptors.find((d) => d.id === 'rich-plugin')!;
    expect(plugin.project.managedOutputs?.coOwnedFiles).toEqual(['.rich/mcp.json']);
    expect(plugin.globalSupport?.layout.managedOutputs?.coOwnedFiles).toEqual(['.rich/mcp.json']);
  });
});
