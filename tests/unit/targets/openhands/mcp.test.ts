import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { emitOpenhandsMcp } from '../../../../src/targets/openhands/mcp-settings.js';
import { mergeOpenhandsOutput } from '../../../../src/targets/openhands/merge.js';
import { OPENHANDS_MCP_FILE } from '../../../../src/targets/openhands/constants.js';

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

const stdio = makeCanonical({
  mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: ['-y', 'docs'], env: {} } } },
});

describe('emitOpenhandsMcp', () => {
  it('writes the shared plugin file with a single mcpServers key', () => {
    const outputs = emitOpenhandsMcp(stdio, 'project', new Set(['mcp']));
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.path).toBe(OPENHANDS_MCP_FILE);
    expect(Object.keys(JSON.parse(outputs[0]!.content) as object)).toEqual(['mcpServers']);
  });

  it('writes the same file at global scope', () => {
    expect(emitOpenhandsMcp(stdio, 'global', new Set(['mcp']))[0]!.path).toBe(OPENHANDS_MCP_FILE);
  });

  it('emits nothing when the mcp feature is off', () => {
    expect(emitOpenhandsMcp(stdio, 'project', new Set())).toEqual([]);
  });

  it('emits nothing when canonical has no server the shared file can carry', () => {
    expect(emitOpenhandsMcp(makeCanonical(), 'project', new Set(['mcp']))).toEqual([]);
    expect(
      emitOpenhandsMcp(
        makeCanonical({
          mcp: { mcpServers: { r: { type: 'http', url: 'https://x', headers: {}, env: {} } } },
        }),
        'project',
        new Set(['mcp']),
      ),
    ).toEqual([]);
  });
});

describe('mergeOpenhandsOutput (shared plugin .mcp.json)', () => {
  const next = JSON.stringify({
    mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } },
  });

  it('keeps on-disk keys canonical cannot express', () => {
    const existing = JSON.stringify({
      $schema: 'https://example.com/mcp.json',
      mcpServers: { docs: { command: 'npx', cwd: '/srv' } },
    });
    const merged = mergeOpenhandsOutput(existing, undefined, next, OPENHANDS_MCP_FILE)!;
    const parsed = JSON.parse(merged) as Record<string, unknown>;
    expect(parsed.$schema).toBe('https://example.com/mcp.json');
    expect(parsed.mcpServers).toEqual({
      docs: { type: 'stdio', command: 'npx', args: [], env: {}, cwd: '/srv' },
    });
  });

  it('revokes a server that canonical no longer defines', () => {
    const existing = JSON.stringify({ mcpServers: { gone: { command: 'old' } } });
    const merged = mergeOpenhandsOutput(existing, undefined, next, OPENHANDS_MCP_FILE)!;
    expect(Object.keys((JSON.parse(merged) as { mcpServers: object }).mcpServers)).toEqual([
      'docs',
    ]);
  });

  it('leaves other generated paths to the default merge', () => {
    expect(mergeOpenhandsOutput(null, undefined, next, 'AGENTS.md')).toBeNull();
  });
});
