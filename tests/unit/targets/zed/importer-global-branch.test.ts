/**
 * Branch coverage for src/targets/zed/importer.ts:
 * - scope === 'global' branch (uses ZED_GLOBAL_SETTINGS_FILE for MCP).
 * - global scope imports skills from .agents/skills/ (global skills round-trip).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromZed } from '../../../../src/targets/zed/importer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-zed-global-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importFromZed — global scope branch', () => {
  it('uses ZED_GLOBAL_SETTINGS_FILE under global scope (line 27 false branch)', async () => {
    const results = await importFromZed(projectRoot, { scope: 'global' });
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('uses ZED_SETTINGS_FILE under project scope (default)', async () => {
    const results = await importFromZed(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('imports skills from .agents/skills/ in global scope (round-trip symmetry)', async () => {
    const skillDir = join(projectRoot, '.agents', 'skills', 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\ndescription: Test skill\n---\n# My Skill\n\nDoes things.',
    );
    mkdirSync(join(projectRoot, '.agentsmesh'), { recursive: true });

    const results = await importFromZed(projectRoot, { scope: 'global' });

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults).toHaveLength(1);
    expect(skillResults[0]!.toPath).toBe('.agentsmesh/skills/my-skill/SKILL.md');
    expect(skillResults[0]!.fromTool).toBe('zed');
  });

  it('imports skills from .agents/skills/ in project scope', async () => {
    const skillDir = join(projectRoot, '.agents', 'skills', 'proj-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: proj-skill\ndescription: Project skill\n---\n# Proj Skill\n\nDoes things.',
    );
    mkdirSync(join(projectRoot, '.agentsmesh'), { recursive: true });

    const results = await importFromZed(projectRoot, { scope: 'project' });

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults).toHaveLength(1);
    expect(skillResults[0]!.toPath).toBe('.agentsmesh/skills/proj-skill/SKILL.md');
    expect(skillResults[0]!.fromTool).toBe('zed');
  });
});
