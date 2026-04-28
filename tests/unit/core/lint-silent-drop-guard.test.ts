/**
 * Silent-drop lint guard: lint must visibly warn whenever canonical content for
 * a feature exists but the target capability is `'none'`, so users never
 * silently lose permissions, hooks, or MCP servers in cross-target generation.
 */

import { describe, expect, it } from 'vitest';
import type { CanonicalFiles, LintDiagnostic } from '../../../src/core/types.js';
import { lintSilentFeatureDrops } from '../../../src/core/lint/shared/silent-drop-guard.js';
import type { TargetCapabilities } from '../../../src/targets/catalog/target.interface.js';

function nativeCaps(): TargetCapabilities {
  return {
    rules: 'native',
    additionalRules: 'native',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'native',
  };
}

function noneCaps(): TargetCapabilities {
  return {
    rules: 'native',
    additionalRules: 'none',
    commands: 'none',
    agents: 'none',
    skills: 'none',
    mcp: 'none',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  };
}

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

function findByFeature(diagnostics: LintDiagnostic[], file: string): LintDiagnostic | undefined {
  return diagnostics.find((d) => d.file === file);
}

describe('lintSilentFeatureDrops', () => {
  it('emits no diagnostics when canonical content is empty', () => {
    expect(
      lintSilentFeatureDrops({
        target: 'cline',
        capabilities: noneCaps(),
        canonical: emptyCanonical(),
        enabledFeatures: ['rules', 'permissions', 'hooks', 'mcp', 'commands'],
      }),
    ).toEqual([]);
  });

  it('emits no diagnostics when target supports every feature natively', () => {
    const canonical = emptyCanonical();
    canonical.permissions = { allow: ['Read'], deny: [] };
    canonical.hooks = { sessionStart: [{ matcher: '*', command: 'echo hi' }] };
    canonical.mcp = { mcpServers: { srv: { command: 'node', args: ['srv.js'] } } };
    expect(
      lintSilentFeatureDrops({
        target: 'claude-code',
        capabilities: nativeCaps(),
        canonical,
        enabledFeatures: ['permissions', 'hooks', 'mcp'],
      }),
    ).toEqual([]);
  });

  it('warns when permissions are non-empty but target has none-level support', () => {
    const canonical = emptyCanonical();
    canonical.permissions = { allow: ['Read'], deny: ['Bash(rm:*)'] };
    const diagnostics = lintSilentFeatureDrops({
      target: 'cline',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['permissions'],
    });
    const diag = findByFeature(diagnostics, '.agentsmesh/permissions.yaml');
    expect(diag?.level).toBe('warning');
    expect(diag?.target).toBe('cline');
    expect(diag?.message).toMatch(/permissions/i);
    expect(diag?.message).toMatch(/dropped|not projected|silently/i);
  });

  it('warns when hooks are non-empty but target has none-level support', () => {
    const canonical = emptyCanonical();
    canonical.hooks = { sessionStart: [{ matcher: '*', command: 'echo hi' }] };
    const diagnostics = lintSilentFeatureDrops({
      target: 'continue',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['hooks'],
    });
    const diag = findByFeature(diagnostics, '.agentsmesh/hooks.yaml');
    expect(diag?.level).toBe('warning');
    expect(diag?.message).toMatch(/hooks/i);
  });

  it('warns when mcp servers are non-empty but target has none-level support', () => {
    const canonical = emptyCanonical();
    canonical.mcp = { mcpServers: { srv: { command: 'node', args: ['srv.js'] } } };
    const diagnostics = lintSilentFeatureDrops({
      target: 'continue',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['mcp'],
    });
    const diag = findByFeature(diagnostics, '.agentsmesh/mcp.json');
    expect(diag?.level).toBe('warning');
    expect(diag?.message).toMatch(/mcp/i);
  });

  it('skips a feature when it is not in enabledFeatures even if canonical is non-empty', () => {
    const canonical = emptyCanonical();
    canonical.permissions = { allow: ['Read'], deny: [] };
    expect(
      lintSilentFeatureDrops({
        target: 'cline',
        capabilities: noneCaps(),
        canonical,
        enabledFeatures: ['rules'],
      }),
    ).toEqual([]);
  });

  it('does not warn when permissions are empty arrays even if feature is enabled', () => {
    const canonical = emptyCanonical();
    canonical.permissions = { allow: [], deny: [], ask: [] };
    expect(
      lintSilentFeatureDrops({
        target: 'cline',
        capabilities: noneCaps(),
        canonical,
        enabledFeatures: ['permissions'],
      }),
    ).toEqual([]);
  });

  it('does not warn when hooks object exists but every event list is empty', () => {
    const canonical = emptyCanonical();
    canonical.hooks = { sessionStart: [], notification: [] };
    expect(
      lintSilentFeatureDrops({
        target: 'continue',
        capabilities: noneCaps(),
        canonical,
        enabledFeatures: ['hooks'],
      }),
    ).toEqual([]);
  });

  it('does not warn when mcp object exists but mcpServers is empty', () => {
    const canonical = emptyCanonical();
    canonical.mcp = { mcpServers: {} };
    expect(
      lintSilentFeatureDrops({
        target: 'continue',
        capabilities: noneCaps(),
        canonical,
        enabledFeatures: ['mcp'],
      }),
    ).toEqual([]);
  });

  it('emits one diagnostic per missing feature, not per entry', () => {
    const canonical = emptyCanonical();
    canonical.permissions = { allow: ['A', 'B', 'C'], deny: ['X', 'Y'] };
    canonical.hooks = {
      sessionStart: [{ matcher: '*', command: 'echo' }],
      notification: [{ matcher: '*', command: 'echo' }],
    };
    canonical.mcp = {
      mcpServers: {
        a: { command: 'a' },
        b: { command: 'b' },
      },
    };
    const diagnostics = lintSilentFeatureDrops({
      target: 'continue',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['permissions', 'hooks', 'mcp'],
    });
    expect(diagnostics).toHaveLength(3);
  });

  it('does not warn when capability level is partial', () => {
    const canonical = emptyCanonical();
    canonical.permissions = { allow: ['Read'], deny: [] };
    const caps = noneCaps();
    caps.permissions = 'partial';
    expect(
      lintSilentFeatureDrops({
        target: 'cursor',
        capabilities: caps,
        canonical,
        enabledFeatures: ['permissions'],
      }),
    ).toEqual([]);
  });

  it('does not warn when capability level is embedded', () => {
    const canonical = emptyCanonical();
    canonical.commands = [
      { source: 's', name: 'review', description: '', allowedTools: [], body: 'b' },
    ];
    const caps = noneCaps();
    caps.commands = 'embedded';
    expect(
      lintSilentFeatureDrops({
        target: 'test-target',
        capabilities: caps,
        canonical,
        enabledFeatures: ['commands'],
      }),
    ).toEqual([]);
  });

  it('warns for commands with none-level support', () => {
    const canonical = emptyCanonical();
    canonical.commands = [
      { source: 's', name: 'review', description: '', allowedTools: [], body: 'b' },
    ];
    const diagnostics = lintSilentFeatureDrops({
      target: 'test-target',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['commands'],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(/commands/i);
  });

  it('warns for agents with none-level support', () => {
    const canonical = emptyCanonical();
    canonical.agents = [
      {
        source: 's',
        name: 'reviewer',
        description: '',
        tools: [],
        disallowedTools: [],
        model: '',
        permissionMode: '',
        maxTurns: 0,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: 'b',
      },
    ];
    const diagnostics = lintSilentFeatureDrops({
      target: 'test-target',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['agents'],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(/agents/i);
  });

  it('warns for skills with none-level support', () => {
    const canonical = emptyCanonical();
    canonical.skills = [
      { source: 's', name: 'api-gen', description: '', body: 'b', supportingFiles: [] },
    ];
    const diagnostics = lintSilentFeatureDrops({
      target: 'test-target',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['skills'],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(/skills/i);
  });

  it('warns for ignore patterns with none-level support', () => {
    const canonical = emptyCanonical();
    canonical.ignore = ['node_modules/', 'dist/'];
    const diagnostics = lintSilentFeatureDrops({
      target: 'test-target',
      capabilities: noneCaps(),
      canonical,
      enabledFeatures: ['ignore'],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(/ignore/i);
  });

  it('does not warn for ignore when patterns array is empty', () => {
    const canonical = emptyCanonical();
    canonical.ignore = [];
    expect(
      lintSilentFeatureDrops({
        target: 'test-target',
        capabilities: noneCaps(),
        canonical,
        enabledFeatures: ['ignore'],
      }),
    ).toEqual([]);
  });
});
