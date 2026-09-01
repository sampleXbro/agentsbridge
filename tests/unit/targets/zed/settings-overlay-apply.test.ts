/**
 * Applying the owned-key overlay onto a real user `settings.json`.
 *
 * `settings.json` is the user's editor config, not a managed output: the only
 * things a generate pass may remove are the agentsmesh-managed inventory
 * (`context_servers`) and the permission patterns it can prove it authored.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  buildZedOwnedOverlay,
  applyZedOwnedOverlay,
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

describe('applyZedOwnedOverlay', () => {
  const userSettings = {
    theme: 'One Dark',
    tab_size: 2,
    context_servers: { stale: { command: 'old' } },
    file_scan_exclusions: ['**/old', '...'],
    private_files: ['**/old'],
    agent: {
      default_model: { provider: 'zed.dev' },
      tool_permissions: {
        default: 'allow',
        tools: {
          terminal: { always_allow: [{ pattern: '^stale$' }] },
          delete_path: { always_deny: [{ pattern: '^/etc$' }] },
        },
      },
    },
  };

  it('rewrites context_servers, adds ignore globs and merges the agent key', () => {
    const overlay = buildZedOwnedOverlay(
      canonical({
        mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx' } } },
        ignore: ['dist/'],
        permissions: { allow: ['Bash(ls)'], deny: [], ask: [] },
      }),
      'global',
      ALL,
    );
    const out = applyZedOwnedOverlay(userSettings, overlay);
    expect(out.theme).toBe('One Dark');
    expect(out.tab_size).toBe(2);
    expect(out.context_servers).toEqual({ srv: { type: 'stdio', command: 'npx' } });
    expect(out.file_scan_exclusions).toEqual(['**/old', '**/dist', '...']);
    expect(out.private_files).toEqual(['**/old', '**/dist']);
    expect(out.agent).toEqual({
      default_model: { provider: 'zed.dev' },
      tool_permissions: {
        default: 'allow',
        tools: {
          delete_path: { always_deny: [{ pattern: '^/etc$' }] },
          terminal: { always_allow: [{ pattern: '^ls$', case_sensitive: true }] },
        },
      },
    });
  });

  it('never deletes a hand-written exclusion list when canonical ignore is empty', () => {
    const overlay = buildZedOwnedOverlay(emptySources(), 'global', new Set(['ignore']));
    const out = applyZedOwnedOverlay(userSettings, overlay);
    expect(out.file_scan_exclusions).toEqual(['**/old', '...']);
    expect(out.private_files).toEqual(['**/old']);
  });

  it('leaves the whole file alone when no canonical source file exists', () => {
    const overlay = buildZedOwnedOverlay(canonical(), 'global', ALL);
    expect(applyZedOwnedOverlay(userSettings, overlay)).toEqual(userSettings);
  });

  it('revokes context_servers and the grants when the source files exist but are empty', () => {
    const overlay = buildZedOwnedOverlay(emptySources(), 'global', ALL);
    const out = applyZedOwnedOverlay(userSettings, overlay);
    expect(out).toEqual({
      theme: 'One Dark',
      tab_size: 2,
      file_scan_exclusions: ['**/old', '...'],
      private_files: ['**/old'],
      agent: {
        default_model: { provider: 'zed.dev' },
        tool_permissions: {
          default: 'allow',
          tools: { delete_path: { always_deny: [{ pattern: '^/etc$' }] } },
        },
      },
    });
  });

  it('leaves a key untouched when its feature is disabled', () => {
    const overlay = buildZedOwnedOverlay(emptySources(), 'global', new Set(['rules']));
    expect(applyZedOwnedOverlay(userSettings, overlay)).toEqual(userSettings);
  });

  it('does not mutate the input object', () => {
    const overlay = buildZedOwnedOverlay(
      canonical({ ignore: ['dist/'], mcp: { mcpServers: {} } }),
      'global',
      ALL,
    );
    const snapshot = JSON.stringify(userSettings);
    applyZedOwnedOverlay(userSettings, overlay);
    expect(JSON.stringify(userSettings)).toBe(snapshot);
  });
});
