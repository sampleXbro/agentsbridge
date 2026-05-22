/**
 * Branch coverage for additional per-target lint helpers: copilot, cline,
 * kiro, windsurf, junie. Mirrors the shape of per-target-lint-branches.test.ts.
 */

import { describe, it, expect } from 'vitest';
import * as copilot from '../../../src/targets/copilot/lint.js';
import * as cline from '../../../src/targets/cline/lint.js';
import * as kiro from '../../../src/targets/kiro/lint.js';
import * as windsurf from '../../../src/targets/windsurf/lint.js';
import * as junie from '../../../src/targets/junie/lint.js';
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

describe('copilot lint', () => {
  it('lintHooks returns [] when hooks is null', () => {
    expect(copilot.lintHooks(emptyCanonical())).toEqual([]);
  });
  it('lintHooks returns [] when hooks is an empty object', () => {
    expect(copilot.lintHooks({ ...emptyCanonical(), hooks: {} as never })).toEqual([]);
  });
  it('lintHooks emits unsupported-event warnings without entries', () => {
    const diags = copilot.lintHooks({
      ...emptyCanonical(),
      hooks: { Weird: [] } as never,
    });
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });
  it('lintCommands returns [] when no commands have allowedTools', () => {
    expect(copilot.lintCommands(emptyCanonical())).toEqual([]);
  });
});

describe('cline lint', () => {
  it('lintHooks returns [] when hooks is null', () => {
    expect(cline.lintHooks(emptyCanonical())).toEqual([]);
  });
  it('lintHooks returns [] when hooks has only empty arrays', () => {
    expect(cline.lintHooks({ ...emptyCanonical(), hooks: { PreToolUse: [] } as never })).toEqual(
      [],
    );
  });
  it('lintHooks returns one warning when hooks has entries', () => {
    const diags = cline.lintHooks({
      ...emptyCanonical(),
      hooks: { PreToolUse: [{ command: 'x' }] } as never,
    });
    expect(diags).toHaveLength(1);
  });
  it('lintCommands returns [] when commands are bare', () => {
    expect(cline.lintCommands(emptyCanonical())).toEqual([]);
  });
});

describe('kiro lint', () => {
  it('lintHooks returns [] when hooks is null', () => {
    expect(kiro.lintHooks(emptyCanonical())).toEqual([]);
  });
  it('lintHooks returns [] when hooks is empty', () => {
    expect(kiro.lintHooks({ ...emptyCanonical(), hooks: {} as never })).toEqual([]);
  });
});

describe('windsurf lint', () => {
  it('lintMcp returns [] when mcp is null', () => {
    expect(windsurf.lintMcp(emptyCanonical())).toEqual([]);
  });
  it('lintMcp returns [] when mcpServers is empty', () => {
    expect(windsurf.lintMcp({ ...emptyCanonical(), mcp: { mcpServers: {} } as never })).toEqual([]);
  });
  it('lintCommands returns [] when commands have no metadata', () => {
    expect(windsurf.lintCommands(emptyCanonical())).toEqual([]);
  });
});

describe('junie lint', () => {
  it('lintMcp returns [] when mcp is null', () => {
    expect(junie.lintMcp(emptyCanonical())).toEqual([]);
  });
  it('lintMcp returns [] when mcpServers is empty', () => {
    expect(junie.lintMcp({ ...emptyCanonical(), mcp: { mcpServers: {} } as never })).toEqual([]);
  });
});
