/**
 * Branch coverage for src/targets/windsurf/generator/skills.ts:
 * - body trim() || '' fallback (line 17).
 * - supporting files loop (line 19-24).
 * - skill with empty description (line 13 delete branch).
 */

import { describe, it, expect } from 'vitest';
import { generateSkills } from '../../../../src/targets/windsurf/generator/skills.js';
import type { CanonicalFiles, CanonicalSkill } from '../../../../src/core/types.js';

function base(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('windsurf generateSkills — branch coverage', () => {
  it('returns [] for empty skills array', () => {
    expect(generateSkills(base())).toEqual([]);
  });

  it('emits SKILL.md with only name in frontmatter when description is empty', () => {
    const skill: CanonicalSkill = {
      source: '/x',
      name: 'demo',
      description: '',
      body: 'body',
      supportingFiles: [],
    };
    const out = generateSkills({ ...base(), skills: [skill] });
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toContain('name: demo');
    expect(out[0]!.content).not.toContain('description:');
  });

  it('includes supporting files alongside SKILL.md', () => {
    const skill: CanonicalSkill = {
      source: '/x',
      name: 'demo',
      description: 'desc',
      body: 'body',
      supportingFiles: [
        { relativePath: 'refs/notes.md', content: 'notes' },
        { relativePath: 'helpers/util.py', content: 'print(1)' },
      ],
    };
    const out = generateSkills({ ...base(), skills: [skill] });
    expect(out.map((o) => o.path)).toEqual([
      '.windsurf/skills/demo/SKILL.md',
      '.windsurf/skills/demo/refs/notes.md',
      '.windsurf/skills/demo/helpers/util.py',
    ]);
  });

  it('emits empty body string when skill.body is whitespace-only', () => {
    const skill: CanonicalSkill = {
      source: '/x',
      name: 'blank',
      description: 'd',
      body: '   ',
      supportingFiles: [],
    };
    const out = generateSkills({ ...base(), skills: [skill] });
    // Body is replaced with '' after trim/fallback.
    expect(out[0]!.content).toMatch(/---\s*\n.*description: d.*\n---/s);
  });
});
