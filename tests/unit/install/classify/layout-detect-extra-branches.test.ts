/**
 * Branch coverage for src/install/classify/layout-detect.ts:
 * - Line 72-73: .toml shape classifier branch.
 * - Line 84: detectCanonical fall-through (no canonical marker hit).
 * - Line 119: detectSkillPack catch branch when SKILL.md stat fails.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { detectLayout } from '../../../../src/install/classify/layout-detect.js';

let contentRoot = '';

beforeEach(() => {
  contentRoot = join(tmpdir(), `am-layout-extra-${randomBytes(8).toString('hex')}`);
  mkdirSync(contentRoot, { recursive: true });
});

afterEach(() => {
  rmSync(contentRoot, { recursive: true, force: true });
});

describe('detectLayout — extra branches', () => {
  it('classifies .toml files in flat collections (FileShape `toml`)', async () => {
    // Codex-style command pack with a .toml shape in commands/.
    mkdirSync(join(contentRoot, 'commands'), { recursive: true });
    writeFileSync(join(contentRoot, 'commands', 'build.toml'), 'description = "build"\n');
    const layout = await detectLayout(contentRoot);
    expect(layout.flatCollections).toContainEqual({
      path: 'commands',
      suggestedAs: 'commands',
      fileShape: 'toml',
    });
  });

  it('returns null canonical when .agentsmesh/ exists but contains no canonical marker', async () => {
    // `.agentsmesh/` exists but no rules/commands/agents/skills/mcp.json/etc inside.
    mkdirSync(join(contentRoot, '.agentsmesh', 'something-unrelated'), { recursive: true });
    const layout = await detectLayout(contentRoot);
    expect(layout.canonical).toBeNull();
  });

  it('skips a skills/<kebab>/ subdir without SKILL.md and continues scanning siblings', async () => {
    // First subdir matches kebab but has no SKILL.md → triggers the catch/continue at line 119.
    // Second subdir is a valid skill so the function eventually returns it.
    mkdirSync(join(contentRoot, 'skills', 'no-skill-here'), { recursive: true });
    mkdirSync(join(contentRoot, 'skills', 'valid'), { recursive: true });
    writeFileSync(join(contentRoot, 'skills', 'valid', 'SKILL.md'), '---\nname: valid\n---\n');
    const layout = await detectLayout(contentRoot);
    expect(layout.skillPack).toEqual({ path: 'skills' });
  });

  it('returns null skillPack when every skills/<kebab>/ subdir lacks SKILL.md', async () => {
    mkdirSync(join(contentRoot, 'skills', 'a'), { recursive: true });
    mkdirSync(join(contentRoot, 'skills', 'b'), { recursive: true });
    const layout = await detectLayout(contentRoot);
    expect(layout.skillPack).toBeNull();
  });
});
