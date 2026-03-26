import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseSkillDirectory, parseSkills } from '../../../src/canonical/skills.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-skills-test');
const SKILLS_DIR = join(TEST_DIR, '.agentsmesh', 'skills');

beforeEach(() => {
  mkdirSync(SKILLS_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeSkill(name: string, content: string, supportingFiles?: Record<string, string>): void {
  const skillDir = join(SKILLS_DIR, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), content);
  if (supportingFiles) {
    for (const [relPath, data] of Object.entries(supportingFiles)) {
      const full = join(skillDir, relPath);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, data);
    }
  }
}

describe('parseSkills', () => {
  it('parses single skill with frontmatter', async () => {
    writeSkill(
      'api-generator',
      `---
description: Generate REST API endpoints
---

# API Generator

When asked to create an API endpoint:
1. Check existing patterns
2. Use project conventions`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      source: expect.stringContaining('api-generator'),
      name: 'api-generator',
      description: 'Generate REST API endpoints',
      body: expect.stringContaining('API Generator'),
      supportingFiles: [],
    });
  });

  it('derives skill name from directory name', async () => {
    writeSkill(
      'code-reviewer',
      `---
description: Review code
---
Body.`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills[0]?.name).toBe('code-reviewer');
  });

  it('parses supporting files in skill directory', async () => {
    writeSkill(
      'my-skill',
      `---
description: My skill
---
Body.`,
      {
        'template.ts': 'export const t = 1;',
        'subdir/helper.js': 'module.exports = {};',
      },
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.supportingFiles).toHaveLength(2);
    const paths = skills[0]?.supportingFiles.map((f) => f.relativePath).sort() ?? [];
    expect(paths).toContain('template.ts');
    expect(paths).toContain(join('subdir', 'helper.js'));
    const template = skills[0]?.supportingFiles.find((f) => f.relativePath === 'template.ts');
    expect(template?.absolutePath).toContain('template.ts');
  });

  it('excludes SKILL.md from supporting files', async () => {
    writeSkill(
      'solo',
      `---
description: Solo skill
---
Only SKILL.md.`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills[0]?.supportingFiles).toEqual([]);
  });

  it('returns empty array for empty directory', async () => {
    expect(await parseSkills(SKILLS_DIR)).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    expect(await parseSkills(join(TEST_DIR, 'nope'))).toEqual([]);
  });

  it('ignores files (non-directories) directly in skills dir', async () => {
    writeFileSync(join(SKILLS_DIR, 'README.md'), '# readme');
    writeSkill('real-skill', `---\ndescription: Real\n---\nBody.`);
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe('real-skill');
  });

  it('ignores subdirs without SKILL.md', async () => {
    const orphanDir = join(SKILLS_DIR, 'orphan');
    mkdirSync(orphanDir, { recursive: true });
    writeFileSync(join(orphanDir, 'readme.txt'), 'no SKILL');
    writeSkill(
      'valid',
      `---
description: Valid
---
Body.`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe('valid');
  });

  it('excludes .git directory and .DS_Store from supporting files', async () => {
    writeSkill('with-git', `---\ndescription: Has .git\n---\nBody.`, {
      'reference/guide.md': '# Guide',
      '.git/config': '[core]',
      '.git/objects/abc': 'blob',
      '.DS_Store': '\x00',
    });
    const skills = await parseSkills(SKILLS_DIR);
    const paths = skills[0]?.supportingFiles.map((f) => f.relativePath) ?? [];
    expect(paths).toEqual(['reference/guide.md']);
  });

  it('excludes node_modules from supporting files', async () => {
    writeSkill('with-modules', `---\ndescription: Has deps\n---\nBody.`, {
      'utils.js': 'export const x = 1;',
      'node_modules/lodash/index.js': 'module.exports = {};',
    });
    const skills = await parseSkills(SKILLS_DIR);
    const paths = skills[0]?.supportingFiles.map((f) => f.relativePath) ?? [];
    expect(paths).toEqual(['utils.js']);
  });

  it('returns empty description when missing', async () => {
    writeSkill(
      'minimal',
      `---
---
Minimal body.`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills[0]?.description).toBe('');
  });

  it('always uses directory name in parseSkills (canonical skills)', async () => {
    writeSkill(
      'my-dir-name',
      `---
name: frontmatter-name
description: A skill with name in frontmatter
---
Body.`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills[0]?.name).toBe('my-dir-name');
  });

  it('parses multiple skills', async () => {
    writeSkill(
      'a',
      `---
description: First
---
A body.`,
    );
    writeSkill(
      'b',
      `---
description: Second
---
B body.`,
    );
    const skills = await parseSkills(SKILLS_DIR);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['a', 'b']);
  });
});

describe('parseSkillDirectory', () => {
  it('uses frontmatter name when present', async () => {
    const skillDir = join(SKILLS_DIR, 'cache-dir-ugly-name');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: code-review-excellence\ndescription: Review code\n---\nBody.',
    );
    const skill = await parseSkillDirectory(skillDir);
    expect(skill?.name).toBe('code-review-excellence');
  });

  it('sanitizes frontmatter name', async () => {
    const skillDir = join(SKILLS_DIR, 'raw-dir');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: "My Skill / Special!"\ndescription: test\n---\nBody.',
    );
    const skill = await parseSkillDirectory(skillDir);
    expect(skill?.name).toBe('my-skill-special');
  });

  it('falls back to dirname when frontmatter name is absent', async () => {
    const skillDir = join(SKILLS_DIR, 'fallback-dir');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: No name field\n---\nBody.');
    const skill = await parseSkillDirectory(skillDir);
    expect(skill?.name).toBe('fallback-dir');
  });

  it('falls back to dirname when frontmatter name is empty', async () => {
    const skillDir = join(SKILLS_DIR, 'empty-name-dir');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: ""\ndescription: Empty name\n---\nBody.');
    const skill = await parseSkillDirectory(skillDir);
    expect(skill?.name).toBe('empty-name-dir');
  });

  it('falls back to dirname when frontmatter name is whitespace-only', async () => {
    const skillDir = join(SKILLS_DIR, 'ws-name-dir');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: "   "\ndescription: Whitespace name\n---\nBody.',
    );
    const skill = await parseSkillDirectory(skillDir);
    expect(skill?.name).toBe('ws-name-dir');
  });

  it('falls back to dirname when frontmatter name sanitizes to empty', async () => {
    const skillDir = join(SKILLS_DIR, 'special-chars-dir');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: "!!!"\ndescription: Special chars\n---\nBody.',
    );
    const skill = await parseSkillDirectory(skillDir);
    expect(skill?.name).toBe('special-chars-dir');
  });
});
