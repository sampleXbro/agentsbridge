import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveManualInstallPersistence } from '../../../src/install/manual/manual-install-persistence.js';
import { stageManualInstallScope } from '../../../src/install/manual/manual-install-scope.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-rem-mn-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('manual-install-persistence — extra branches', () => {
  it('returns trimmed pathInRepo when as is undefined (line 17 short-circuit)', async () => {
    writeFileSync(join(dir, 'rule.md'), 'content');
    const result = await resolveManualInstallPersistence({
      contentRoot: join(dir, 'rule.md'),
      pathInRepo: '.',
    });
    // No `as` argument → returns { pathInRepo: trimDot('.') } = { pathInRepo: undefined }
    expect(result.pathInRepo).toBeUndefined();
    expect(result.pick).toBeUndefined();
  });

  it('persists agents pick from a single .md file (line 22 agents branch)', async () => {
    writeFileSync(join(dir, 'designer.md'), 'agent body');
    const result = await resolveManualInstallPersistence({
      as: 'agents',
      contentRoot: join(dir, 'designer.md'),
      pathInRepo: 'agents/designer.md',
    });
    expect(result.pick).toEqual({ agents: ['designer'] });
    expect(result.pathInRepo).toBe('agents');
  });

  it('persists commands pick from a single .md file (line 23 commands branch)', async () => {
    writeFileSync(join(dir, 'go.md'), 'command body');
    const result = await resolveManualInstallPersistence({
      as: 'commands',
      contentRoot: join(dir, 'go.md'),
      pathInRepo: 'commands/go.md',
    });
    expect(result.pick).toEqual({ commands: ['go'] });
    expect(result.pathInRepo).toBe('commands');
  });

  it('persists rules pick fallback for unrelated as types (line 24 default branch)', async () => {
    writeFileSync(join(dir, 'lint.md'), 'rule body');
    const result = await resolveManualInstallPersistence({
      as: 'rules',
      contentRoot: join(dir, 'lint.md'),
      pathInRepo: 'rules/lint.md',
    });
    expect(result.pick).toEqual({ rules: ['lint'] });
  });

  it('handles SKILL.md file with skill dir derived from path (line 47 skill file branch)', async () => {
    const skillDir = join(dir, 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'skill body');
    const result = await resolveManualInstallPersistence({
      as: 'skills',
      contentRoot: join(skillDir, 'SKILL.md'),
      pathInRepo: 'skills/my-skill/SKILL.md',
    });
    expect(result.pick).toEqual({ skills: ['my-skill'] });
  });

  it('handles SKILL.md when normalizedPath is empty', async () => {
    const skillDir = join(dir, 'rooted-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'skill body');
    const result = await resolveManualInstallPersistence({
      as: 'skills',
      contentRoot: join(skillDir, 'SKILL.md'),
      pathInRepo: '',
    });
    expect(result.pick).toEqual({ skills: ['rooted-skill'] });
  });

  it('handles a skill directory with frontmatter name (line 60 fmName)', async () => {
    const skillDir = join(dir, 'fm-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: explicit-name\n---\nskill body\n');
    const result = await resolveManualInstallPersistence({
      as: 'skills',
      contentRoot: skillDir,
      pathInRepo: 'skills/fm-skill',
    });
    expect(result.pick).toEqual({ skills: ['explicit-name'] });
  });

  it('handles a skill directory without SKILL.md (line 67 catch branch)', async () => {
    const skillDir = join(dir, 'collection');
    mkdirSync(skillDir, { recursive: true });
    // No SKILL.md inside — stat throws -> catch
    const result = await resolveManualInstallPersistence({
      as: 'skills',
      contentRoot: skillDir,
      pathInRepo: 'collection',
    });
    expect(result.pick).toBeUndefined();
    expect(result.pathInRepo).toBe('collection');
  });

  it('returns plain pathInRepo when content is neither file nor SKILL dir', async () => {
    const skillDir = join(dir, 'misc');
    mkdirSync(skillDir, { recursive: true });
    // No SKILL.md
    const result = await resolveManualInstallPersistence({
      as: 'agents',
      contentRoot: skillDir,
      pathInRepo: 'misc',
    });
    expect(result.pathInRepo).toBe('misc');
    expect(result.pick).toBeUndefined();
  });
});

describe('manual-install-scope — extra branches', () => {
  it('throws when sourceRoot is a non-.md file for markdown collection', async () => {
    writeFileSync(join(dir, 'data.txt'), 'text');
    await expect(stageManualInstallScope(join(dir, 'data.txt'), 'rules')).rejects.toThrow(
      /only supports \.md/,
    );
  });

  it('throws when manual collection contains duplicate filenames', async () => {
    const root = join(dir, 'rules-coll');
    mkdirSync(join(root, 'sub1'), { recursive: true });
    mkdirSync(join(root, 'sub2'), { recursive: true });
    writeFileSync(join(root, 'sub1', 'lint.md'), 'one');
    writeFileSync(join(root, 'sub2', 'lint.md'), 'two');
    await expect(stageManualInstallScope(root, 'rules')).rejects.toThrow(/duplicate file name/);
  });

  it('throws when no .md files found under root', async () => {
    const root = join(dir, 'empty-coll');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'README'), 'no md');
    await expect(stageManualInstallScope(root, 'rules')).rejects.toThrow(/No \.md files/);
  });

  it('stages a single SKILL.md file into a skill directory', async () => {
    const skillDir = join(dir, 'pretty-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'skill content');
    const staged = await stageManualInstallScope(join(skillDir, 'SKILL.md'), 'skills');
    try {
      expect(staged.discoveryRoot).toContain('repo');
    } finally {
      await staged.cleanup();
    }
  });

  it('throws when single skill file is not SKILL.md', async () => {
    writeFileSync(join(dir, 'NotSkill.md'), 'no');
    await expect(stageManualInstallScope(join(dir, 'NotSkill.md'), 'skills')).rejects.toThrow(
      /expects SKILL\.md/,
    );
  });

  it('uses preferred skill names to stage descendants (line 84 binary)', async () => {
    const collection = join(dir, 'skills-coll');
    mkdirSync(join(collection, 'release-manager'), { recursive: true });
    mkdirSync(join(collection, 'reviewer'), { recursive: true });
    writeFileSync(join(collection, 'release-manager', 'SKILL.md'), 'r');
    writeFileSync(join(collection, 'reviewer', 'SKILL.md'), 'r');
    const staged = await stageManualInstallScope(collection, 'skills', {
      preferredSkillNames: ['release-manager'],
    });
    try {
      expect(staged.discoveryRoot).toContain('repo');
    } finally {
      await staged.cleanup();
    }
  });

  it('throws when sourceRoot is a non-skill directory', async () => {
    const notSkillDir = join(dir, 'not-skill');
    mkdirSync(notSkillDir, { recursive: true });
    writeFileSync(join(notSkillDir, 'README.md'), 'no skill');
    await expect(stageManualInstallScope(notSkillDir, 'skills')).rejects.toThrow(
      /expects a skill directory/,
    );
  });
});
