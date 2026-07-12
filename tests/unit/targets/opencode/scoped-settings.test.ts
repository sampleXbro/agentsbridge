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
    const existing = JSON.stringify({ theme: 'dark', model: 'anthropic/claude' });
    const newContent = JSON.stringify({ permission: { bash: 'deny' } });
    const result = mergeOpenCodeSettings(existing, null, newContent, OPENCODE_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.theme).toBe('dark');
    expect(parsed.model).toBe('anthropic/claude');
    expect(parsed.permission).toEqual({ bash: 'deny' });
  });

  it('prefers pending.content over existing as merge base', () => {
    const existing = JSON.stringify({ theme: 'existing' });
    const pending = { path: OPENCODE_CONFIG_FILE, content: JSON.stringify({ theme: 'pending' }) };
    const result = mergeOpenCodeSettings(existing, pending, '{}', OPENCODE_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.theme).toBe('pending');
  });

  it('overwrites stale mcp/permission/instructions from a prior generate with the fresh values', () => {
    // Regression: mergeOpenCodeSettings used to delegate to the Claude-shaped
    // mergeSettingsJson, which only carries over `permissions`(plural)/`hooks`
    // — silently freezing `mcp`/`permission`/`instructions` at whatever a
    // FIRST generate wrote, on every subsequent regenerate.
    const existing = JSON.stringify({
      mcp: { old: { type: 'local', command: ['stale'] } },
      permission: { bash: 'allow' },
      instructions: ['stale/*.md'],
    });
    const newContent = JSON.stringify({
      mcp: { fresh: { type: 'local', command: ['node', 'x.js'] } },
      permission: { bash: 'deny' },
      instructions: ['.opencode/rules/*.md'],
    });
    const result = mergeOpenCodeSettings(existing, null, newContent, OPENCODE_CONFIG_FILE);
    expect(JSON.parse(result as string)).toEqual({
      mcp: { fresh: { type: 'local', command: ['node', 'x.js'] } },
      permission: { bash: 'deny' },
      instructions: ['.opencode/rules/*.md'],
    });
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

  const ADDITIONAL_RULE: NonNullable<CanonicalFiles['rules']>[number] = {
    source: '/proj/.agentsmesh/rules/typescript.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: 'Use strict TypeScript.',
  };

  it('emits instructions (project scope) when rules enabled and additional rules present', () => {
    const canonical = makeCanonical({ rules: [ADDITIONAL_RULE] });
    const results = emitOpenCodeScopedSettings(canonical, 'project', new Set(['rules']));
    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].content)).toEqual({ instructions: ['.opencode/rules/*.md'] });
  });

  it('emits an absolute ~/-prefixed instructions glob in global scope', () => {
    const canonical = makeCanonical({ rules: [ADDITIONAL_RULE] });
    const results = emitOpenCodeScopedSettings(canonical, 'global', new Set(['rules']));
    expect(JSON.parse(results[0].content)).toEqual({
      instructions: ['~/.config/opencode/rules/*.md'],
    });
  });

  it('returns [] when rules enabled but there are no additional (non-root) rules', () => {
    const canonical = makeCanonical({
      rules: [{ ...ADDITIONAL_RULE, root: true, source: '/proj/.agentsmesh/rules/_root.md' }],
    });
    expect(emitOpenCodeScopedSettings(canonical, 'project', new Set(['rules']))).toEqual([]);
  });

  it('returns [] when rules is not enabled, even with additional rules present', () => {
    const canonical = makeCanonical({ rules: [ADDITIONAL_RULE] });
    expect(emitOpenCodeScopedSettings(canonical, 'project', new Set())).toEqual([]);
  });

  it('merges instructions with mcp and permission when all three are enabled', () => {
    const canonical = makeCanonical({
      rules: [ADDITIONAL_RULE],
      mcp: MCP_CANONICAL,
      permissions: PERMISSIONS,
    });
    const results = emitOpenCodeScopedSettings(
      canonical,
      'project',
      new Set(['rules', 'mcp', 'permissions']),
    );
    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed.instructions).toEqual(['.opencode/rules/*.md']);
    expect(parsed.mcp).toBeDefined();
    expect(parsed.permission).toBeDefined();
  });
});
