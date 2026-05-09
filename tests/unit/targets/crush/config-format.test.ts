import { describe, it, expect } from 'vitest';
import { buildCrushConfigJson } from '../../../../src/targets/crush/config-format.js';
import { mergeCrushConfigJson } from '../../../../src/core/generate/settings.js';

describe('buildCrushConfigJson', () => {
  it('always includes $schema reference', () => {
    const result = buildCrushConfigJson({});
    expect(result.$schema).toBe('https://charm.land/crush.json');
  });

  it('builds config with mcp overrides', () => {
    const result = buildCrushConfigJson({
      mcp: {
        filesystem: { type: 'stdio', command: 'node', args: ['/path'] },
      },
    });

    expect(result.$schema).toBe('https://charm.land/crush.json');
    expect(result.mcp).toBeDefined();
    const mcp = result.mcp as Record<string, unknown>;
    expect(mcp).toHaveProperty('filesystem');
  });

  it('builds config with hooks overrides', () => {
    const result = buildCrushConfigJson({
      hooks: {
        PreToolUse: [{ matcher: '^bash$', command: 'hook.sh' }],
      },
    });

    expect(result.hooks).toBeDefined();
    expect(result.hooks).toHaveProperty('PreToolUse');
  });

  it('builds config with permissions overrides', () => {
    const result = buildCrushConfigJson({
      permissions: { allowed_tools: ['Read', 'Write'] },
    });

    expect(result.permissions).toBeDefined();
    const perms = result.permissions as Record<string, unknown>;
    expect(perms['allowed_tools']).toEqual(['Read', 'Write']);
  });
});

describe('mergeCrushConfigJson', () => {
  it('merges new mcp key into existing config', () => {
    const existing = JSON.stringify({
      $schema: 'https://charm.land/crush.json',
      hooks: { PreToolUse: [{ matcher: '^bash$', command: 'hook.sh' }] },
    });
    const incoming = JSON.stringify({
      $schema: 'https://charm.land/crush.json',
      mcp: { fs: { type: 'stdio', command: 'node' } },
    });

    const merged = JSON.parse(mergeCrushConfigJson(existing, incoming)) as Record<string, unknown>;

    expect(merged).toHaveProperty('hooks');
    expect(merged).toHaveProperty('mcp');
    const mcp = merged['mcp'] as Record<string, unknown>;
    expect(mcp).toHaveProperty('fs');
  });

  it('returns valid JSON when existing content is invalid JSON', () => {
    const incoming = JSON.stringify({
      $schema: 'https://charm.land/crush.json',
      mcp: { server: { type: 'stdio', command: 'cmd' } },
    });

    const merged = JSON.parse(mergeCrushConfigJson('not valid json', incoming)) as Record<string, unknown>;

    expect(merged).toHaveProperty('mcp');
    expect(merged).toHaveProperty('$schema');
  });

  it('overwrites existing mcp key with incoming mcp', () => {
    const existing = JSON.stringify({
      mcp: { old: { type: 'stdio', command: 'old-cmd' } },
    });
    const incoming = JSON.stringify({
      mcp: { new: { type: 'stdio', command: 'new-cmd' } },
    });

    const merged = JSON.parse(mergeCrushConfigJson(existing, incoming)) as Record<string, unknown>;
    const mcp = merged['mcp'] as Record<string, unknown>;

    expect(mcp).toHaveProperty('new');
    expect(mcp).not.toHaveProperty('old');
  });

  it('preserves non-agentsmesh keys from existing config', () => {
    const existing = JSON.stringify({
      customKey: 'value',
      mcp: { old: {} },
    });
    const incoming = JSON.stringify({
      mcp: { new: {} },
    });

    const merged = JSON.parse(mergeCrushConfigJson(existing, incoming)) as Record<string, unknown>;

    expect(merged['customKey']).toBe('value');
    expect(merged).toHaveProperty('mcp');
  });
});
