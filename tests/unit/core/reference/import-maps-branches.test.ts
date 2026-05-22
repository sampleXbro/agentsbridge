/**
 * Branch coverage for several import-map builders' uncovered conditional branches.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCodexCliImportPaths } from '../../../../src/core/reference/import-maps/codex-cli.js';
import { buildGeminiCliImportPaths } from '../../../../src/core/reference/import-maps/gemini-cli.js';
import { buildKiroImportPaths } from '../../../../src/core/reference/import-maps/kiro.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-import-maps-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('import-map builders — branch coverage', () => {
  it('buildCodexCliImportPaths: under .codex/rules, maps both .rules and .md, ignores other extensions', async () => {
    mkdirSync(join(root, '.codex', 'rules'), { recursive: true });
    writeFileSync(join(root, '.codex', 'rules', 'style.rules'), 'a');
    writeFileSync(join(root, '.codex', 'rules', 'naming.md'), 'b');
    writeFileSync(join(root, '.codex', 'rules', 'ignored.txt'), 'c');
    const refs = new Map<string, string>();
    await buildCodexCliImportPaths(refs, root, 'project');
    expect(refs.has('.codex/rules/style.rules')).toBe(true);
    expect(refs.has('.codex/rules/naming.md')).toBe(true);
    expect(refs.has('.codex/rules/ignored.txt')).toBe(false);
  });

  it('buildCodexCliImportPaths under global scope sets .codex/AGENTS.md aliases', async () => {
    const refs = new Map<string, string>();
    await buildCodexCliImportPaths(refs, root, 'global');
    expect(refs.get('.codex/AGENTS.md')).toContain('rules/_root.md');
    expect(refs.get('.codex/AGENTS.override.md')).toContain('rules/_root.md');
    // No legacy AGENTS.md alias in global mode.
    expect(refs.has('AGENTS.md')).toBe(false);
  });

  it('buildGeminiCliImportPaths skips files in .gemini/commands/ that lack .toml/.md ext', async () => {
    mkdirSync(join(root, '.gemini', 'commands'), { recursive: true });
    writeFileSync(join(root, '.gemini', 'commands', 'build.toml'), 'a');
    writeFileSync(join(root, '.gemini', 'commands', 'README'), 'b');
    const refs = new Map<string, string>();
    await buildGeminiCliImportPaths(refs, root);
    expect(refs.has('.gemini/commands/build.toml')).toBe(true);
    expect(refs.has('.gemini/commands/README')).toBe(false);
  });

  it('buildGeminiCliImportPaths handles nested commands directory (segments joined with colon)', async () => {
    mkdirSync(join(root, '.gemini', 'commands', 'admin'), { recursive: true });
    writeFileSync(join(root, '.gemini', 'commands', 'admin', 'sync.toml'), 'a');
    const refs = new Map<string, string>();
    await buildGeminiCliImportPaths(refs, root);
    // segments joined with ':' for nested commands
    expect(refs.get('.gemini/commands/admin/sync.toml')).toMatch(/admin:sync\.md$/);
  });

  it('buildKiroImportPaths in global scope excludes the AGENTS.md from steering dir mappings', async () => {
    mkdirSync(join(root, '.kiro', 'steering'), { recursive: true });
    writeFileSync(join(root, '.kiro', 'steering', 'AGENTS.md'), 'root');
    writeFileSync(join(root, '.kiro', 'steering', 'style.md'), 'rule');
    const refs = new Map<string, string>();
    await buildKiroImportPaths(refs, root, 'global');
    expect(refs.has('.kiro/steering/style.md')).toBe(true);
    // The global AGENTS.md is mapped via the dedicated AB_RULES/_root mapping, not duplicated.
    expect(refs.has('.kiro/steering/AGENTS.md')).toBe(true);
    // value for the root alias must be _root.md, not a generic rules/<name>.md
    expect(refs.get('.kiro/steering/AGENTS.md')).toMatch(/_root\.md$/);
  });

  it('buildKiroImportPaths in project scope maps KIRO_AGENTS_MD and steering dir', async () => {
    mkdirSync(join(root, '.kiro', 'steering'), { recursive: true });
    writeFileSync(join(root, '.kiro', 'steering', 'style.md'), 'rule');
    const refs = new Map<string, string>();
    await buildKiroImportPaths(refs, root, 'project');
    expect(refs.has('.kiro/steering/style.md')).toBe(true);
  });
});
