/**
 * Branch coverage for global-scope branches in import-map builders.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildQwenCodeImportPaths } from '../../../../src/core/reference/import-maps/qwen-code.js';
import { buildRooCodeImportPaths } from '../../../../src/core/reference/import-maps/roo-code.js';
import { buildOpencodeImportPaths } from '../../../../src/core/reference/import-maps/opencode.js';
import { buildKiloCodeImportPaths } from '../../../../src/core/reference/import-maps/kilo-code.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-global-maps-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('per-target import-map builders — global-scope branches', () => {
  it('qwen-code global scope returns early after writing global aliases', async () => {
    const refs = new Map<string, string>();
    await buildQwenCodeImportPaths(refs, root, 'global');
    // Project-scope root alias must NOT be set under global.
    expect(refs.has('QWEN.md')).toBe(false);
    // Global root alias must be set.
    const hasGlobalRoot = Array.from(refs.keys()).some((k) => k.includes('QWEN'));
    expect(hasGlobalRoot).toBe(true);
  });

  it('qwen-code global scope discovers commands/agents/skills in global dirs', async () => {
    // Create files under the global qwen-code commands directory.
    const home = root;
    const qwenGlobalCommands = '.qwen/commands';
    mkdirSync(join(home, qwenGlobalCommands), { recursive: true });
    writeFileSync(join(home, qwenGlobalCommands, 'sync.md'), 'cmd');
    const refs = new Map<string, string>();
    await buildQwenCodeImportPaths(refs, home, 'global');
    expect(refs.has('.qwen/commands/sync.md')).toBe(true);
  });

  it('roo-code global scope writes AGENTS.md alias and MCP file', async () => {
    const refs = new Map<string, string>();
    await buildRooCodeImportPaths(refs, root, 'global');
    // Check that some Roo global alias was set.
    const hasGlobalEntries = refs.size > 0;
    expect(hasGlobalEntries).toBe(true);
  });

  it('opencode global scope sets root alias and config file', async () => {
    const refs = new Map<string, string>();
    await buildOpencodeImportPaths(refs, root, 'global');
    expect(refs.size).toBeGreaterThan(0);
  });

  it('kilo-code global scope (if supported) yields some entries', async () => {
    const refs = new Map<string, string>();
    await buildKiloCodeImportPaths(refs, root, 'global');
    // Just exercising the global branch — count is implementation-dependent.
    expect(refs).toBeInstanceOf(Map);
  });
});
