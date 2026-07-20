import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintIgnore, lintMcp } from '../../../../src/targets/rovodev/lint.js';

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

describe('lintIgnore (rovodev)', () => {
  it('returns empty when no ignore patterns', () => {
    expect(lintIgnore(makeCanonical())).toHaveLength(0);
  });

  it('warns when ignore patterns exist', () => {
    const result = lintIgnore(makeCanonical({ ignore: ['.env', 'node_modules/'] }));
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('rovodev');
  });
});

describe('lintMcp (rovodev)', () => {
  const MCP = { mcpServers: { fs: { command: 'node', args: ['fs.js'] } } };

  it('returns empty when no MCP config exists', () => {
    expect(lintMcp(makeCanonical())).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    expect(lintMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toHaveLength(0);
  });

  it('warns at project scope when MCP config exists (no project-level MCP file)', () => {
    const result = lintMcp(makeCanonical({ mcp: MCP }), { scope: 'project' });
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('rovodev');
  });

  it('warns when scope is omitted (defaults to project-scope behavior)', () => {
    const result = lintMcp(makeCanonical({ mcp: MCP }));
    expect(result).toHaveLength(1);
  });

  it('returns empty at global scope (MCP is native there)', () => {
    const result = lintMcp(makeCanonical({ mcp: MCP }), { scope: 'global' });
    expect(result).toHaveLength(0);
  });
});
