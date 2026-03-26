import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normalizeSlicePath,
  isCanonicalSliceEmpty,
} from '../../../src/canonical/load-canonical-slice.js';

const ROOT = join(tmpdir(), 'am-slice-norm-test');

describe('load-canonical-slice (normalize)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('normalizeSlicePath: rejects missing path', async () => {
    await expect(normalizeSlicePath(join(ROOT, 'nope'))).rejects.toThrow('Path does not exist');
  });

  it('normalizeSlicePath: rejects non-markdown file under rules/', async () => {
    const rules = join(ROOT, 'rules');
    mkdirSync(rules);
    writeFileSync(join(rules, 'note.txt'), 'x');
    await expect(normalizeSlicePath(join(rules, 'note.txt'))).rejects.toThrow(
      'Install path must be a directory or a .md file',
    );
  });

  it('normalizeSlicePath: accepts .MD extension for slug', async () => {
    const rules = join(ROOT, 'pkg-a', 'rules');
    mkdirSync(rules, { recursive: true });
    const f = join(rules, 'UP.MD');
    writeFileSync(f, '---\ndescription: d\n---\n');
    expect((await normalizeSlicePath(f)).implicitPick).toEqual({ rules: ['UP'] });
  });

  it('normalizeSlicePath: slug keeps inner dots', async () => {
    const rules = join(ROOT, 'pkg-b', 'rules');
    mkdirSync(rules, { recursive: true });
    const f = join(rules, 'foo.bar.md');
    writeFileSync(f, '---\ndescription: d\n---\n');
    expect((await normalizeSlicePath(f)).implicitPick).toEqual({ rules: ['foo.bar'] });
  });

  it('normalizeSlicePath: directory unchanged', async () => {
    const d = join(ROOT, 'proj');
    mkdirSync(d);
    const r = await normalizeSlicePath(d);
    expect(r.sliceRoot).toBe(d);
    expect(r.implicitPick).toBeUndefined();
  });

  it('normalizeSlicePath: single rule / command / agent files', async () => {
    const rules = join(ROOT, 'rules');
    mkdirSync(rules);
    const rf = join(rules, 'my-rule.md');
    writeFileSync(rf, '---\ndescription: d\n---\n');
    expect(await normalizeSlicePath(rf)).toMatchObject({
      sliceRoot: rules,
      implicitPick: { rules: ['my-rule'] },
    });
    const cmdDir = join(ROOT, 'commands');
    mkdirSync(cmdDir);
    const cf = join(cmdDir, 'ship.md');
    writeFileSync(cf, '---\ndescription: d\n---\n');
    expect(await normalizeSlicePath(cf)).toEqual({
      sliceRoot: cmdDir,
      implicitPick: { commands: ['ship'] },
    });
    const agDir = join(ROOT, 'agents');
    mkdirSync(agDir);
    const af = join(agDir, 'reviewer.md');
    writeFileSync(af, '---\ndescription: d\n---\n');
    expect(await normalizeSlicePath(af)).toEqual({
      sliceRoot: agDir,
      implicitPick: { agents: ['reviewer'] },
    });
  });

  it('normalizeSlicePath: rejects .md outside rules/commands/agents', async () => {
    const other = join(ROOT, 'docs');
    mkdirSync(other);
    const f = join(other, 'x.md');
    writeFileSync(f, 'hi');
    await expect(normalizeSlicePath(f)).rejects.toThrow(
      'Single-file install only supports .md files under rules/, commands/, or agents/',
    );
  });

  it('isCanonicalSliceEmpty respects ignore patterns', () => {
    const empty = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };
    expect(isCanonicalSliceEmpty(empty)).toBe(true);
    expect(isCanonicalSliceEmpty({ ...empty, ignore: ['*.log'] })).toBe(false);
  });
});
