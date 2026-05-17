import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  hasSkillPackLayout,
  hasAgentsDir,
  hasReferencesDir,
  hasMultiToolRules,
  hasPerTargetCommands,
} from '../../../../src/install/classify/signals.js';

let contentRoot = '';

beforeEach(() => {
  contentRoot = join(tmpdir(), `am-signals-${randomBytes(8).toString('hex')}`);
  mkdirSync(contentRoot, { recursive: true });
});

afterEach(() => {
  rmSync(contentRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(contentRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

describe('hasSkillPackLayout (PRIMARY signal)', () => {
  it('matches when skills/<kebab>/SKILL.md has name frontmatter', async () => {
    writeFile('skills/interview-me/SKILL.md', '---\nname: interview-me\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(true);
  });

  it('matches when skills/<kebab>/SKILL.md has description frontmatter', async () => {
    writeFile('skills/foo/SKILL.md', '---\ndescription: A foo skill\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(true);
  });

  it('does NOT match when skills/ contains only SKILL.md at top level (no subdir)', async () => {
    writeFile('skills/SKILL.md', '---\nname: top\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('does NOT match when SKILL.md has no frontmatter', async () => {
    writeFile('skills/foo/SKILL.md', '# Just a heading, no frontmatter');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('does NOT match when SKILL.md frontmatter lacks both name and description', async () => {
    writeFile('skills/foo/SKILL.md', '---\nother: value\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('does NOT match when skills/ subdir name is UPPERCASE (non-kebab)', async () => {
    writeFile('skills/UPPERCASE/SKILL.md', '---\nname: x\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('does NOT match when skills/ subdir name starts with underscore', async () => {
    writeFile('skills/_example/SKILL.md', '---\nname: x\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('does NOT match when skills/ is empty', async () => {
    mkdirSync(join(contentRoot, 'skills'), { recursive: true });
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('does NOT match when skills/ does not exist', async () => {
    expect(await hasSkillPackLayout({ contentRoot })).toBe(false);
  });

  it('matches when at least one of many subdirs is valid', async () => {
    writeFile('skills/_invalid/SKILL.md', '---\nname: x\n---\nbody');
    writeFile('skills/INVALID/SKILL.md', '---\nname: x\n---\nbody');
    writeFile('skills/valid-one/SKILL.md', '---\ndescription: ok\n---\nbody');
    expect(await hasSkillPackLayout({ contentRoot })).toBe(true);
  });
});

describe('hasAgentsDir (secondary)', () => {
  it('matches when agents/<name>.md has frontmatter description', async () => {
    writeFile('agents/code-reviewer.md', '---\ndescription: Reviewer\n---\nbody');
    expect(await hasAgentsDir({ contentRoot })).toBe(true);
  });

  it('matches when agents/<name>.md has frontmatter name', async () => {
    writeFile('agents/foo.md', '---\nname: foo\n---\nbody');
    expect(await hasAgentsDir({ contentRoot })).toBe(true);
  });

  it('does NOT match when only boilerplate files exist (README.md)', async () => {
    writeFile('agents/README.md', '---\ndescription: ignored\n---\nbody');
    expect(await hasAgentsDir({ contentRoot })).toBe(false);
  });

  it('does NOT match when agents/<name>.md has no frontmatter', async () => {
    writeFile('agents/foo.md', '# Just markdown');
    expect(await hasAgentsDir({ contentRoot })).toBe(false);
  });

  it('does NOT match when agents/ does not exist', async () => {
    expect(await hasAgentsDir({ contentRoot })).toBe(false);
  });

  it('does NOT match when agents/ is empty', async () => {
    mkdirSync(join(contentRoot, 'agents'), { recursive: true });
    expect(await hasAgentsDir({ contentRoot })).toBe(false);
  });

  it('ignores README.md and matches a sibling real agent', async () => {
    writeFile('agents/README.md', '# Personas');
    writeFile('agents/code-reviewer.md', '---\ndescription: Real\n---\nbody');
    expect(await hasAgentsDir({ contentRoot })).toBe(true);
  });
});

describe('hasReferencesDir (secondary)', () => {
  it('matches when references/<name>.md exists', async () => {
    writeFile('references/checklist.md', 'content');
    expect(await hasReferencesDir({ contentRoot })).toBe(true);
  });

  it('does NOT match when references/ does not exist', async () => {
    expect(await hasReferencesDir({ contentRoot })).toBe(false);
  });

  it('does NOT match when references/ contains only non-markdown', async () => {
    writeFile('references/data.json', '{}');
    expect(await hasReferencesDir({ contentRoot })).toBe(false);
  });

  it('does NOT match when references/ contains only README boilerplate', async () => {
    writeFile('references/README.md', 'index');
    expect(await hasReferencesDir({ contentRoot })).toBe(false);
  });

  it('does NOT match when references/ is empty', async () => {
    mkdirSync(join(contentRoot, 'references'), { recursive: true });
    expect(await hasReferencesDir({ contentRoot })).toBe(false);
  });
});

describe('hasMultiToolRules (secondary)', () => {
  it('matches when >= 2 of CLAUDE.md, AGENTS.md, GEMINI.md exist at root', async () => {
    writeFile('CLAUDE.md', 'rules');
    writeFile('AGENTS.md', 'rules');
    expect(await hasMultiToolRules({ contentRoot })).toBe(true);
  });

  it('matches all three present', async () => {
    writeFile('CLAUDE.md', 'rules');
    writeFile('AGENTS.md', 'rules');
    writeFile('GEMINI.md', 'rules');
    expect(await hasMultiToolRules({ contentRoot })).toBe(true);
  });

  it('does NOT match when only one root rule file exists', async () => {
    writeFile('CLAUDE.md', 'rules');
    expect(await hasMultiToolRules({ contentRoot })).toBe(false);
  });

  it('does NOT match when none of the recognized rule files exist', async () => {
    writeFile('README.md', 'unrelated');
    expect(await hasMultiToolRules({ contentRoot })).toBe(false);
  });

  it('is case-sensitive on filename (claude.md does not count)', async () => {
    // Real repos using this convention always use uppercase per Anthropic
    // docs. Accepting lowercase would risk false positives on generic repos.
    writeFile('claude.md', 'rules');
    writeFile('agents.md', 'rules');
    expect(await hasMultiToolRules({ contentRoot })).toBe(false);
  });
});

describe('hasPerTargetCommands (secondary)', () => {
  it('matches when .claude/commands/ contains a .md file', async () => {
    writeFile('.claude/commands/build.md', 'build command');
    expect(await hasPerTargetCommands({ contentRoot })).toBe(true);
  });

  it('matches when .gemini/commands/ contains a .md file', async () => {
    writeFile('.gemini/commands/test.md', 'test command');
    expect(await hasPerTargetCommands({ contentRoot })).toBe(true);
  });

  it('matches when .cursor/commands/ contains a .md file', async () => {
    writeFile('.cursor/commands/ship.md', 'ship command');
    expect(await hasPerTargetCommands({ contentRoot })).toBe(true);
  });

  it('does NOT match when no per-target commands dir exists', async () => {
    writeFile('commands/build.md', 'root-level');
    expect(await hasPerTargetCommands({ contentRoot })).toBe(false);
  });

  it('does NOT match when per-target commands dir is empty', async () => {
    mkdirSync(join(contentRoot, '.claude', 'commands'), { recursive: true });
    expect(await hasPerTargetCommands({ contentRoot })).toBe(false);
  });

  it('does NOT match when per-target commands dir has only README boilerplate', async () => {
    writeFile('.claude/commands/README.md', 'index');
    expect(await hasPerTargetCommands({ contentRoot })).toBe(false);
  });

  it('matches additional descriptor-derived per-target commands dirs (e.g. .junie/commands)', async () => {
    // The dir list is derived from every descriptor's managedOutputs.dirs that
    // matches `.<tool>/commands`; junie ships such a dir even though the
    // previous hardcoded list omitted it.
    writeFile('.junie/commands/release.md', 'release command');
    expect(await hasPerTargetCommands({ contentRoot })).toBe(true);
  });
});
