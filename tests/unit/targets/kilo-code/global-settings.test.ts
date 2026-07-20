import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { emitKiloGlobalSettings } from '../../../../src/targets/kilo-code/global-settings.js';
import { KILO_CONFIG_FILE } from '../../../../src/targets/kilo-code/constants.js';

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

const ALL_FEATURES = new Set(['rules', 'mcp']);

describe('emitKiloGlobalSettings — scope gating', () => {
  it('returns [] at project scope even with non-root rules and mcp servers present', () => {
    const canonical = makeCanonical({
      rules: [{ source: 'r.md', root: false, targets: [], description: '', globs: [], body: 'x' }],
      mcp: { mcpServers: { s: { type: 'stdio', command: 'node', args: [], env: {} } } },
    });
    expect(emitKiloGlobalSettings(canonical, 'project', ALL_FEATURES)).toEqual([]);
  });

  it('returns [] at global scope when canonical is empty', () => {
    expect(emitKiloGlobalSettings(makeCanonical(), 'global', ALL_FEATURES)).toEqual([]);
  });
});

describe('emitKiloGlobalSettings — instructions key (additionalRules)', () => {
  it('emits instructions: ["rules/*.md"] when a non-root rule targets kilo-code implicitly (no targets filter)', () => {
    const canonical = makeCanonical({
      rules: [{ source: 'r.md', root: false, targets: [], description: '', globs: [], body: 'x' }],
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['rules']));
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe(KILO_CONFIG_FILE);
    expect(JSON.parse(result[0]!.content)).toEqual({ instructions: ['rules/*.md'] });
  });

  it('emits instructions when a non-root rule explicitly targets kilo-code', () => {
    const canonical = makeCanonical({
      rules: [
        { source: 'r.md', root: false, targets: ['kilo-code'], description: '', globs: [], body: 'x' },
      ],
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['rules']));
    expect(JSON.parse(result[0]!.content).instructions).toEqual(['rules/*.md']);
  });

  it('does not emit instructions when the only non-root rule targets a different tool', () => {
    const canonical = makeCanonical({
      rules: [
        { source: 'r.md', root: false, targets: ['claude-code'], description: '', globs: [], body: 'x' },
      ],
    });
    expect(emitKiloGlobalSettings(canonical, 'global', new Set(['rules']))).toEqual([]);
  });

  it('does not emit instructions when only a root rule is present', () => {
    const canonical = makeCanonical({
      rules: [{ source: '_root.md', root: true, targets: [], description: '', globs: [], body: 'x' }],
    });
    expect(emitKiloGlobalSettings(canonical, 'global', new Set(['rules']))).toEqual([]);
  });

  it('does not emit instructions when the rules feature is disabled', () => {
    const canonical = makeCanonical({
      rules: [{ source: 'r.md', root: false, targets: [], description: '', globs: [], body: 'x' }],
    });
    expect(emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']))).toEqual([]);
  });
});

describe('emitKiloGlobalSettings — mcp key transform', () => {
  it('transforms a stdio server into { type: "local", command: [cmd, ...args] }', () => {
    const canonical = makeCanonical({
      mcp: { mcpServers: { fs: { type: 'stdio', command: 'npx', args: ['-y', 'server'], env: {} } } },
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']));
    const parsed = JSON.parse(result[0]!.content) as { mcp: Record<string, unknown> };
    expect(parsed.mcp.fs).toEqual({ type: 'local', command: ['npx', '-y', 'server'] });
  });

  it('includes environment only when non-empty', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: { fs: { type: 'stdio', command: 'node', args: [], env: { KEY: 'v' } } },
      },
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']));
    const parsed = JSON.parse(result[0]!.content) as { mcp: Record<string, unknown> };
    expect(parsed.mcp.fs).toEqual({ type: 'local', command: ['node'], environment: { KEY: 'v' } });
  });

  it('transforms a url server into { type: "remote", url }', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: { remote: { type: 'url', url: 'https://example.com/mcp', headers: {}, env: {} } },
      },
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']));
    const parsed = JSON.parse(result[0]!.content) as { mcp: Record<string, unknown> };
    expect(parsed.mcp.remote).toEqual({ type: 'remote', url: 'https://example.com/mcp' });
  });

  it('includes headers only when non-empty for url servers', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          remote: {
            type: 'url',
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer x' },
            env: {},
          },
        },
      },
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']));
    const parsed = JSON.parse(result[0]!.content) as { mcp: Record<string, unknown> };
    expect(parsed.mcp.remote).toEqual({
      type: 'remote',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer x' },
    });
  });

  it('includes description when present', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          fs: { type: 'stdio', command: 'node', args: [], env: {}, description: 'Filesystem tools' },
        },
      },
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']));
    const parsed = JSON.parse(result[0]!.content) as { mcp: Record<string, unknown> };
    expect((parsed.mcp.fs as Record<string, unknown>).description).toBe('Filesystem tools');
  });

  it('does not emit mcp when canonical.mcp is null', () => {
    expect(emitKiloGlobalSettings(makeCanonical(), 'global', new Set(['mcp']))).toEqual([]);
  });

  it('does not emit mcp when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    expect(emitKiloGlobalSettings(canonical, 'global', new Set(['mcp']))).toEqual([]);
  });

  it('does not emit mcp when the mcp feature is disabled', () => {
    const canonical = makeCanonical({
      mcp: { mcpServers: { fs: { type: 'stdio', command: 'node', args: [], env: {} } } },
    });
    expect(emitKiloGlobalSettings(canonical, 'global', new Set(['rules']))).toEqual([]);
  });
});

describe('emitKiloGlobalSettings — combined output', () => {
  it('emits both instructions and mcp in one JSON object when both apply', () => {
    const canonical = makeCanonical({
      rules: [{ source: 'r.md', root: false, targets: [], description: '', globs: [], body: 'x' }],
      mcp: { mcpServers: { fs: { type: 'stdio', command: 'node', args: [], env: {} } } },
    });
    const result = emitKiloGlobalSettings(canonical, 'global', new Set(['rules', 'mcp']));
    expect(result).toHaveLength(1);
    const parsed = JSON.parse(result[0]!.content) as Record<string, unknown>;
    expect(parsed.instructions).toEqual(['rules/*.md']);
    expect(parsed.mcp).toBeDefined();
  });
});
