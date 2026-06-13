/**
 * Bug #3: zed / amp / augment-code scoped-settings sidecars must respect the
 * enabled-feature set passed to `emitScopedSettings`.
 *
 * - zed / amp only project `mcpServers` -> gated on `mcp`.
 * - augment-code projects `mcpServers` (gated on `mcp`) and `hooks` (gated on `hooks`).
 */

import { describe, it, expect } from 'vitest';
import { descriptor as zedDescriptor } from '../../../src/targets/zed/index.js';
import { descriptor as ampDescriptor } from '../../../src/targets/amp/index.js';
import { descriptor as augmentDescriptor } from '../../../src/targets/augment-code/index.js';
import { ZED_SETTINGS_FILE } from '../../../src/targets/zed/constants.js';
import { AMP_MCP_FILE } from '../../../src/targets/amp/constants.js';
import { AUGMENT_CODE_SETTINGS_FILE } from '../../../src/targets/augment-code/constants.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function fullCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx', args: ['x'] } } },
    permissions: null,
    hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi' }] },
    ignore: [],
  };
}

function parse(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

const WITH_MCP = new Set(['rules', 'mcp']);
const WITHOUT_MCP = new Set(['rules', 'hooks']);
const MCP_AND_HOOKS = new Set(['rules', 'mcp', 'hooks']);

describe('zed emitScopedSettings — feature gating', () => {
  it('emits context_servers when mcp is enabled', () => {
    const out = zedDescriptor.emitScopedSettings!(fullCanonical(), 'project', WITH_MCP);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe(ZED_SETTINGS_FILE);
    expect(parse(out[0].content)).toHaveProperty('context_servers');
  });

  it('emits nothing when mcp is disabled', () => {
    const out = zedDescriptor.emitScopedSettings!(fullCanonical(), 'project', WITHOUT_MCP);
    expect(out).toEqual([]);
  });
});

describe('amp emitScopedSettings — feature gating', () => {
  it('emits amp.mcpServers when mcp is enabled', () => {
    const out = ampDescriptor.emitScopedSettings!(fullCanonical(), 'project', WITH_MCP);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe(AMP_MCP_FILE);
    expect(parse(out[0].content)).toHaveProperty('amp.mcpServers');
  });

  it('emits nothing when mcp is disabled', () => {
    const out = ampDescriptor.emitScopedSettings!(fullCanonical(), 'project', WITHOUT_MCP);
    expect(out).toEqual([]);
  });
});

describe('augment-code emitScopedSettings — feature gating', () => {
  it('emits both mcpServers and hooks when both enabled', () => {
    const out = augmentDescriptor.emitScopedSettings!(fullCanonical(), 'project', MCP_AND_HOOKS);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe(AUGMENT_CODE_SETTINGS_FILE);
    const json = parse(out[0].content);
    expect(Object.keys(json).sort()).toEqual(['hooks', 'mcpServers']);
  });

  it('omits mcpServers when mcp is disabled', () => {
    const out = augmentDescriptor.emitScopedSettings!(fullCanonical(), 'project', WITHOUT_MCP);
    expect(out).toHaveLength(1);
    const json = parse(out[0].content);
    expect(json).not.toHaveProperty('mcpServers');
    expect(json).toHaveProperty('hooks');
  });

  it('omits hooks when hooks is disabled', () => {
    const out = augmentDescriptor.emitScopedSettings!(fullCanonical(), 'project', WITH_MCP);
    expect(out).toHaveLength(1);
    const json = parse(out[0].content);
    expect(json).not.toHaveProperty('hooks');
    expect(json).toHaveProperty('mcpServers');
  });

  it('emits nothing when neither mcp nor hooks is enabled', () => {
    const out = augmentDescriptor.emitScopedSettings!(
      fullCanonical(),
      'project',
      new Set(['rules']),
    );
    expect(out).toEqual([]);
  });
});
