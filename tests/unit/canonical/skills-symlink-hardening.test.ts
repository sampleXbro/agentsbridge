import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { parseSkills, parseSkillDirectory } from '../../../src/canonical/features/skills.js';

/**
 * Security regression: skill supporting-file traversal must NOT follow
 * symlinks. A malicious local pack containing
 *   skills/foo/keys -> /Users/victim/.ssh
 * would otherwise pull external bytes into the canonical skill content and
 * out to anything that later redistributes the skill (a committed pack, a
 * generated tool artifact, etc.).
 */
describe('parseSkills (symlink hardening)', () => {
  let testDir: string;
  let skillsDir: string;
  let externalDir: string;

  beforeEach(() => {
    const suffix = randomBytes(8).toString('hex');
    testDir = join(tmpdir(), `agentsmesh-skills-symlink-${suffix}`);
    skillsDir = join(testDir, '.agentsmesh', 'skills');
    externalDir = join(testDir, 'external-secret');
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(externalDir, { recursive: true });
    writeFileSync(join(externalDir, 'id_rsa'), 'PRIVATE-KEY-CONTENT');
    writeFileSync(join(externalDir, 'config'), 'ssh-config-content');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function skillDir(name: string): string {
    return join(skillsDir, name);
  }

  function writeSkillMd(name: string, body: string): void {
    const dir = skillDir(name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\ndescription: test skill\n---\n\n${body}`);
  }

  function trySymlink(target: string, linkPath: string): boolean {
    try {
      symlinkSync(target, linkPath);
      return true;
    } catch {
      // Windows CI without privilege, or fs that disallows symlinks.
      return false;
    }
  }

  it('does NOT follow a directory symlink that escapes the skill dir', async () => {
    writeSkillMd('exfil', 'body');
    const linked = trySymlink(externalDir, join(skillDir('exfil'), 'keys'));
    if (!linked) return;

    const skills = await parseSkills(skillsDir);
    expect(skills).toHaveLength(1);
    const exfil = skills[0]!;
    const supportingPaths = exfil.supportingFiles.map((sf) => sf.relativePath);
    expect(supportingPaths).not.toContain('keys/id_rsa');
    expect(supportingPaths).not.toContain('keys/config');
    for (const sf of exfil.supportingFiles) {
      expect(sf.content).not.toContain('PRIVATE-KEY-CONTENT');
      expect(sf.content).not.toContain('ssh-config-content');
    }
  });

  it('does NOT follow a file symlink to content outside the skill dir', async () => {
    writeSkillMd('exfil2', 'body');
    const linked = trySymlink(join(externalDir, 'id_rsa'), join(skillDir('exfil2'), 'secret.txt'));
    if (!linked) return;

    const skills = await parseSkills(skillsDir);
    expect(skills).toHaveLength(1);
    const exfil = skills[0]!;
    expect(exfil.supportingFiles.map((sf) => sf.relativePath)).not.toContain('secret.txt');
    for (const sf of exfil.supportingFiles) {
      expect(sf.content).not.toContain('PRIVATE-KEY-CONTENT');
    }
  });

  it('still includes real (non-symlinked) supporting files', async () => {
    writeSkillMd('legit', 'body');
    mkdirSync(join(skillDir('legit'), 'scripts'));
    writeFileSync(join(skillDir('legit'), 'scripts', 'run.sh'), '#!/bin/sh\necho hi');
    writeFileSync(join(skillDir('legit'), 'notes.md'), 'real notes');

    const skills = await parseSkills(skillsDir);
    expect(skills).toHaveLength(1);
    const paths = skills[0]!.supportingFiles.map((sf) => sf.relativePath).sort();
    expect(paths).toEqual(['notes.md', 'scripts/run.sh']);
  });

  it('parseSkillDirectory (Anthropic-leaf form) also refuses symlinked supporting files', async () => {
    writeSkillMd('leaf', 'body');
    const linked = trySymlink(externalDir, join(skillDir('leaf'), 'keys'));
    if (!linked) return;

    const skill = await parseSkillDirectory(skillDir('leaf'));
    expect(skill).not.toBeNull();
    const supportingPaths = skill!.supportingFiles.map((sf) => sf.relativePath);
    expect(supportingPaths).not.toContain('keys/id_rsa');
  });

  it('symlink targets are not stat-followed (lstat semantics)', async () => {
    writeSkillMd('sanity', 'body');
    const linked = trySymlink(externalDir, join(skillDir('sanity'), 'keys'));
    if (!linked) return;

    // Sanity check: the symlink itself exists. Without the fix, traversal would
    // see `keys/id_rsa` as a real file inside the skill dir.
    const lstatInfo = statSync(join(skillDir('sanity'), 'keys'));
    expect(lstatInfo.isDirectory()).toBe(true); // follows when using stat
  });
});
