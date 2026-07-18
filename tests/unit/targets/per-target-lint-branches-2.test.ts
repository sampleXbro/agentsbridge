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

  it('lintPermissions returns [] for project scope (no global-only warning leak)', () => {
    const canonical = {
      ...emptyCanonical(),
      permissions: { allow: ['Bash(git *)'], deny: [], ask: [] },
    };
    expect(copilot.lintPermissions(canonical, { scope: 'project' })).toEqual([]);
    expect(copilot.lintPermissions(canonical)).toEqual([]);
  });

  it('lintPermissions returns [] for global scope when canonical permissions is null/empty', () => {
    expect(copilot.lintPermissions(emptyCanonical(), { scope: 'global' })).toEqual([]);
    expect(
      copilot.lintPermissions(
        { ...emptyCanonical(), permissions: { allow: [], deny: [], ask: [] } },
        { scope: 'global' },
      ),
    ).toEqual([]);
  });

  it('lintPermissions warns for global scope when canonical permissions has entries', () => {
    const diags = copilot.lintPermissions(
      { ...emptyCanonical(), permissions: { allow: ['Bash(git *)'], deny: [], ask: [] } },
      { scope: 'global' },
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]!.target).toBe('copilot');
    expect(diags[0]!.message).toContain('embedded');
  });

  it('lintPermissions defaults ask to [] when the field is omitted (legacy fixtures)', () => {
    expect(
      copilot.lintPermissions(
        { ...emptyCanonical(), permissions: { allow: [], deny: [] } },
        { scope: 'global' },
      ),
    ).toEqual([]);
    const diags = copilot.lintPermissions(
      { ...emptyCanonical(), permissions: { allow: ['Bash(git *)'], deny: [] } },
      { scope: 'global' },
    );
    expect(diags).toHaveLength(1);
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

  it('lintPermissions returns [] when permissions is null', () => {
    expect(kiro.lintPermissions(emptyCanonical())).toEqual([]);
  });
  it('lintPermissions returns [] when all permission arrays are empty', () => {
    expect(
      kiro.lintPermissions({
        ...emptyCanonical(),
        permissions: { allow: [], deny: [], ask: [] },
      }),
    ).toEqual([]);
  });
  it('lintPermissions emits one warning when permissions has entries', () => {
    const diags = kiro.lintPermissions({
      ...emptyCanonical(),
      permissions: { allow: ['Bash(git *)'], deny: [], ask: [] },
    });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.target).toBe('kiro');
    expect(diags[0]!.message).toContain('permissions');
  });
  it('lintPermissions defaults ask to [] when field is omitted (legacy fixtures)', () => {
    expect(
      kiro.lintPermissions({
        ...emptyCanonical(),
        permissions: { allow: [], deny: [] },
      }),
    ).toEqual([]);
    const diags = kiro.lintPermissions({
      ...emptyCanonical(),
      permissions: { allow: ['Bash(git *)'], deny: [] },
    });
    expect(diags).toHaveLength(1);
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

  it('lintPermissions returns [] when permissions is null', () => {
    expect(windsurf.lintPermissions(emptyCanonical())).toEqual([]);
  });
  it('lintPermissions returns [] when all permission arrays are empty', () => {
    expect(
      windsurf.lintPermissions({
        ...emptyCanonical(),
        permissions: { allow: [], deny: [], ask: [] },
      }),
    ).toEqual([]);
  });
  it('lintPermissions returns [] when only ask is empty and allow+deny are also empty (legacy fixture without ask field)', () => {
    expect(
      windsurf.lintPermissions({
        ...emptyCanonical(),
        permissions: { allow: [], deny: [] } as never,
      }),
    ).toEqual([]);
  });
  it('lintPermissions emits one warning when allow list has entries', () => {
    const diags = windsurf.lintPermissions({
      ...emptyCanonical(),
      permissions: { allow: ['Bash(git *)'], deny: [], ask: [] },
    });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.target).toBe('windsurf');
    expect(diags[0]!.level).toBe('warning');
    expect(diags[0]!.message).toContain('permissions');
  });
  it('lintPermissions emits one warning when deny list has entries', () => {
    const diags = windsurf.lintPermissions({
      ...emptyCanonical(),
      permissions: { allow: [], deny: ['rm -rf'], ask: [] },
    });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.target).toBe('windsurf');
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
