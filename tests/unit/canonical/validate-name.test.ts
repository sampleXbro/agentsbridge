/**
 * Regression tests for Batch 4 canonical-parser path safety:
 *   M1: Wire findWindowsPathIssues into canonical parsers
 *   F4: Detect duplicate basenames in nested parseAgents/parseCommands
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CanonicalNameError,
  assertCanonicalName,
  assertNoBasenameCollisions,
} from '../../../src/canonical/features/validate-name.js';
import { parseAgents } from '../../../src/canonical/features/agents.js';
import { parseCommands } from '../../../src/canonical/features/commands.js';
import { parseSkillDirectory, parseSkills } from '../../../src/canonical/features/skills.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-validate-name-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('assertCanonicalName (M1)', () => {
  it('passes a normal name', () => {
    expect(() => assertCanonicalName('agent', 'code-reviewer')).not.toThrow();
  });

  it('rejects Windows reserved name (CON)', () => {
    expect(() => assertCanonicalName('agent', 'CON')).toThrow(CanonicalNameError);
  });

  it('rejects Windows reserved name with extension stem (NUL)', () => {
    expect(() => assertCanonicalName('agent', 'NUL')).toThrow(/Windows/);
  });

  it('rejects names with illegal Windows characters', () => {
    expect(() => assertCanonicalName('rule', 'has:colon')).toThrow(/Windows/);
    expect(() => assertCanonicalName('rule', 'pipe|name')).toThrow(/Windows/);
  });

  it('rejects trailing dot', () => {
    expect(() => assertCanonicalName('command', 'trailing.')).toThrow(/Windows/);
  });
});

describe('assertNoBasenameCollisions (F4)', () => {
  it('passes when all basenames are unique', () => {
    expect(() =>
      assertNoBasenameCollisions('agent', ['/p/agents/a.md', '/p/agents/b.md'], '.md'),
    ).not.toThrow();
  });

  it('rejects collisions across nested directories', () => {
    expect(() =>
      assertNoBasenameCollisions('agent', ['/p/agents/foo.md', '/p/agents/sub/foo.md'], '.md'),
    ).toThrow(/collide on slug "foo"/);
  });

  it('does not flag the same exact path listed twice', () => {
    expect(() =>
      assertNoBasenameCollisions('agent', ['/p/agents/x.md', '/p/agents/x.md'], '.md'),
    ).not.toThrow();
  });

  it('treats files without the strip extension as their full basename', () => {
    // Same-extension files at distinct slugs do not collide.
    expect(() =>
      assertNoBasenameCollisions('rule', ['/p/rules/foo.txt', '/p/rules/bar.txt'], '.md'),
    ).not.toThrow();
    // Two extension-less files with the same basename collide.
    expect(() => assertNoBasenameCollisions('rule', ['/p/rules/foo', '/p/sub/foo'], '.md')).toThrow(
      /collide on slug "foo"/,
    );
  });
});

describe('parseAgents wiring', () => {
  it('throws CanonicalNameError when an agent file is named NUL.md', async () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'NUL.md'), '---\nname: x\n---\nbody\n');
    await expect(parseAgents(dir)).rejects.toBeInstanceOf(CanonicalNameError);
  });

  it('throws on nested basename collision', async () => {
    mkdirSync(join(dir, 'sub'), { recursive: true });
    writeFileSync(join(dir, 'foo.md'), '---\nname: a\n---\nbody\n');
    writeFileSync(join(dir, 'sub', 'foo.md'), '---\nname: b\n---\nbody\n');
    await expect(parseAgents(dir)).rejects.toThrow(/collide on slug "foo"/);
  });
});

describe('parseCommands wiring', () => {
  it('rejects CON.md as a command file', async () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'CON.md'), '---\nname: x\n---\nbody\n');
    await expect(parseCommands(dir)).rejects.toBeInstanceOf(CanonicalNameError);
  });
});

describe('parseSkillDirectory wiring', () => {
  it('rejects a skill directory whose name is a Windows reserved word', async () => {
    const skillDir = join(dir, 'AUX');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: aux\ndescription: x\n---\nbody\n');
    await expect(parseSkillDirectory(skillDir)).rejects.toBeInstanceOf(CanonicalNameError);
  });
});

describe('parseSkills wiring', () => {
  it('rejects skills whose directory name is a Windows reserved word', async () => {
    const skillDir = join(dir, 'COM1');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: com1\ndescription: x\n---\nbody\n');
    await expect(parseSkills(dir)).rejects.toBeInstanceOf(CanonicalNameError);
  });
});
