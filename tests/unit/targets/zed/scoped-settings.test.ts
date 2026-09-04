/**
 * The emit + merge half of the single-settings-file contract: three features
 * (mcp, ignore, permissions) land on one path in one generate pass, so the merge
 * base must be the pending result, not the file on disk.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import {
  emitZedScopedSettings,
  mergeZedSettings,
} from '../../../../src/targets/zed/scoped-settings.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

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

function parse(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

describe('emitZedScopedSettings', () => {
  it('emits nothing when no enabled feature has canonical content', () => {
    expect(emitZedScopedSettings(canonical(), 'global', ALL)).toEqual([]);
  });

  it('always emits the project path; the global layout rewrites it', () => {
    const out = emitZedScopedSettings(
      canonical({ mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx' } } } }),
      'global',
      ALL,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.path).toBe(ZED_SETTINGS_FILE);
  });

  it('emits all three features into one output', () => {
    const out = emitZedScopedSettings(
      canonical({
        mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx' } } },
        ignore: ['dist/'],
        permissions: { allow: ['Bash(ls)'], deny: [], ask: [] },
      }),
      'global',
      ALL,
    );
    expect(Object.keys(parse(out[0]!.content))).toEqual([
      'context_servers',
      'file_scan_exclusions',
      'private_files',
      'agent',
    ]);
  });

  it('drops permissions in project scope, where Zed discards the agent key', () => {
    const out = emitZedScopedSettings(
      canonical({ permissions: { allow: ['Bash(ls)'], deny: [], ask: [] } }),
      'project',
      ALL,
    );
    expect(out).toEqual([]);
  });
});

describe('mergeZedSettings', () => {
  it('returns null for a path it does not own', () => {
    expect(mergeZedSettings(null, undefined, '{}', '.rules')).toBeNull();
  });

  it('handles both the project and the global settings path', () => {
    for (const path of [ZED_SETTINGS_FILE, ZED_GLOBAL_SETTINGS_FILE]) {
      expect(mergeZedSettings('{}', undefined, '{"context_servers":{}}', path)).not.toBeNull();
    }
  });

  it('keeps unrelated user settings', () => {
    const merged = mergeZedSettings(
      '{"theme":"One Dark","tab_size":2}',
      undefined,
      '{"context_servers":{"srv":{"command":"npx"}}}',
      ZED_SETTINGS_FILE,
    );
    expect(parse(merged!)).toEqual({
      theme: 'One Dark',
      tab_size: 2,
      context_servers: { srv: { command: 'npx' } },
    });
  });

  it('merges onto the pending result, not the file, when a second feature writes', () => {
    const pending: GenerateResult = {
      target: 'zed',
      path: ZED_SETTINGS_FILE,
      content:
        '{"theme":"One Dark","agent":{"tool_permissions":{"tools":{"terminal":{"default":"allow"}}}}}',
      status: 'updated',
    };
    const merged = mergeZedSettings(
      '{"theme":"One Dark"}',
      pending,
      '{"context_servers":{"srv":{"command":"npx"}}}',
      ZED_SETTINGS_FILE,
    );
    expect(parse(merged!)).toEqual({
      theme: 'One Dark',
      agent: { tool_permissions: { tools: { terminal: { default: 'allow' } } } },
      context_servers: { srv: { command: 'npx' } },
    });
  });

  it('deep-merges the agent key instead of replacing it', () => {
    const merged = mergeZedSettings(
      '{"agent":{"default_model":{"provider":"zed.dev"},"tool_permissions":{"tools":{"delete_path":{"always_deny":[{"pattern":"^/etc$"}]}}}}}',
      undefined,
      '{"agent":{"tool_permissions":{"tools":{"terminal":{"default":"allow"}}}}}',
      ZED_GLOBAL_SETTINGS_FILE,
    );
    expect(parse(merged!)).toEqual({
      agent: {
        default_model: { provider: 'zed.dev' },
        tool_permissions: {
          tools: {
            delete_path: { always_deny: [{ pattern: '^/etc$' }] },
            terminal: { default: 'allow' },
          },
        },
      },
    });
  });

  it('leaves a JSONC settings file untouched rather than stripping its comments', () => {
    const jsonc = '{\n  // my theme\n  "theme": "One Dark"\n}';
    expect(
      mergeZedSettings(jsonc, undefined, '{"private_files":["**/x"]}', ZED_SETTINGS_FILE),
    ).toBe(jsonc);
  });

  it('leaves a malformed settings file untouched rather than throwing', () => {
    expect(
      mergeZedSettings('{ not json', undefined, '{"private_files":["**/x"]}', ZED_SETTINGS_FILE),
    ).toBe('{ not json');
  });
});
