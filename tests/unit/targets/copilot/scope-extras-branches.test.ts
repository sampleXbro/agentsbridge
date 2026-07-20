/**
 * Branch coverage for copilot scope-extras: scope/feature guards, no-root
 * case, and the `existing === content` (unchanged) branch.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCopilotGlobalExtras } from '../../../../src/targets/copilot/scope-extras.js';
import { COPILOT_GLOBAL_AGENTS_MD } from '../../../../src/targets/copilot/constants.js';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

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

function rootRule(body: string): CanonicalRule {
  return {
    source: '/.agentsmesh/rules/_root.md',
    root: true,
    targets: [],
    description: '',
    globs: [],
    body,
  };
}

describe('generateCopilotGlobalExtras — branch coverage', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cop-scope-extras-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns [] when scope is project', async () => {
    const result = await generateCopilotGlobalExtras(
      { ...emptyCanonical(), rules: [rootRule('x')] },
      root,
      'project',
      new Set(['rules']),
    );
    expect(result).toEqual([]);
  });

  it('returns [] when scope is global but rules feature is disabled', async () => {
    const result = await generateCopilotGlobalExtras(
      { ...emptyCanonical(), rules: [rootRule('x')] },
      root,
      'global',
      new Set(['commands']),
    );
    expect(result).toEqual([]);
  });

  it('returns [] when there is no root rule', async () => {
    const result = await generateCopilotGlobalExtras(
      emptyCanonical(),
      root,
      'global',
      new Set(['rules']),
    );
    expect(result).toEqual([]);
  });

  it('returns status="created" when AGENTS.md does not exist', async () => {
    const result = await generateCopilotGlobalExtras(
      { ...emptyCanonical(), rules: [rootRule('hello body')] },
      root,
      'global',
      new Set(['rules']),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('created');
  });

  it('returns status="unchanged" when AGENTS.md content already matches', async () => {
    const dest = join(root, COPILOT_GLOBAL_AGENTS_MD);
    mkdirSync(join(dest, '..'), { recursive: true });
    writeFileSync(dest, 'same body');
    const result = await generateCopilotGlobalExtras(
      { ...emptyCanonical(), rules: [rootRule('same body')] },
      root,
      'global',
      new Set(['rules']),
    );
    expect(result[0]!.status).toBe('unchanged');
  });

  it('returns status="updated" when AGENTS.md exists but differs', async () => {
    const dest = join(root, COPILOT_GLOBAL_AGENTS_MD);
    mkdirSync(join(dest, '..'), { recursive: true });
    writeFileSync(dest, 'old');
    const result = await generateCopilotGlobalExtras(
      { ...emptyCanonical(), rules: [rootRule('new')] },
      root,
      'global',
      new Set(['rules']),
    );
    expect(result[0]!.status).toBe('updated');
  });

  it('includes ~/.copilot/mcp-config.json when mcp feature is enabled', async () => {
    const result = await generateCopilotGlobalExtras(
      {
        ...emptyCanonical(),
        mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } } },
      },
      root,
      'global',
      new Set(['mcp']),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('.copilot/mcp-config.json');
    expect(result[0]!.content).toContain('mcpServers');
  });

  it('excludes MCP output when mcp feature is disabled', async () => {
    const result = await generateCopilotGlobalExtras(
      {
        ...emptyCanonical(),
        mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } } },
      },
      root,
      'global',
      new Set(['rules']),
    );
    expect(result).toEqual([]);
  });

  it('includes ~/.copilot/hooks/agentsmesh.json when hooks feature is enabled', async () => {
    const result = await generateCopilotGlobalExtras(
      {
        ...emptyCanonical(),
        hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi', type: 'command' }] },
      },
      root,
      'global',
      new Set(['hooks']),
    );
    const main = result.find((r) => r.path === '.copilot/hooks/agentsmesh.json');
    expect(main).toBeDefined();
    expect(main!.content).toContain('"matcher": "Bash"');
  });

  it('excludes hooks output when hooks feature is disabled', async () => {
    const result = await generateCopilotGlobalExtras(
      {
        ...emptyCanonical(),
        hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi', type: 'command' }] },
      },
      root,
      'global',
      new Set(['rules']),
    );
    expect(result).toEqual([]);
  });
});
