import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  lintHooks,
  lintPermissions,
  lintIgnore,
  lintMcp,
} from '../../../../src/targets/replit-agent/lint.js';
import { lintRules } from '../../../../src/targets/replit-agent/linter.js';

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

describe('lintRules (replit-agent)', () => {
  it('returns diagnostics with replit-agent target', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/ts.md',
          root: false,
          targets: [],
          description: '',
          globs: ['nonexistent/**/*.ts'],
          body: 'Strict TS',
        },
      ],
    });

    const results = lintRules(canonical, '/proj', []);

    for (const d of results) {
      expect(d.target).toBe('replit-agent');
    }
  });

  it('returns empty for valid rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
      ],
    });

    const results = lintRules(canonical, '/proj', []);
    expect(results).toHaveLength(0);
  });

  it('skips glob checks in global scope', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/ts.md',
          root: false,
          targets: [],
          description: '',
          globs: ['nonexistent/**/*.ts'],
          body: 'Strict TS',
        },
      ],
    });

    const results = lintRules(canonical, '/proj', [], { scope: 'global' });
    // Global scope skips glob file match checks
    const globDiags = results.filter((d) => d.message.includes('glob'));
    expect(globDiags).toHaveLength(0);
  });
});

describe('lintHooks (replit-agent)', () => {
  it('returns warning when hooks exist', () => {
    const canonical = makeCanonical({
      hooks: { preCommit: [{ command: 'pnpm lint' }] },
    });

    const results = lintHooks(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('replit-agent');
  });

  it('returns empty when hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns empty when all hook arrays are empty', () => {
    const canonical = makeCanonical({ hooks: {} });
    expect(lintHooks(canonical)).toHaveLength(0);
  });
});

describe('lintPermissions (replit-agent)', () => {
  it('returns warning when permissions exist', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });

    const results = lintPermissions(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('replit-agent');
  });

  it('returns empty when permissions is null', () => {
    const canonical = makeCanonical({ permissions: null });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns empty when all permission arrays are empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns warning when only deny has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: ['rm'], ask: [] },
    });

    const results = lintPermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });

  it('returns warning when only ask has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: ['network'] },
    });

    const results = lintPermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });
});

describe('lintIgnore (replit-agent)', () => {
  it('returns warning when ignore patterns exist', () => {
    const canonical = makeCanonical({
      ignore: ['node_modules', '.env'],
    });

    const results = lintIgnore(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('replit-agent');
  });

  it('returns empty when ignore is empty', () => {
    const canonical = makeCanonical({ ignore: [] });
    expect(lintIgnore(canonical)).toHaveLength(0);
  });
});

describe('lintMcp (replit-agent)', () => {
  it('returns warning when MCP servers exist', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      },
    });

    const results = lintMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('replit-agent');
  });

  it('returns empty when mcp is null', () => {
    const canonical = makeCanonical({ mcp: null });
    expect(lintMcp(canonical)).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    expect(lintMcp(canonical)).toHaveLength(0);
  });
});
