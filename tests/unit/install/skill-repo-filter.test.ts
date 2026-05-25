import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSkillFrontmatterName } from '../../../src/install/source/skill-repo-filter.js';

const ROOT = join(tmpdir(), 'am-skill-repo-filter-test');

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('readSkillFrontmatterName', () => {
  it('returns the sanitized name when frontmatter parses', async () => {
    mkdirSync(ROOT, { recursive: true });
    const skillMd = join(ROOT, 'SKILL.md');
    writeFileSync(skillMd, '---\nname: My Cool Skill!\n---\n\nBody\n');
    const name = await readSkillFrontmatterName(skillMd);
    expect(name).toBe('my-cool-skill');
  });

  it('returns empty string when frontmatter YAML is invalid (no throw)', async () => {
    mkdirSync(ROOT, { recursive: true });
    const skillMd = join(ROOT, 'SKILL.md');
    writeFileSync(
      skillMd,
      '---\ndescription: Repair tool -- fixes things\nargument-hint: [a] [b]\n---\n\nBody\n',
    );
    const name = await readSkillFrontmatterName(skillMd);
    expect(name).toBe('');
  });

  it('returns empty string when file is empty', async () => {
    mkdirSync(ROOT, { recursive: true });
    const skillMd = join(ROOT, 'SKILL.md');
    writeFileSync(skillMd, '');
    const name = await readSkillFrontmatterName(skillMd);
    expect(name).toBe('');
  });
});
