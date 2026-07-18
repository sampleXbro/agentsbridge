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
import {
  QWEN_GLOBAL_ROOT,
  QWEN_GLOBAL_SETTINGS,
  QWEN_GLOBAL_RULES_DIR,
  QWEN_ROOT,
} from '../../../../src/targets/qwen-code/constants.js';
import {
  ROO_CODE_GLOBAL_AGENTS_MD,
  ROO_CODE_GLOBAL_MCP_FILE,
  ROO_CODE_GLOBAL_ROOT_RULE,
  ROO_CODE_GLOBAL_RULES_DIR,
} from '../../../../src/targets/roo-code/constants.js';
import {
  OPENCODE_GLOBAL_AGENTS_MD,
  OPENCODE_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/opencode/constants.js';
import {
  KILO_CODE_GLOBAL_AGENTS_MD,
  KILO_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/kilo-code/constants.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-global-maps-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('per-target import-map builders — global-scope branches', () => {
  it('qwen-code global scope sets exactly the global root + settings aliases and skips the project root', async () => {
    const refs = new Map<string, string>();
    await buildQwenCodeImportPaths(refs, root, 'global');
    expect(refs.has(QWEN_ROOT)).toBe(false);
    expect(refs.get(QWEN_GLOBAL_ROOT)).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get(QWEN_GLOBAL_SETTINGS)).toBe('.agentsmesh/mcp.json');
    // No `.qwen/commands` files on disk → exactly two entries (root + settings).
    expect([...refs.keys()].sort()).toEqual([QWEN_GLOBAL_ROOT, QWEN_GLOBAL_SETTINGS].sort());
  });

  it('qwen-code global scope discovers commands/agents/skills in global dirs', async () => {
    const home = root;
    const qwenGlobalCommands = '.qwen/commands';
    mkdirSync(join(home, qwenGlobalCommands), { recursive: true });
    writeFileSync(join(home, qwenGlobalCommands, 'sync.md'), 'cmd');
    const refs = new Map<string, string>();
    await buildQwenCodeImportPaths(refs, home, 'global');
    expect(refs.get('.qwen/commands/sync.md')).toBe('.agentsmesh/commands/sync.md');
  });

  it('qwen-code global scope discovers non-root rules in the global rules dir (native additionalRules)', async () => {
    const home = root;
    mkdirSync(join(home, QWEN_GLOBAL_RULES_DIR), { recursive: true });
    writeFileSync(join(home, QWEN_GLOBAL_RULES_DIR, 'typescript.md'), 'Use strict mode.');
    const refs = new Map<string, string>();
    await buildQwenCodeImportPaths(refs, home, 'global');
    expect(refs.get(`${QWEN_GLOBAL_RULES_DIR}/typescript.md`)).toBe(
      '.agentsmesh/rules/typescript.md',
    );
  });

  it('roo-code global scope maps the root rule (.roo/rules/00-root.md) to _root.md as primary alias', async () => {
    const refs = new Map<string, string>();
    await buildRooCodeImportPaths(refs, root, 'global');
    // The primary mapping: the file the generator actually writes
    expect(refs.get(ROO_CODE_GLOBAL_ROOT_RULE)).toBe('.agentsmesh/rules/_root.md');
    // Legacy fallback kept for users migrating from old output
    expect(refs.get(ROO_CODE_GLOBAL_AGENTS_MD)).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get(ROO_CODE_GLOBAL_MCP_FILE)).toBe('.agentsmesh/mcp.json');
    // Exactly three entries when no extra rules/commands/skills on disk
    expect(refs.size).toBe(3);
  });

  it('roo-code global scope skips root rule when iterating the global rules dir (no duplicate entry)', async () => {
    // Create the root rule file on disk — the iteration must skip it so it
    // does NOT overwrite the explicit ROO_CODE_GLOBAL_ROOT_RULE → _root.md mapping.
    mkdirSync(join(root, ROO_CODE_GLOBAL_RULES_DIR), { recursive: true });
    writeFileSync(join(root, ROO_CODE_GLOBAL_ROOT_RULE), '# Root');
    writeFileSync(join(root, ROO_CODE_GLOBAL_RULES_DIR, 'typescript.md'), 'Use strict mode.');

    const refs = new Map<string, string>();
    await buildRooCodeImportPaths(refs, root, 'global');
    // Root rule must map to _root.md (not 00-root.md)
    expect(refs.get(ROO_CODE_GLOBAL_ROOT_RULE)).toBe('.agentsmesh/rules/_root.md');
    // Non-root rule mapped normally
    expect(refs.get(`${ROO_CODE_GLOBAL_RULES_DIR}/typescript.md`)).toBe(
      '.agentsmesh/rules/typescript.md',
    );
    // No duplicate entry for 00-root that maps to .agentsmesh/rules/00-root.md
    const allValues = [...refs.values()];
    const rootMdMappings = allValues.filter((v) => v === '.agentsmesh/rules/_root.md');
    // AGENTS.md and 00-root.md both alias to _root.md → exactly two entries pointing there
    expect(rootMdMappings.length).toBe(2);
    // The wrongly-mapped path must NOT exist
    expect(refs.has('.agentsmesh/rules/00-root.md')).toBe(false);
  });

  it('opencode global scope sets exactly AGENTS.md and config-file aliases when no global content', async () => {
    const refs = new Map<string, string>();
    await buildOpencodeImportPaths(refs, root, 'global');
    expect(refs.get(OPENCODE_GLOBAL_AGENTS_MD)).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get(OPENCODE_GLOBAL_CONFIG_FILE)).toBe('.agentsmesh/mcp.json');
    expect(refs.size).toBe(2);
  });

  it('kilo-code global scope sets exactly AGENTS.md root alias and shared kilo.jsonc alias when no global content', async () => {
    const refs = new Map<string, string>();
    await buildKiloCodeImportPaths(refs, root, 'global');
    expect(refs.get(KILO_CODE_GLOBAL_AGENTS_MD)).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get(KILO_GLOBAL_CONFIG_FILE)).toBe('.agentsmesh/mcp.json');
    expect(refs.size).toBe(2);
  });
});
