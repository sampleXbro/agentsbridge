import { describe, it, expect } from 'vitest';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  buildRovodevConfig,
  mergeRovodevConfig,
} from '../../../../src/targets/rovodev/settings.js';
import { ROVODEV_GLOBAL_CONFIG_FILE } from '../../../../src/targets/rovodev/constants.js';

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

const HOOKS = { PreToolUse: [{ matcher: 'Bash', command: 'echo hi' }] } as unknown as NonNullable<
  CanonicalFiles['hooks']
>;

describe('buildRovodevConfig (rovodev)', () => {
  it('returns [] when neither feature is enabled', () => {
    const canonical = makeCanonical({ hooks: HOOKS, permissions: { allow: ['Read'], deny: [] } });
    expect(buildRovodevConfig(canonical, new Set())).toEqual([]);
  });

  it('emits eventHooks when hooks enabled and entries present', () => {
    const canonical = makeCanonical({ hooks: HOOKS });
    const results = buildRovodevConfig(canonical, new Set(['hooks']));
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROVODEV_GLOBAL_CONFIG_FILE);
    const parsed = yamlParse(results[0].content) as Record<string, unknown>;
    expect(parsed.eventHooks).toEqual(HOOKS);
    expect(parsed.toolPermissions).toBeUndefined();
  });

  it('omits eventHooks when hooks enabled but canonical.hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(buildRovodevConfig(canonical, new Set(['hooks']))).toEqual([]);
  });

  it('omits eventHooks when hooks enabled but all hook arrays are empty', () => {
    const emptyHooks = { PreToolUse: [], PostToolUse: [] } as unknown as NonNullable<
      CanonicalFiles['hooks']
    >;
    const canonical = makeCanonical({ hooks: emptyHooks });
    expect(buildRovodevConfig(canonical, new Set(['hooks']))).toEqual([]);
  });

  it('emits toolPermissions with only allow', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Read'], deny: [] } });
    const results = buildRovodevConfig(canonical, new Set(['permissions']));
    const parsed = yamlParse(results[0].content) as {
      toolPermissions: Record<string, unknown>;
    };
    expect(parsed.toolPermissions.allow).toEqual(['Read']);
    expect(parsed.toolPermissions.deny).toBeUndefined();
    expect(parsed.toolPermissions.ask).toBeUndefined();
  });

  it('emits toolPermissions with only deny', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: ['Bash'] } });
    const results = buildRovodevConfig(canonical, new Set(['permissions']));
    const parsed = yamlParse(results[0].content) as {
      toolPermissions: Record<string, unknown>;
    };
    expect(parsed.toolPermissions.deny).toEqual(['Bash']);
    expect(parsed.toolPermissions.allow).toBeUndefined();
    expect(parsed.toolPermissions.ask).toBeUndefined();
  });

  it('emits toolPermissions with only ask', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: [], ask: ['Write'] } });
    const results = buildRovodevConfig(canonical, new Set(['permissions']));
    const parsed = yamlParse(results[0].content) as {
      toolPermissions: Record<string, unknown>;
    };
    expect(parsed.toolPermissions.ask).toEqual(['Write']);
    expect(parsed.toolPermissions.allow).toBeUndefined();
    expect(parsed.toolPermissions.deny).toBeUndefined();
  });

  it('omits toolPermissions when permissions enabled but all lists empty', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: [], ask: [] } });
    expect(buildRovodevConfig(canonical, new Set(['permissions']))).toEqual([]);
  });

  it('omits toolPermissions when permissions enabled but canonical.permissions is null', () => {
    const canonical = makeCanonical({ permissions: null });
    expect(buildRovodevConfig(canonical, new Set(['permissions']))).toEqual([]);
  });

  it('emits both eventHooks and toolPermissions when both enabled', () => {
    const canonical = makeCanonical({
      hooks: HOOKS,
      permissions: { allow: ['Read'], deny: ['Bash'], ask: ['Write'] },
    });
    const results = buildRovodevConfig(canonical, new Set(['hooks', 'permissions']));
    expect(results).toHaveLength(1);
    const parsed = yamlParse(results[0].content) as {
      eventHooks: unknown;
      toolPermissions: { allow: string[]; deny: string[]; ask: string[] };
    };
    expect(parsed.eventHooks).toEqual(HOOKS);
    expect(parsed.toolPermissions.allow).toEqual(['Read']);
    expect(parsed.toolPermissions.deny).toEqual(['Bash']);
    expect(parsed.toolPermissions.ask).toEqual(['Write']);
  });
});

describe('mergeRovodevConfig (rovodev)', () => {
  it('returns newContent when existing is null', () => {
    const newContent = yamlStringify({ eventHooks: HOOKS });
    expect(mergeRovodevConfig(null, newContent)).toBe(newContent);
  });

  it('merges incoming eventHooks, preserving unrelated existing keys', () => {
    const existing = yamlStringify({ telemetry: { enabled: false }, theme: 'dark' });
    const incoming = yamlStringify({ eventHooks: HOOKS });
    const merged = yamlParse(mergeRovodevConfig(existing, incoming)) as Record<string, unknown>;
    expect(merged.telemetry).toEqual({ enabled: false });
    expect(merged.theme).toBe('dark');
    expect(merged.eventHooks).toEqual(HOOKS);
  });

  it('falls back to {} base when existing YAML is invalid', () => {
    const incoming = yamlStringify({ eventHooks: HOOKS });
    const merged = yamlParse(mergeRovodevConfig('::: not: valid: yaml :::', incoming)) as Record<
      string,
      unknown
    >;
    expect(merged.eventHooks).toEqual(HOOKS);
    expect(Object.keys(merged)).toEqual(['eventHooks']);
  });

  it('falls back to {} base when existing YAML parses to an array', () => {
    const incoming = yamlStringify({ eventHooks: HOOKS });
    const merged = yamlParse(mergeRovodevConfig('- a\n- b', incoming)) as Record<string, unknown>;
    expect(merged.eventHooks).toEqual(HOOKS);
    expect(Object.keys(merged)).toEqual(['eventHooks']);
  });

  it('falls back to {} base when existing YAML parses to a scalar', () => {
    const incoming = yamlStringify({ eventHooks: HOOKS });
    const merged = yamlParse(mergeRovodevConfig('42', incoming)) as Record<string, unknown>;
    expect(merged.eventHooks).toEqual(HOOKS);
    expect(Object.keys(merged)).toEqual(['eventHooks']);
  });

  it('returns existing unchanged when incoming YAML is a scalar', () => {
    const existing = yamlStringify({ theme: 'dark' });
    expect(mergeRovodevConfig(existing, '42')).toBe(existing);
  });

  it('returns existing unchanged when incoming YAML is an array', () => {
    const existing = yamlStringify({ theme: 'dark' });
    expect(mergeRovodevConfig(existing, '- a\n- b')).toBe(existing);
  });

  it('merges incoming with only toolPermissions', () => {
    const existing = yamlStringify({ theme: 'dark' });
    const incoming = yamlStringify({ toolPermissions: { allow: ['Read'] } });
    const merged = yamlParse(mergeRovodevConfig(existing, incoming)) as Record<string, unknown>;
    expect(merged.theme).toBe('dark');
    expect(merged.toolPermissions).toEqual({ allow: ['Read'] });
    expect(merged.eventHooks).toBeUndefined();
  });

  it('merges incoming with both eventHooks and toolPermissions', () => {
    const existing = yamlStringify({ theme: 'dark' });
    const incoming = yamlStringify({
      eventHooks: HOOKS,
      toolPermissions: { deny: ['Bash'] },
    });
    const merged = yamlParse(mergeRovodevConfig(existing, incoming)) as Record<string, unknown>;
    expect(merged.theme).toBe('dark');
    expect(merged.eventHooks).toEqual(HOOKS);
    expect(merged.toolPermissions).toEqual({ deny: ['Bash'] });
  });
});
