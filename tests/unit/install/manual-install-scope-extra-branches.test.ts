import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stageManualInstallScope } from '../../../src/install/manual/manual-install-scope.js';
import { listRelativeFiles } from '../../helpers/install-test-helpers.js';

let ROOT: string;

beforeEach(() => {
  ROOT = join(tmpdir(), `am-manual-scope-extra-${process.pid}-${Date.now()}-${Math.random()}`);
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('stageManualInstallScope — additional branch gaps', () => {
  it('throws when directory has no installable markdown files', async () => {
    const src = join(ROOT, 'noop');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'NOT_MD.txt'), 'nope\n');

    await expect(stageManualInstallScope(src, 'commands')).rejects.toThrow(
      /No installable files found/,
    );
    // Error must hint at the recovery flags so the user can pivot without
    // re-reading docs. Loose contract — the literal phrasing can drift but the
    // flag names must stay visible.
    await expect(stageManualInstallScope(src, 'commands')).rejects.toThrow(/--path/);
    await expect(stageManualInstallScope(src, 'commands')).rejects.toThrow(/--as/);
  });

  it('rejects single-file install when extension is not .md', async () => {
    const src = join(ROOT, 'lone.txt');
    writeFileSync(src, '# not md\n');
    await expect(stageManualInstallScope(src, 'commands')).rejects.toThrow(
      /only supports \.md files/,
    );
  });

  it('disambiguates colliding basenames via parent directory namespacing', async () => {
    const src = join(ROOT, 'cmd-pack');
    mkdirSync(join(src, 'alpha'), { recursive: true });
    mkdirSync(join(src, 'beta'), { recursive: true });
    writeFileSync(join(src, 'alpha', 'review.md'), '# alpha-review\n');
    writeFileSync(join(src, 'beta', 'review.md'), '# beta-review\n');

    const staged = await stageManualInstallScope(src, 'commands');
    try {
      const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', 'commands'));
      // Both should be present, with names distinguished by parent dirs.
      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith('-review.md'))).toBe(true);
    } finally {
      await staged.cleanup();
    }
  });

  it('returns false from stagePreferredSkills when no preferred skill matches (falls through to full skills collection)', async () => {
    // skills collection layout: multiple SKILL.md directories under root (no
    // top-level SKILL.md). Preferred skill not present → falls back to copying
    // all skill subtrees.
    const root = join(ROOT, 'skills');
    mkdirSync(join(root, 'release-manager'), { recursive: true });
    mkdirSync(join(root, 'quality-gates'), { recursive: true });
    writeFileSync(join(root, 'release-manager', 'SKILL.md'), '---\ndescription: rm\n---\n');
    writeFileSync(join(root, 'quality-gates', 'SKILL.md'), '---\ndescription: qg\n---\n');

    const staged = await stageManualInstallScope(root, 'skills', {
      preferredSkillNames: ['not-there'],
    });
    try {
      const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', 'skills'));
      expect(files.sort()).toEqual(['quality-gates/SKILL.md', 'release-manager/SKILL.md']);
    } finally {
      await staged.cleanup();
    }
  });

  it('accepts .mdc files for rules and converts to canonical .md', async () => {
    const src = join(ROOT, 'rules');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.mdc'), '---\ndescription: x\n---\n# body\n');

    const staged = await stageManualInstallScope(src, 'rules');
    try {
      const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', 'rules'));
      expect(files).toEqual(['a.md']);
    } finally {
      await staged.cleanup();
    }
  });
});
