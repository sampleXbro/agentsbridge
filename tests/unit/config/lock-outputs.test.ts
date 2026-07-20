import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildOutputChecksums,
  diffOutputChecksums,
} from '../../../src/config/core/lock-outputs.js';
import { hashContent, hashFileForManifest } from '../../../src/utils/crypto/hash.js';
import { writeFileAtomic } from '../../../src/utils/filesystem/fs.js';
import type { GenerateResult } from '../../../src/core/result-types.js';

let testDir = '';
beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'amesh-lock-outputs-'));
});
afterEach(() => {
  if (testDir) rmSync(testDir, { recursive: true, force: true });
  testDir = '';
});

function result(path: string, content: string, status: GenerateResult['status']): GenerateResult {
  return { target: 't', path, content, status };
}

describe('buildOutputChecksums', () => {
  it('includes created/updated/unchanged, excludes skipped, normalizes backslashes and sha256 prefix', () => {
    const results: GenerateResult[] = [
      result('AGENTS.md', 'created-body', 'created'),
      result('.claude\\commands\\foo.md', 'updated-body', 'updated'),
      result('.cursor/rules/bar.mdc', 'unchanged-body', 'unchanged'),
      result('skipped.md', 'skipped-body', 'skipped'),
    ];
    expect(buildOutputChecksums(results)).toEqual({
      'AGENTS.md': `sha256:${hashContent('created-body')}`,
      '.claude/commands/foo.md': `sha256:${hashContent('updated-body')}`,
      '.cursor/rules/bar.mdc': `sha256:${hashContent('unchanged-body')}`,
    });
  });

  it('CRLF text content hashes identically to its LF form', () => {
    const crlf = buildOutputChecksums([result('doc.md', 'line one\r\nline two\r\n', 'created')]);
    const lf = buildOutputChecksums([result('doc.md', 'line one\nline two\n', 'created')]);
    expect(crlf['doc.md']).toBe(lf['doc.md']);
  });

  it('BOM-prefixed text content hashes identically to its BOM-less form', () => {
    const withBom = buildOutputChecksums([result('doc.md', '﻿hello', 'created')]);
    const without = buildOutputChecksums([result('doc.md', 'hello', 'created')]);
    expect(withBom['doc.md']).toBe(without['doc.md']);
  });

  it('binary text extension outside the text set is hashed raw (CRLF differs from LF)', () => {
    const crlf = buildOutputChecksums([result('img.png', 'a\r\nb', 'created')]);
    const lf = buildOutputChecksums([result('img.png', 'a\nb', 'created')]);
    expect(crlf['img.png']).not.toBe(lf['img.png']);
    expect(crlf['img.png']).toBe(`sha256:${hashContent('a\r\nb')}`);
  });

  it('lock hash round-trips through writeFileAtomic (equals re-hash of on-disk bytes)', async () => {
    const built = buildOutputChecksums([result('doc.md', 'alpha\r\nbeta\r\n', 'created')]);
    const dest = join(testDir, 'doc.md');
    await writeFileAtomic(dest, 'alpha\r\nbeta\r\n');
    expect(built['doc.md']).toBe(`sha256:${await hashFileForManifest(dest)}`);
  });
});

describe('diffOutputChecksums', () => {
  it('unchanged files → empty arrays', async () => {
    writeFileSync(join(testDir, 'AGENTS.md'), 'body');
    const locked = { 'AGENTS.md': `sha256:${hashContent('body')}` };
    const diff = await diffOutputChecksums(testDir, locked);
    expect(diff).toEqual({ outputsModified: [], outputsRemoved: [] });
  });

  it('edited file → outputsModified', async () => {
    writeFileSync(join(testDir, 'AGENTS.md'), 'edited-on-disk');
    const locked = { 'AGENTS.md': `sha256:${hashContent('original')}` };
    const diff = await diffOutputChecksums(testDir, locked);
    expect(diff).toEqual({ outputsModified: ['AGENTS.md'], outputsRemoved: [] });
  });

  it('deleted file → outputsRemoved', async () => {
    const locked = { 'AGENTS.md': `sha256:${hashContent('gone')}` };
    const diff = await diffOutputChecksums(testDir, locked);
    expect(diff).toEqual({ outputsModified: [], outputsRemoved: ['AGENTS.md'] });
  });

  it('CRLF/BOM-only rewrite of same text content is NOT drift, genuine edit still is', async () => {
    // Locked hash uses the manifest semantics (LF-normalized, BOM-stripped).
    const locked = {
      'doc.md': `sha256:${hashContent('one\ntwo\n')}`,
      'edited.md': `sha256:${hashContent('original\n')}`,
    };
    // Windows editor rewrites with CRLF + BOM but identical logical content.
    writeFileSync(join(testDir, 'doc.md'), '﻿one\r\ntwo\r\n');
    // Genuine content change.
    writeFileSync(join(testDir, 'edited.md'), 'tampered\n');
    const diff = await diffOutputChecksums(testDir, locked);
    expect(diff).toEqual({ outputsModified: ['edited.md'], outputsRemoved: [] });
  });

  it('binary-extension path is raw-hashed consistently on both sides', async () => {
    const locked = { 'img.png': `sha256:${hashContent('a\r\nb')}` };
    writeFileSync(join(testDir, 'img.png'), 'a\r\nb');
    const same = await diffOutputChecksums(testDir, locked);
    expect(same).toEqual({ outputsModified: [], outputsRemoved: [] });

    const lfLocked = { 'img.png': `sha256:${hashContent('a\nb')}` };
    const drift = await diffOutputChecksums(testDir, lfLocked);
    expect(drift).toEqual({ outputsModified: ['img.png'], outputsRemoved: [] });
  });

  it('sorts both arrays deterministically', async () => {
    writeFileSync(join(testDir, 'z-edit.md'), 'now');
    writeFileSync(join(testDir, 'a-edit.md'), 'now');
    const locked = {
      'z-edit.md': `sha256:${hashContent('then')}`,
      'a-edit.md': `sha256:${hashContent('then')}`,
      'z-gone.md': `sha256:${hashContent('then')}`,
      'a-gone.md': `sha256:${hashContent('then')}`,
    };
    const diff = await diffOutputChecksums(testDir, locked);
    expect(diff.outputsModified).toEqual(['a-edit.md', 'z-edit.md']);
    expect(diff.outputsRemoved).toEqual(['a-gone.md', 'z-gone.md']);
  });
});
