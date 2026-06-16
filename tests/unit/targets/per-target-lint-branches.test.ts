/**
 * Branch coverage for per-target lint helpers that exist purely to flag
 * unsupported canonical features (hooks / permissions / ignore / mcp).
 *
 * Each helper has the same three-branch shape:
 *   - missing source → no diagnostic
 *   - present-but-empty source → no diagnostic
 *   - present-with-entries source → one warning
 *
 * Existing test suites exercise the warning branch through generate flows,
 * leaving the two "no diagnostic" branches uncovered. This file fills the
 * gap for goose, opencode, zed, and kilo-code.
 */

import { describe, it, expect } from 'vitest';
import * as goose from '../../../src/targets/goose/lint.js';
import * as opencode from '../../../src/targets/opencode/lint.js';
import * as zed from '../../../src/targets/zed/lint.js';
import * as kilo from '../../../src/targets/kilo-code/lint.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function withHooks(entries: Record<string, unknown[]>): CanonicalFiles {
  return { ...emptyCanonical(), hooks: entries as never };
}

function withPermissions(
  allow: string[],
  deny: string[],
  ask: string[] | undefined,
): CanonicalFiles {
  return {
    ...emptyCanonical(),
    permissions: { allow, deny, ask } as never,
  };
}

describe('per-target lint helpers', () => {
  describe.each([
    ['goose', goose],
    ['opencode', opencode],
    ['zed', zed],
    ['kilo-code', kilo],
  ] as const)('%s', (_name, mod) => {
    it('lintHooks returns [] when canonical.hooks is null', () => {
      expect(mod.lintHooks(emptyCanonical())).toEqual([]);
    });

    it('lintHooks returns [] when canonical.hooks has only empty entry arrays', () => {
      expect(mod.lintHooks(withHooks({ pre_tool_use: [], stop: [] }))).toEqual([]);
    });

    it('lintHooks returns one warning when canonical.hooks has entries', () => {
      const diags = mod.lintHooks(withHooks({ pre_tool_use: [{ command: 'echo x' }] }));
      expect(diags).toHaveLength(1);
      expect(diags[0]!.level).toBe('warning');
    });

  });

  describe.each([
    ['goose', goose],
    ['zed', zed],
  ] as const)('%s permissions', (_name, mod) => {
    it('lintPermissions returns [] when canonical.permissions is null', () => {
      expect(mod.lintPermissions(emptyCanonical())).toEqual([]);
    });

    it('lintPermissions returns [] when allow+deny+ask are all empty', () => {
      expect(mod.lintPermissions(withPermissions([], [], undefined))).toEqual([]);
      expect(mod.lintPermissions(withPermissions([], [], []))).toEqual([]);
    });

    it('lintPermissions returns one warning when any permission list has entries', () => {
      const diags = mod.lintPermissions(withPermissions(['Bash(echo)'], [], []));
      expect(diags).toHaveLength(1);
      expect(diags[0]!.level).toBe('warning');
    });
  });

  describe('opencode-only: lintIgnore', () => {
    it('returns [] when ignore array is empty', () => {
      expect(opencode.lintIgnore(emptyCanonical())).toEqual([]);
    });

    it('returns one warning when ignore array has entries', () => {
      const diags = opencode.lintIgnore({ ...emptyCanonical(), ignore: ['dist/'] });
      expect(diags).toHaveLength(1);
      expect(diags[0]!.level).toBe('warning');
    });
  });

  describe('goose-only: lintMcp', () => {
    it('returns [] when canonical.mcp is null', () => {
      expect(goose.lintMcp(emptyCanonical())).toEqual([]);
    });

    it('returns [] when mcp.mcpServers is empty', () => {
      const diags = goose.lintMcp({
        ...emptyCanonical(),
        mcp: { mcpServers: {} } as never,
      });
      expect(diags).toEqual([]);
    });

    it('returns one warning when mcp.mcpServers has entries', () => {
      const diags = goose.lintMcp({
        ...emptyCanonical(),
        mcp: { mcpServers: { test: { command: 'x' } } } as never,
      });
      expect(diags).toHaveLength(1);
      expect(diags[0]!.level).toBe('warning');
    });
  });
});
