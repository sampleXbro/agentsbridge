/**
 * Bug #3: scoped-settings sidecars must respect the enabled-feature set.
 *
 * `generateGeminiSettingsFiles` projects mcpServers / hooks / experimental.enableAgents
 * from canonical content. When a feature is DISABLED (not in the enabled-feature set),
 * its corresponding settings key must be ABSENT from `.gemini/settings.json`.
 */

import { describe, it, expect } from 'vitest';
import { generateGeminiSettingsFiles } from '../../../../src/targets/gemini-cli/generator/settings.js';
import { GEMINI_SETTINGS } from '../../../../src/targets/gemini-cli/constants.js';
import type { CanonicalFiles, CanonicalAgent } from '../../../../src/core/types.js';

function fullCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [{ name: 'reviewer', description: 'd', body: 'b' } as unknown as CanonicalAgent],
    skills: [],
    mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx', args: ['x'] } } },
    permissions: null,
    hooks: {
      PreToolUse: [{ matcher: 'Bash', command: 'echo hi' }],
    },
    ignore: [],
  };
}

function parse(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

const ALL = new Set([
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
]);

describe('generateGeminiSettingsFiles — feature gating', () => {
  it('includes every key when all features are enabled', () => {
    const [out] = generateGeminiSettingsFiles(fullCanonical(), ALL);
    expect(out.path).toBe(GEMINI_SETTINGS);
    const json = parse(out.content);
    expect(Object.keys(json).sort()).toEqual(['context', 'experimental', 'hooks', 'mcpServers']);
  });

  it('omits mcpServers when mcp is disabled', () => {
    const enabled = new Set(['rules', 'hooks', 'agents']);
    const [out] = generateGeminiSettingsFiles(fullCanonical(), enabled);
    const json = parse(out.content);
    expect(json).not.toHaveProperty('mcpServers');
    expect(json).toHaveProperty('hooks');
    expect(json).toHaveProperty('experimental');
  });

  it('omits hooks when hooks is disabled', () => {
    const enabled = new Set(['rules', 'mcp', 'agents']);
    const [out] = generateGeminiSettingsFiles(fullCanonical(), enabled);
    const json = parse(out.content);
    expect(json).not.toHaveProperty('hooks');
    expect(json).toHaveProperty('mcpServers');
  });

  it('omits experimental.enableAgents when agents is disabled', () => {
    const enabled = new Set(['rules', 'mcp', 'hooks']);
    const [out] = generateGeminiSettingsFiles(fullCanonical(), enabled);
    const json = parse(out.content);
    expect(json).not.toHaveProperty('experimental');
    expect(json).toHaveProperty('mcpServers');
    expect(json).toHaveProperty('hooks');
  });

  it('emits nothing when no contributing feature is enabled', () => {
    const enabled = new Set(['rules', 'commands', 'skills']);
    const out = generateGeminiSettingsFiles(fullCanonical(), enabled);
    expect(out).toEqual([]);
  });
});
