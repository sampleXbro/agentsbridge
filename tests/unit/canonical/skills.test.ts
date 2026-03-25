import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseSkills } from '../../../src/canonical/skills.js';

const TEST_DIR = join(tmpdir(), 'agentsbridge-skills-test');
const SKILLS_DIR = join(TEST_DIR, '.agentsbridge', 'skills');

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
