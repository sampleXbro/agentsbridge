import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureGitattributesEntries } from '../../../../src/utils/filesystem/gitattributes.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitattr-'));
});

describe('ensureGitattributesEntries', () => {
  it('creates .gitattributes with the entry and returns true', async () => {
    expect(await ensureGitattributesEntries(root, ['a.json merge=x'])).toBe(true);
    expect(readFileSync(join(root, '.gitattributes'), 'utf8')).toBe('a.json merge=x\n');
  });

  it('is idempotent — a second run adds nothing and returns false', async () => {
    await ensureGitattributesEntries(root, ['a.json merge=x']);
    expect(await ensureGitattributesEntries(root, ['a.json merge=x'])).toBe(false);
    const lines = readFileSync(join(root, '.gitattributes'), 'utf8')
      .split('\n')
      .filter((l) => l === 'a.json merge=x');
    expect(lines.length).toBe(1);
  });

  it('recognizes an existing entry despite surrounding whitespace (trim)', async () => {
    writeFileSync(join(root, '.gitattributes'), '   a.json merge=x   \n', 'utf8');
    expect(await ensureGitattributesEntries(root, ['a.json merge=x'])).toBe(false);
  });

  it('preserves existing content and adds a trailing newline when one is missing', async () => {
    writeFileSync(join(root, '.gitattributes'), '*.png binary', 'utf8'); // no trailing newline
    expect(await ensureGitattributesEntries(root, ['a.json merge=x'])).toBe(true);
    expect(readFileSync(join(root, '.gitattributes'), 'utf8')).toBe(
      '*.png binary\na.json merge=x\n',
    );
  });
});
