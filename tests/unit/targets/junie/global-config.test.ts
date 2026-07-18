import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  emitJunieScopedSettings,
  mergeJunieConfig,
} from '../../../../src/targets/junie/global-config.js';
import { JUNIE_GLOBAL_CONFIG } from '../../../../src/targets/junie/constants.js';

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

describe('emitJunieScopedSettings', () => {
  it('returns empty at project scope', () => {
    const canonical = makeCanonical({
      hooks: { PreToolUse: [{ matcher: 'shell', command: 'echo pre' }] },
    });
    const result = emitJunieScopedSettings(canonical, 'project', new Set(['hooks']));
    expect(result).toHaveLength(0);
  });

  it('returns empty when hooks feature is disabled', () => {
    const canonical = makeCanonical({
      hooks: { PreToolUse: [{ matcher: 'shell', command: 'echo pre' }] },
    });
    const result = emitJunieScopedSettings(canonical, 'global', new Set<string>());
    expect(result).toHaveLength(0);
  });

  it('returns empty when hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    const result = emitJunieScopedSettings(canonical, 'global', new Set(['hooks']));
    expect(result).toHaveLength(0);
  });

  it('returns empty when all hook arrays are empty', () => {
    const canonical = makeCanonical({ hooks: { PreToolUse: [] } });
    const result = emitJunieScopedSettings(canonical, 'global', new Set(['hooks']));
    expect(result).toHaveLength(0);
  });

  it('emits config.json with hooks at global scope', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: 'shell', command: 'echo pre', timeout: 5000 }],
        PostToolUse: [],
      },
    });
    const result = emitJunieScopedSettings(canonical, 'global', new Set(['hooks']));
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(JUNIE_GLOBAL_CONFIG);
    const parsed = JSON.parse(result[0].content) as {
      hooks: Record<string, unknown[]>;
    };
    expect(typeof parsed.hooks).toBe('object');
    expect(parsed.hooks['PreToolUse']).toHaveLength(1);
    expect(parsed.hooks['PostToolUse']).toBeUndefined();
    const entry = parsed.hooks['PreToolUse']![0] as {
      matcher: string;
      hooks: Array<{ type: string; command: string; timeout?: number }>;
    };
    expect(entry.matcher).toBe('shell');
    expect(entry.hooks[0].type).toBe('command');
    expect(entry.hooks[0].command).toBe('echo pre');
    expect(entry.hooks[0].timeout).toBe(5000);
  });
});

describe('mergeJunieConfig', () => {
  it('returns newContent when existing is null', () => {
    const newContent = JSON.stringify({ hooks: { PreToolUse: [] } });
    expect(mergeJunieConfig(null, newContent)).toBe(newContent);
  });

  it('merges new keys into existing, preserving existing keys', () => {
    const existing = JSON.stringify({ model: 'gpt-4', brave: true });
    const newContent = JSON.stringify({ hooks: { SessionStart: [] } });
    const merged = JSON.parse(mergeJunieConfig(existing, newContent)) as Record<string, unknown>;
    expect(merged['model']).toBe('gpt-4');
    expect(merged['brave']).toBe(true);
    expect(merged['hooks']).toBeDefined();
  });

  it('overwrites existing key with new value', () => {
    const existing = JSON.stringify({ hooks: { PreToolUse: [] } });
    const newContent = JSON.stringify({ hooks: { PostToolUse: [] } });
    const merged = JSON.parse(mergeJunieConfig(existing, newContent)) as Record<string, unknown>;
    // incoming hooks overwrites existing hooks key
    expect((merged['hooks'] as Record<string, unknown>)['PostToolUse']).toBeDefined();
    expect((merged['hooks'] as Record<string, unknown>)['PreToolUse']).toBeUndefined();
  });

  it('returns newContent when existing is corrupt JSON', () => {
    const newContent = JSON.stringify({ hooks: {} });
    expect(mergeJunieConfig('not valid json', newContent)).toBe(newContent);
  });

  it('returns existing when newContent is corrupt JSON', () => {
    const existing = JSON.stringify({ model: 'gpt-4' });
    expect(mergeJunieConfig(existing, 'not valid json')).toBe(existing);
  });
});
