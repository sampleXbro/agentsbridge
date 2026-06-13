import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { descriptor } from '../../../../src/targets/augment-code/index.js';
import {
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/augment-code/constants.js';

const ALL_FEATURES = new Set([
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
]);

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

describe('mergeGeneratedOutputContent (augment-code)', () => {
  const merge = (existing: string | null, newContent: string): string | null =>
    descriptor.mergeGeneratedOutputContent(
      existing,
      AUGMENT_CODE_SETTINGS_FILE,
      newContent,
      AUGMENT_CODE_SETTINGS_FILE,
    );

  it('returns newContent as-is when existing is null', () => {
    const incoming = JSON.stringify({ mcpServers: { s1: { type: 'http', url: 'u' } } });
    expect(merge(null, incoming)).toBe(incoming);
  });

  it('returns empty object merged with incoming when existing is not valid JSON', () => {
    const incoming = JSON.stringify({ mcpServers: { s1: { type: 'http', url: 'u' } } });
    const result = merge('not-valid-json{', incoming);
    expect(JSON.parse(result!)).toEqual({ mcpServers: { s1: { type: 'http', url: 'u' } } });
  });

  it('returns existing unchanged when incoming is an array', () => {
    const existing = JSON.stringify({ mcpServers: { old: { type: 'http', url: 'x' } } });
    const incoming = JSON.stringify([1, 2, 3]);
    expect(merge(existing, incoming)).toBe(existing);
  });

  it('returns existing unchanged when incoming is null JSON', () => {
    const existing = JSON.stringify({ mcpServers: { old: { type: 'http', url: 'x' } } });
    expect(merge(existing, 'null')).toBe(existing);
  });

  it('returns null for non-settings paths', () => {
    const result = descriptor.mergeGeneratedOutputContent(
      '{}',
      '.augment/rules/test.md',
      '# Test',
      '.augment/rules/test.md',
    );
    expect(result).toBeNull();
  });

  it('merges for global settings path', () => {
    const existing = JSON.stringify({ mcpServers: { s1: { type: 'http', url: 'u' } } });
    const incoming = JSON.stringify({ hooks: { PreToolUse: [] } });
    const result = descriptor.mergeGeneratedOutputContent(
      existing,
      AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
      incoming,
      AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
    );
    expect(JSON.parse(result!)).toEqual({
      mcpServers: { s1: { type: 'http', url: 'u' } },
      hooks: { PreToolUse: [] },
    });
  });

  it('treats non-object existing JSON as empty before merging', () => {
    const incoming = JSON.stringify({ mcpServers: { s1: { type: 'http', url: 'u' } } });
    const result = merge('"just a string"', incoming);
    expect(JSON.parse(result!)).toEqual({ mcpServers: { s1: { type: 'http', url: 'u' } } });
  });
});

describe('emitScopedSettings (augment-code)', () => {
  it('returns null when canonical has no mcp and no hooks', () => {
    const canonical = makeCanonical();
    const result = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(result).toEqual([]);
  });

  it('emits settings with mcpServers when canonical has mcp', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
        },
      },
    });
    const result = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(AUGMENT_CODE_SETTINGS_FILE);
    const parsed = JSON.parse(result[0].content);
    expect(parsed.mcpServers).toEqual({
      context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
    });
  });

  it('emits settings with hooks when canonical has hooks', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: 'launch-process', command: 'scripts/check.sh' }],
      },
    });
    const result = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(result).toHaveLength(1);
    const parsed = JSON.parse(result[0].content);
    expect(parsed.hooks.PreToolUse).toEqual([
      {
        matcher: 'launch-process',
        hooks: [{ type: 'command', command: 'scripts/check.sh' }],
      },
    ]);
  });

  it('serializes hooks entries with and without timeout', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [
          { matcher: 'file-write', command: 'scripts/lint.sh', timeout: 30000 },
          { matcher: 'launch-process', command: 'scripts/check.sh' },
        ],
      },
    });
    const result = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(result).toHaveLength(1);
    const parsed = JSON.parse(result[0].content);
    const entries = parsed.hooks.PreToolUse;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      matcher: 'file-write',
      hooks: [{ type: 'command', command: 'scripts/lint.sh', timeout: 30000 }],
    });
    expect(entries[1]).toEqual({
      matcher: 'launch-process',
      hooks: [{ type: 'command', command: 'scripts/check.sh' }],
    });
  });

  it('returns empty when mcp has no servers and hooks is null', () => {
    const canonical = makeCanonical({
      mcp: { mcpServers: {} },
      hooks: null,
    });
    const result = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(result).toEqual([]);
  });

  it('returns empty when hooks is empty object', () => {
    const canonical = makeCanonical({
      hooks: {},
    });
    const result = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(result).toEqual([]);
  });
});
