import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferMdcTarget } from '../../../../src/install/manual/mdc-target-infer.js';

const ROOT = join(tmpdir(), 'am-mdc-target-infer');

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('inferMdcTarget', () => {
  it('infers cursor from alwaysApply key', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, 'rule.mdc'), '---\nalwaysApply: true\ndescription: Root\n---\n\nBody');
    expect(await inferMdcTarget(ROOT)).toBe('cursor');
  });

  it('infers cursor from alwaysApply: false + globs (cursor shape)', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(
      join(ROOT, 'scoped.mdc'),
      '---\nalwaysApply: false\nglobs:\n  - "*.ts"\ndescription: TS\n---\n\nBody',
    );
    expect(await inferMdcTarget(ROOT)).toBe('cursor');
  });

  it('infers windsurf from trigger key', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, 'rule.mdc'), '---\ntrigger: always\ndescription: Root\n---\n\nBody');
    expect(await inferMdcTarget(ROOT)).toBe('windsurf');
  });

  it('infers windsurf from trigger + glob (singular)', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(
      join(ROOT, 'scoped.mdc'),
      '---\ntrigger: glob\nglob: "*.ts"\ndescription: TS\n---\n\nBody',
    );
    expect(await inferMdcTarget(ROOT)).toBe('windsurf');
  });

  it('returns null for ambiguous frontmatter (both cursor and windsurf keys)', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, 'weird.mdc'), '---\nalwaysApply: true\ntrigger: always\n---\n\nBody');
    expect(await inferMdcTarget(ROOT)).toBeNull();
  });

  it('returns null for frontmatter with neither cursor nor windsurf keys', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(
      join(ROOT, 'plain.mdc'),
      '---\ndescription: Plain\nglobs:\n  - "*.js"\n---\n\nBody',
    );
    expect(await inferMdcTarget(ROOT)).toBeNull();
  });

  it('returns null when no .mdc files exist', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, 'rule.md'), '---\ndescription: MD\n---\n\nBody');
    expect(await inferMdcTarget(ROOT)).toBeNull();
  });

  it('returns null for empty directory', async () => {
    mkdirSync(ROOT, { recursive: true });
    expect(await inferMdcTarget(ROOT)).toBeNull();
  });

  it('samples first .mdc file only', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, 'a-cursor.mdc'), '---\nalwaysApply: true\n---\n\nBody');
    writeFileSync(join(ROOT, 'z-windsurf.mdc'), '---\ntrigger: always\n---\n\nBody');
    expect(await inferMdcTarget(ROOT)).toBe('cursor');
  });

  it('returns null when first .mdc file has invalid YAML (globs alias)', async () => {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(
      join(ROOT, 'broken.mdc'),
      '---\ndescription: TS rules\nglobs: **/*\nalwaysApply: false\n---\n\nBody',
    );
    expect(await inferMdcTarget(ROOT)).toBeNull();
  });
});
