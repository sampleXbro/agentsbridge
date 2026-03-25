import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stageManualInstallScope } from '../../../src/install/manual-install-scope.js';
import { listRelativeFiles } from '../../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'ab-manual-install-scope-skills');

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('stageManualInstallScope skills', () => {
  it('stages a single SKILL.md file as one skill', async () => {
    const skillDir = join(ROOT, 'skills', 'reviewer');
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: Reviewer\n---\n\nReview\n');
    writeFileSync(join(skillDir, 'references', 'checklist.md'), '# Checklist\n');

    const staged = await stageManualInstallScope(join(skillDir, 'SKILL.md'), 'skills');
    try {
      expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsbridge', 'skills'))).toEqual([
        'reviewer/SKILL.md',
        'reviewer/references/checklist.md',
      ]);
    } finally {
      await staged.cleanup();
    }
  });

  it('stages a single skill directory with supporting files', async () => {
    const skillDir = join(ROOT, 'skills', 'qa');
    mkdirSync(join(skillDir, 'templates'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: QA\n---\n\nTest\n');
    writeFileSync(join(skillDir, 'templates', 'plan.md'), '# Plan\n');

    const staged = await stageManualInstallScope(skillDir, 'skills');
    try {
      expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsbridge', 'skills'))).toEqual([
        'qa/SKILL.md',
        'qa/templates/plan.md',
      ]);
    } finally {
      await staged.cleanup();
    }
  });

  it('stages a collection of skill directories', async () => {
    const root = join(ROOT, 'skills');
    mkdirSync(join(root, 'review'), { recursive: true });
    mkdirSync(join(root, 'release'), { recursive: true });
    writeFileSync(join(root, 'review', 'SKILL.md'), '---\ndescription: Review\n---\n');
    writeFileSync(join(root, 'release', 'SKILL.md'), '---\ndescription: Release\n---\n');

    const staged = await stageManualInstallScope(root, 'skills');
    try {
      expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsbridge', 'skills'))).toEqual([
        'release/SKILL.md',
        'review/SKILL.md',
      ]);
    } finally {
      await staged.cleanup();
    }
  });

  it('replays descendant picks from a legacy nested skill container', async () => {
    const root = join(ROOT, 'skills', 'engineering');
    mkdirSync(join(root, 'release-manager', 'references'), { recursive: true });
    mkdirSync(join(root, 'quality-gates'), { recursive: true });
    writeFileSync(join(root, 'SKILL.md'), '---\ndescription: Engineering umbrella\n---\n');
    writeFileSync(
      join(root, 'release-manager', 'SKILL.md'),
      '---\ndescription: Release manager\n---\n',
    );
    writeFileSync(join(root, 'release-manager', 'references', 'guide.md'), '# Guide\n');
    writeFileSync(join(root, 'quality-gates', 'SKILL.md'), '---\ndescription: Quality\n---\n');

    const staged = await stageManualInstallScope(root, 'skills', {
      preferredSkillNames: ['release-manager'],
    });
    try {
      expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsbridge', 'skills'))).toEqual([
        'release-manager/SKILL.md',
        'release-manager/references/guide.md',
      ]);
    } finally {
      await staged.cleanup();
    }
  });

  it('replays descendant picks from a nested skills collection root', async () => {
    const root = join(ROOT, 'skills');
    mkdirSync(join(root, 'engineering', 'release-manager', 'references'), { recursive: true });
    mkdirSync(join(root, 'quality-gates'), { recursive: true });
    writeFileSync(
      join(root, 'engineering', 'release-manager', 'SKILL.md'),
      '---\ndescription: Release manager\n---\n',
    );
    writeFileSync(
      join(root, 'engineering', 'release-manager', 'references', 'guide.md'),
      '# Guide\n',
    );
    writeFileSync(join(root, 'quality-gates', 'SKILL.md'), '---\ndescription: Quality\n---\n');

    const staged = await stageManualInstallScope(root, 'skills', {
      preferredSkillNames: ['release-manager'],
    });
    try {
      expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsbridge', 'skills'))).toEqual([
        'release-manager/SKILL.md',
        'release-manager/references/guide.md',
      ]);
    } finally {
      await staged.cleanup();
    }
  });

  it('rejects non-SKILL markdown files', async () => {
    const source = join(ROOT, 'skills', 'review.md');
    mkdirSync(join(ROOT, 'skills'), { recursive: true });
    writeFileSync(source, '# review\n');

    await expect(stageManualInstallScope(source, 'skills')).rejects.toThrow(
      'Manual skill install expects SKILL.md or a skill directory',
    );
  });

  it('rejects folders that are not skill packs', async () => {
    const source = join(ROOT, 'skills');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'README.md'), '# nope\n');

    await expect(stageManualInstallScope(source, 'skills')).rejects.toThrow(
      'Manual skill install expects a skill directory or skills collection',
    );
  });
});
