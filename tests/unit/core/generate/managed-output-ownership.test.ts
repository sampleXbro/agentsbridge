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
 * That signal only fires once a merge hook exists, which is why a target with
 * NO hook at all could delete-list the tool's own config and stay green. The
 * second invariant closes it from the other side: any structured config
 * document (JSON/JSONC/TOML/YAML) in `files` must be named in an explicit,
 * justified allowlist of the outputs agentsmesh owns outright.
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

/**
 * A structured config document — the shape a TOOL keeps its own state in. The
 * previous invariant only caught paths a merge hook already claimed, so a
 * target that never wrote a hook at all (the whole windsurf / cursor / kiro /
 * factory-droid class) passed green while replacing and then deleting the
 * user's config. Instruction files (`.md`) and ignore files have no key
 * structure and are genuinely agentsmesh's, so they are out of scope here.
 */
const CONFIG_FILE = /\.(json|jsonc|toml|ya?ml)$/;

/**
 * The ONLY structured config outputs allowed on the stale-cleanup delete list.
 * "The tool also writes it" is not machine-derivable, so it is spelled out:
 * adding a row is a deliberate claim that NO tool ever writes that path, and a
 * new target cannot delete-list a shared config file without making it.
 *
 * Every row is one of three kinds:
 *   1. an agentsmesh-dedicated sidecar (the filename or its directory is named
 *      after agentsmesh) that the tool merges alongside its own files;
 *   2. a path agentsmesh alone writes, verified against the tool's own source
 *      or docs;
 *   3. an eviction entry for a path an OLDER agentsmesh wrote and no longer
 *      emits.
 */
const AGENTSMESH_OWNED_CONFIG_OUTPUTS: readonly string[] = [
  // (3) Claude Code has no standalone hooks.json — code.claude.com/docs/en/hooks
  // lists only settings.json, plugin and frontmatter hooks, and the generator
  // writes hooks into `.claude/settings.json` instead. This entry evicts the
  // file older versions wrote; nothing emits it today.
  'claude-code global .claude/hooks.json',
  // (1) Continue merges ALL block files in `.continue/mcpServers/`; this one is
  // agentsmesh's alone and the directory is deliberately not a managed dir, so
  // cleanup can only ever reach this file.
  'continue global .continue/mcpServers/agentsmesh.json',
  'continue project .continue/mcpServers/agentsmesh.json',
  // (1) Copilot merges every `*.json` under `.github/hooks/`; agentsmesh writes
  // only its own name (docs.github.com/en/copilot/reference/hooks-configuration).
  'copilot project .github/hooks/agentsmesh.json',
  // (1) Open Plugin Specification plugin dir agentsmesh itself creates — the
  // path literally contains `plugins/agentsmesh/`.
  'goose global .agents/plugins/agentsmesh/hooks/hooks.json',
  'goose project .agents/plugins/agentsmesh/.mcp.json',
  'goose project .agents/plugins/agentsmesh/hooks/hooks.json',
  'openhands global .agents/plugins/agentsmesh/.mcp.json',
  'openhands project .agents/plugins/agentsmesh/.mcp.json',
  // (2) Roo Code resolves its global MCP settings under `globalStorageUri`,
  // never `$HOME` (McpHub.getMcpSettingsFilePath), so `~/mcp_settings.json` is
  // agentsmesh's own artifact. The importer reading it back is a self
  // round-trip, not evidence that Roo writes it.
  'roo-code global mcp_settings.json',
  // (2) Windsurf reads MCP only from `~/.codeium/windsurf/mcp_config.json`;
  // there is no project MCP surface at all, so the `.example.` sidecar is a
  // reference artifact Windsurf never reads (lint.ts says the same).
  'windsurf project .windsurf/mcp_config.example.json',
  // (1) Plugin fixture: the plugin's own generated artifacts, not a config file
  // the fictional tool writes. `.rich/mcp.json` is the fixture's tool-owned
  // file and is co-owned + merge-claimed instead.
  'rich-plugin global .rich/hooks.json',
  'rich-plugin global .rich/permissions.json',
  'rich-plugin global .rich/settings.json',
  'rich-plugin project .rich/hooks.json',
  'rich-plugin project .rich/permissions.json',
  'rich-plugin project .rich/settings.json',
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

  it('delete-lists a structured config file only when agentsmesh owns it outright', () => {
    const violations: string[] = [];
    for (const row of scopedLayouts(allDescriptors)) {
      for (const file of row.layout.managedOutputs?.files ?? []) {
        if (!CONFIG_FILE.test(file)) continue;
        const key = `${row.id} ${row.scope} ${file}`;
        if (!AGENTSMESH_OWNED_CONFIG_OUTPUTS.includes(key)) violations.push(key);
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

  it('declares exactly the 84 co-owned paths the audit identified', () => {
    const rows: string[] = [];
    for (const row of scopedLayouts(allDescriptors)) {
      for (const file of row.layout.managedOutputs?.coOwnedFiles ?? []) {
        if (row.id === 'rich-plugin') continue;
        rows.push(`${row.id} ${row.scope} ${file}`);
      }
    }
    expect(rows.sort()).toEqual(
      [
        // Every `mcpServers`-keyed file below is written by the tool's own MCP
        // UI or `<tool> mcp add`; agentsmesh owns the server set and the
        // canonical per-server fields, never `disabled`/`autoApprove`/`cwd`.
        'amazon-q global .aws/amazonq/mcp.json',
        'amazon-q project .amazonq/mcp.json',
        'amp global .config/amp/settings.json',
        'amp project .amp/settings.json',
        'antigravity global .gemini/config/hooks.json',
        'antigravity global .gemini/config/mcp_config.json',
        'antigravity project .agents/hooks.json',
        'antigravity project .agents/mcp_config.json',
        'augment-code global .augment/settings.json',
        'augment-code project .augment/settings.json',
        'claude-code global .claude.json',
        // Co-owned via the SETTINGS_JSON_PATHS fallback, not a descriptor hook:
        // holds the user's model, env and hook config.
        'claude-code global .claude/settings.json',
        'claude-code project .claude/settings.json',
        'claude-code project .mcp.json',
        // Ownership unresolved in-repo (ledger says confirmed, the same-day
        // drift review says the path is wrong), so the safe reading applies:
        // merge the `agents` key, never delete the file.
        'cline project .cline/agents.yaml',
        'cline project .cline/mcp.json',
        'codebuff global .agents/mcp.json',
        'codebuff project .agents/mcp.json',
        'codex-cli global .codex/config.toml',
        'codex-cli global .codex/hooks.json',
        'codex-cli project .codex/config.toml',
        'codex-cli project .codex/hooks.json',
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
        'cursor global .cursor/cli-config.json',
        'cursor global .cursor/hooks.json',
        'cursor global .cursor/mcp.json',
        // The Agent CLI config: `version`, `editor` and `network` live beside
        // `permissions`, and the CLI persists interactive approve/deny choices
        // back into it. Project and global are DIFFERENT filenames.
        'cursor project .cursor/cli.json',
        'cursor project .cursor/hooks.json',
        'cursor project .cursor/mcp.json',
        'deepagents-cli global .deepagents/.mcp.json',
        // The tool's only documented hooks file, so users hand-edit it;
        // agentsmesh owns only entries on the five events it maps.
        'deepagents-cli global .deepagents/hooks.json',
        'deepagents-cli project .mcp.json',
        'factory-droid global .factory/hooks.json',
        'factory-droid global .factory/mcp.json',
        'factory-droid global .factory/settings.json',
        'factory-droid project .factory/hooks.json',
        'factory-droid project .factory/mcp.json',
        // `droid` creates settings.json with defaults on first run and keeps ~20
        // other top-level keys there; agentsmesh owns only the two command
        // lists. `/hooks` saves hooks.json; `droid mcp add` writes mcp.json.
        'factory-droid project .factory/settings.json',
        // The tool's own user-tier policy dir: agentsmesh owns only the
        // `[[rule]]` blocks it marked. Listed at both scopes because the
        // workspace-tier copy an older agentsmesh wrote must not be deleted
        // either — a user may have added rules to it since.
        'gemini-cli global .gemini/policies/permissions.toml',
        'gemini-cli global .gemini/settings.json',
        'gemini-cli project .gemini/policies/permissions.toml',
        'gemini-cli project .gemini/settings.json',
        'goose global .config/goose/permission.yaml',
        // The persistent Action Allowlist: every "Always allow" the user accepts
        // is written here, split into five categories. agentsmesh owns only
        // `rules.executables`.
        'junie global .junie/allowlist.json',
        'junie global .junie/config.json',
        'junie global .junie/mcp/mcp.json',
        'junie project .junie/mcp/mcp.json',
        'kilo-code global .config/kilo/kilo.jsonc',
        'kilo-code project .kilo/mcp.json',
        'kilo-code project kilo.jsonc',
        'kimi-code global .kimi-code/mcp.json',
        'kimi-code project .kimi-code/mcp.json',
        'kiro global .kiro/settings/mcp.json',
        'kiro project .kiro/settings/mcp.json',
        'opencode global .config/opencode/opencode.json',
        'opencode project opencode.json',
        'openhands global .openhands/hooks.json',
        'openhands project .openhands/hooks.json',
        'qwen-code global .qwen/settings.json',
        'qwen-code project .qwen/settings.json',
        // Roo Code writes this itself when the user creates a Global mode;
        // agentsmesh owns only the modes carrying its marker comment.
        'roo-code global .roo/settings/custom_modes.yaml',
        'roo-code project .roo/mcp.json',
        // Roo's own project custom-modes store: it writes here whenever the
        // user creates a mode at Project scope, so agentsmesh owns only the
        // modes carrying its marker comment (modes-merge.ts).
        'roo-code project .roomodes',
        'roo-code project .vscode/settings.json',
        'rovodev global .rovodev/config.yml',
        'rovodev global .rovodev/mcp_config.json',
        // Saved-prompt manifest the user authors; the importer reads it back.
        // agentsmesh owns only its marked entries (prompts-merge.ts).
        'rovodev global .rovodev/prompts.yml',
        'rovodev project .rovodev/prompts.yml',
        'trae global .trae-cn/hooks.json',
        'trae global .trae/mcp.json',
        'trae project .trae/hooks.json',
        'trae project .trae/mcp.json',
        'warp global .warp/.mcp.json',
        'warp project .warp/.mcp.json',
        'windsurf global .codeium/windsurf/hooks.json',
        // The file Cascade's MCP UI writes — the reported data loss.
        'windsurf global .codeium/windsurf/mcp_config.json',
        'windsurf project .windsurf/hooks.json',
      ].sort(),
    );
  });

  it('declares the plugin fixture co-owned file', () => {
    const plugin = allDescriptors.find((d) => d.id === 'rich-plugin')!;
    expect(plugin.project.managedOutputs?.coOwnedFiles).toEqual(['.rich/mcp.json']);
    expect(plugin.globalSupport?.layout.managedOutputs?.coOwnedFiles).toEqual(['.rich/mcp.json']);
  });
});
