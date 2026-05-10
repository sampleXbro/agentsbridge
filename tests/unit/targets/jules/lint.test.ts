import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  lintHooks,
  lintPermissions,
  lintIgnore,
  lintMcp,
  lintCommands,
  lintSkills,
} from '../../../../src/targets/jules/lint.js';
import { lintRules } from '../../../../src/targets/jules/linter.js';

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

describe('lintHooks (jules)', () => {
  it('returns warning when hooks exist', () => {
    const canonical = makeCanonical({
      hooks: { preCommit: [{ command: 'pnpm lint' }] },
    });

    const results = lintHooks(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('jules');
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

describe('lintPermissions (jules)', () => {
  it('returns warning when permissions exist', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });

    const results = lintPermissions(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('jules');
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

  it('returns warning when only deny permissions exist', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: ['rm'], ask: [] },
    });

    const results = lintPermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });

  it('returns warning when permissions has no ask field', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [] } as CanonicalFiles['permissions'],
    });

    const results = lintPermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });
});

describe('lintIgnore (jules)', () => {
  it('returns warning when ignore patterns exist', () => {
    const canonical = makeCanonical({
      ignore: ['node_modules', '.env'],
    });

    const results = lintIgnore(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('jules');
  });

  it('returns empty when ignore is empty', () => {
    const canonical = makeCanonical({ ignore: [] });
    expect(lintIgnore(canonical)).toHaveLength(0);
  });
});

describe('lintMcp (jules)', () => {
  it('returns warning when MCP servers exist', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          filesystem: { command: 'npx', args: ['server-fs'] },
        },
      },
    });

    const results = lintMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('jules');
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

describe('lintCommands (jules)', () => {
  it('returns warning when commands exist', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          source: '/proj/.agentsmesh/commands/review.md',
          description: 'Review code',
          body: 'Review code changes.',
          allowedTools: [],
        },
      ],
    });

    const results = lintCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('jules');
  });

  it('returns empty when no commands exist', () => {
    const canonical = makeCanonical({ commands: [] });
    expect(lintCommands(canonical)).toHaveLength(0);
  });
});

describe('lintSkills (jules)', () => {
  it('returns warning when skills exist', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'debug',
          source: '/proj/.agentsmesh/skills/debug/SKILL.md',
          description: 'Debug workflow',
          body: '# Debug',
          supportingFiles: [],
        },
      ],
    });

    const results = lintSkills(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('jules');
  });

  it('returns empty when no skills exist', () => {
    const canonical = makeCanonical({ skills: [] });
    expect(lintSkills(canonical)).toHaveLength(0);
  });
});

describe('lintRules (jules)', () => {
  it('returns diagnostics with jules target', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/scoped.md',
          root: false,
          targets: [],
          description: '',
          globs: ['nonexistent/**/*.ts'],
          body: 'Scoped rule.',
        },
      ],
    });

    const results = lintRules(canonical, '/proj', []);
    for (const d of results) {
      expect(d.target).toBe('jules');
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
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
      ],
    });

    const results = lintRules(canonical, '/proj', [], { scope: 'global' });
    // Valid rules should produce no diagnostics
    expect(results).toHaveLength(0);
  });
});
