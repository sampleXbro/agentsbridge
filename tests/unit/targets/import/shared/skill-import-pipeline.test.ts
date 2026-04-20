import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normalizeProjectedAgentSkill,
  readNativeSkill,
  findDirectorySkills,
} from '../../../../../src/targets/import/shared/skill-import-pipeline.js';

describe('skill-import-pipeline', () => {
  it('normalizeProjectedAgentSkill strips projection markers', () => {
    const raw = `---
projected_from_agent: true
agent_name: "reviewer"
name: example
description: "d"
---

Body here`;
    const out = normalizeProjectedAgentSkill(raw);
    expect(out).toContain('Body here');
    expect(out).not.toContain('projected_from_agent');
    expect(out).not.toContain('agent_name');
  });

  it('readNativeSkill skips reserved filenames and returns SKILL entries', async () => {
    const dir = join(tmpdir(), `am-skill-${Date.now()}`);
    mkdirSync(join(dir, 'my-skill'), { recursive: true });
    writeFileSync(join(dir, 'my-skill', 'SKILL.md'), '---\nname: my-skill\n---\n\nx');
    writeFileSync(join(dir, 'my-skill', '.gitkeep'), '');

    const entries = await readNativeSkill(join(dir, 'my-skill'));
    expect(entries.some((e) => e.relativePath === 'SKILL.md')).toBe(true);
    expect(entries.some((e) => e.relativePath === '.gitkeep')).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it('findDirectorySkills discovers nested SKILL.md roots', async () => {
    const dir = join(tmpdir(), `am-skills-${Date.now()}`);
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'SKILL.md'), '---\n---\n');

    const map = await findDirectorySkills(dir);
    expect(map.get('b')).toBe(join(dir, 'a', 'b'));

    rmSync(dir, { recursive: true, force: true });
  });
});
