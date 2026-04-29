import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSkillDirectory } from '../../../src/canonical/features/skills.js';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-skills-extra-'));
});
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('parseSkillDirectory — uncovered branches', () => {
  it('returns null when SKILL.md is missing', async () => {
    expect(await parseSkillDirectory(dir)).toBeNull();
  });

  it('uses basename(skillDir) when no frontmatter name', async () => {
    const skillDir = join(dir, 'my-skill');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\n---\nbody');
    const out = await parseSkillDirectory(skillDir);
    expect(out!.name).toBe('my-skill');
  });

  it('uses frontmatter name (sanitized) when present', async () => {
    const skillDir = join(dir, 'fallback');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: My Skill!\n---\nbody');
    const out = await parseSkillDirectory(skillDir);
    expect(out!.name).toBe('my-skill');
  });

  it('returns empty description when frontmatter has none', async () => {
    const skillDir = join(dir, 's');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: a\n---\nbody');
    const out = await parseSkillDirectory(skillDir);
    expect(out!.description).toBe('');
  });

  it('lists supporting files in alphabetical order, excluding SKILL.md', async () => {
    const skillDir = join(dir, 's');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: a\n---\nbody');
    writeFileSync(join(skillDir, 'b.md'), 'B');
    writeFileSync(join(skillDir, 'a.md'), 'A');
    const out = await parseSkillDirectory(skillDir);
    expect(out!.supportingFiles.map((f) => f.relativePath)).toEqual(['a.md', 'b.md']);
  });

  it('skips .DS_Store files in supporting files', async () => {
    const skillDir = join(dir, 's');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: a\n---\n');
    writeFileSync(join(skillDir, '.DS_Store'), 'binary');
    writeFileSync(join(skillDir, 'real.md'), 'R');
    const out = await parseSkillDirectory(skillDir);
    expect(out!.supportingFiles.map((f) => f.relativePath)).toEqual(['real.md']);
  });

  it('skips .git and node_modules dirs', async () => {
    const skillDir = join(dir, 's');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: a\n---\n');
    mkdirSync(join(skillDir, '.git'));
    writeFileSync(join(skillDir, '.git/HEAD'), 'ref');
    mkdirSync(join(skillDir, 'node_modules'));
    writeFileSync(join(skillDir, 'node_modules/x.js'), 'x');
    writeFileSync(join(skillDir, 'real.md'), 'R');
    const out = await parseSkillDirectory(skillDir);
    expect(out!.supportingFiles.map((f) => f.relativePath)).toEqual(['real.md']);
  });
});
