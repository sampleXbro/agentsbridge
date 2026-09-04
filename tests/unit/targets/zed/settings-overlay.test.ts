/**
 * Three features write one `settings.json` (mcp -> context_servers, ignore ->
 * file_scan_exclusions/private_files, permissions -> agent), and the file is the
 * user's editor config, not a managed output.
 *
 * The ownership contract these tests pin:
 *   - a key is claimed only when the canonical SOURCE for its feature exists, so
 *     a plain `agentsmesh generate` in a repo with no `.agentsmesh/mcp.json` or
 *     `permissions.yaml` never touches what the user configured by hand;
 *   - `context_servers` is an agentsmesh-managed inventory and is rewritten;
 *   - the two ignore glob lists have no provenance marker, so they are only ever
 *     ADDED to — deleting an exclusion the user wrote would expose files;
 *   - `agent` is merged per pattern (see permissions-merge.test.ts).
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  ZED_OWNED_SETTINGS_KEYS,
  buildZedOwnedOverlay,
} from '../../../../src/targets/zed/settings-overlay.js';

const ALL = new Set(['rules', 'mcp', 'ignore', 'permissions']);

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

/** Canonical with every settings-backed source file present but empty. */
function emptySources(): CanonicalFiles {
  return canonical({
    mcp: { mcpServers: {} },
    permissions: { allow: [], deny: [], ask: [] },
    ignore: [],
  });
}

describe('ZED_OWNED_SETTINGS_KEYS', () => {
  it('is the complete list of settings.json keys agentsmesh writes', () => {
    expect([...ZED_OWNED_SETTINGS_KEYS]).toEqual([
      'context_servers',
      'file_scan_exclusions',
      'private_files',
      'agent',
    ]);
  });
});

describe('buildZedOwnedOverlay', () => {
  it('claims a key only when its feature is enabled', () => {
    expect(buildZedOwnedOverlay(emptySources(), 'global', new Set(['rules'])).owned).toEqual([]);
    expect(buildZedOwnedOverlay(emptySources(), 'global', new Set(['mcp'])).owned).toEqual([
      'context_servers',
    ]);
    expect(buildZedOwnedOverlay(emptySources(), 'global', new Set(['ignore'])).owned).toEqual([
      'file_scan_exclusions',
      'private_files',
    ]);
  });

  it('claims nothing when the canonical source file does not exist', () => {
    expect(buildZedOwnedOverlay(canonical(), 'global', new Set(['mcp'])).owned).toEqual([]);
    expect(buildZedOwnedOverlay(canonical(), 'global', new Set(['permissions'])).owned).toEqual([]);
  });

  it('claims agent only in global scope — .zed/settings.json discards it', () => {
    expect(buildZedOwnedOverlay(emptySources(), 'global', new Set(['permissions'])).owned).toEqual([
      'agent',
    ]);
    expect(buildZedOwnedOverlay(emptySources(), 'project', new Set(['permissions'])).owned).toEqual(
      [],
    );
  });

  it('fills present only with keys that carry canonical content', () => {
    const overlay = buildZedOwnedOverlay(
      canonical({
        mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx' } } },
        ignore: ['dist/'],
        permissions: { allow: ['Bash(ls)'], deny: [], ask: [] },
      }),
      'global',
      ALL,
    );
    expect(Object.keys(overlay.present)).toEqual([
      'context_servers',
      'file_scan_exclusions',
      'private_files',
      'agent',
    ]);
    expect(overlay.present.agent).toEqual({
      tool_permissions: {
        tools: { terminal: { always_allow: [{ pattern: '^ls$', case_sensitive: true }] } },
      },
    });
  });

  it('leaves present empty when the enabled features have no canonical content', () => {
    const overlay = buildZedOwnedOverlay(emptySources(), 'global', ALL);
    expect(overlay.present).toEqual({});
    expect(overlay.owned).toEqual([
      'context_servers',
      'file_scan_exclusions',
      'private_files',
      'agent',
    ]);
  });
});
