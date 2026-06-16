import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  mergeOpenCodeSettings,
  emitOpenCodeScopedSettings,
} from '../../../../src/targets/opencode/scoped-settings.js';
import {
  OPENCODE_CONFIG_FILE,
  OPENCODE_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/opencode/constants.js';

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

const MCP_CANONICAL: NonNullable<CanonicalFiles['mcp']> = {
  mcpServers: {
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: {},
    },
  },
};

const PERMISSIONS: NonNullable<CanonicalFiles['permissions']> = {
  allow: ['Read'],
  deny: ['Bash'],
};

describe('mergeOpenCodeSettings (opencode)', () => {
  it('returns null when resolvedPath is not an opencode config file', () => {
    expect(mergeOpenCodeSettings(null, null, '{}', 'other.json')).toBeNull();
  });

  it('returns newContent when base is null (project path)', () => {
    const newContent = JSON.stringify({ mcp: {} });
    expect(mergeOpenCodeSettings(null, null, newContent, OPENCODE_CONFIG_FILE)).toBe(newContent);
  });

  it('returns newContent when base is null (global path)', () => {
    const newContent = JSON.stringify({ mcp: {} });
    expect(mergeOpenCodeSettings(null, null, newContent, OPENCODE_GLOBAL_CONFIG_FILE)).toBe(
      newContent,
    );
  });

  it('merges base and newContent JSON when base present (preserving unrelated base keys)', () => {
    const existing = JSON.stringify({ theme: 'dark', mcp: { old: {} } });
    const newContent = JSON.stringify({ permissions: { allow: ['Read'] } });
    const result = mergeOpenCodeSettings(existing, null, newContent, OPENCODE_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.theme).toBe('dark');
    expect(parsed.mcp).toEqual({ old: {} });
    expect(parsed.permissions).toMatchObject({ allow: ['Read'] });
  });

  it('prefers pending.content over existing as merge base', () => {
    const existing = JSON.stringify({ from: 'existing' });
    const pending = { path: OPENCODE_CONFIG_FILE, content: JSON.stringify({ from: 'pending' }) };
    const result = mergeOpenCodeSettings(existing, pending, '{}', OPENCODE_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.from).toBe('pending');
  });
});

describe('emitOpenCodeScopedSettings (opencode)', () => {
  it('returns [] when neither feature is enabled', () => {
    const canonical = makeCanonical({ mcp: MCP_CANONICAL, permissions: PERMISSIONS });
    expect(emitOpenCodeScopedSettings(canonical, 'global', new Set())).toEqual([]);
  });

  it('emits mcp when mcp enabled and present', () => {
    const canonical = makeCanonical({ mcp: MCP_CANONICAL });
    const results = emitOpenCodeScopedSettings(canonical, 'global', new Set(['mcp']));
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(OPENCODE_CONFIG_FILE);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed.mcp).toBeDefined();
    expect(parsed.permission).toBeUndefined();
  });

  it('emits permission when permissions enabled and present', () => {
    const canonical = makeCanonical({ permissions: PERMISSIONS });
    const results = emitOpenCodeScopedSettings(canonical, 'global', new Set(['permissions']));
    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed.permission).toBeDefined();
    expect(parsed.mcp).toBeUndefined();
  });

  it('emits both mcp and permission when both enabled', () => {
    const canonical = makeCanonical({ mcp: MCP_CANONICAL, permissions: PERMISSIONS });
    const results = emitOpenCodeScopedSettings(
      canonical,
      'global',
      new Set(['mcp', 'permissions']),
    );
    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed.mcp).toBeDefined();
    expect(parsed.permission).toBeDefined();
  });

  it('returns [] when mcp enabled but canonical.mcp is null', () => {
    const canonical = makeCanonical({ mcp: null });
    expect(emitOpenCodeScopedSettings(canonical, 'global', new Set(['mcp']))).toEqual([]);
  });

  it('returns [] when permissions enabled but canonical.permissions is null', () => {
    const canonical = makeCanonical({ permissions: null });
    expect(emitOpenCodeScopedSettings(canonical, 'global', new Set(['permissions']))).toEqual([]);
  });

  it('returns [] when mcp enabled and present but generator yields nothing (empty servers)', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    expect(emitOpenCodeScopedSettings(canonical, 'global', new Set(['mcp']))).toEqual([]);
  });

  it('returns [] when permissions enabled and present but all lists empty', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: [], ask: [] } });
    expect(emitOpenCodeScopedSettings(canonical, 'global', new Set(['permissions']))).toEqual([]);
  });
});
