import { describe, it, expect } from 'vitest';
import { mirrorSkillsToAgents } from '../../../../src/targets/catalog/skill-mirror.js';

describe('mirrorSkillsToAgents', () => {
  it('returns mirror path when path starts with skillsDir', () => {
    expect(mirrorSkillsToAgents('.cursor/skills/ts-pro/SKILL.md', '.cursor/skills', [])).toBe(
      '.agents/skills/ts-pro/SKILL.md',
    );
  });

  it('mirrors nested supporting file', () => {
    expect(
      mirrorSkillsToAgents('.cursor/skills/ts-pro/references/checklist.md', '.cursor/skills', []),
    ).toBe('.agents/skills/ts-pro/references/checklist.md');
  });

  it('returns null when codex-cli is active', () => {
    expect(
      mirrorSkillsToAgents('.cursor/skills/ts-pro/SKILL.md', '.cursor/skills', ['codex-cli']),
    ).toBeNull();
  });

  it('returns null when path does not start with skillsDir', () => {
    expect(mirrorSkillsToAgents('.cursor/rules/typescript.mdc', '.cursor/skills', [])).toBeNull();
  });

  it('works with different target skill dirs', () => {
    expect(mirrorSkillsToAgents('.roo/skills/my-skill/SKILL.md', '.roo/skills', [])).toBe(
      '.agents/skills/my-skill/SKILL.md',
    );
    expect(
      mirrorSkillsToAgents(
        '.codeium/windsurf/skills/my-skill/SKILL.md',
        '.codeium/windsurf/skills',
        [],
      ),
    ).toBe('.agents/skills/my-skill/SKILL.md');
  });

  it('returns null when path equals skillsDir without trailing slash', () => {
    expect(mirrorSkillsToAgents('.cursor/skills', '.cursor/skills', [])).toBeNull();
  });
});
