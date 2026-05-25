import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { resolveLink } from '../../../../src/install/links/resolve-link.js';
import type { ScannedLink } from '../../../../src/install/links/scan-relative-links.js';

let contentRoot = '';

beforeEach(() => {
  contentRoot = join(tmpdir(), `am-resolve-link-${randomBytes(8).toString('hex')}`);
  mkdirSync(contentRoot, { recursive: true });
});

afterEach(() => {
  rmSync(contentRoot, { recursive: true, force: true });
});

function write(relPath: string, body = ''): void {
  const abs = join(contentRoot, relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
}

function link(path: string): ScannedLink {
  return { raw: path, path, kind: 'inline' };
}

describe('resolveLink', () => {
  it('classifies a link to a file inside includedPaths as "in-tree-included"', async () => {
    write('skills/foo/SKILL.md');
    write('skills/foo/notes.md');
    const result = await resolveLink({
      link: link('notes.md'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md', 'skills/foo/notes.md']),
    });
    expect(result.classification).toBe('in-tree-included');
    expect(result.resolvedRelative).toBe('skills/foo/notes.md');
  });

  it('classifies a link to a file inside contentRoot but outside includedPaths as "resolvable-outside"', async () => {
    write('skills/foo/SKILL.md');
    write('references/orchestration.md');
    const result = await resolveLink({
      link: link('../../references/orchestration.md'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md']),
    });
    expect(result.classification).toBe('resolvable-outside');
    expect(result.resolvedRelative).toBe('references/orchestration.md');
  });

  it('classifies a link to a non-existent file as "unresolvable"', async () => {
    write('skills/foo/SKILL.md');
    const result = await resolveLink({
      link: link('../../references/missing.md'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md']),
    });
    expect(result.classification).toBe('unresolvable');
  });

  it('rejects links escaping contentRoot as "unresolvable" (security boundary)', async () => {
    write('skills/foo/SKILL.md');
    const result = await resolveLink({
      link: link('../../../../etc/passwd'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md']),
    });
    expect(result.classification).toBe('unresolvable');
    expect(result.resolvedRelative).toBeNull();
  });

  it('strips the #anchor before resolving but preserves it on the result', async () => {
    write('skills/foo/SKILL.md');
    write('skills/foo/notes.md');
    const result = await resolveLink({
      link: link('notes.md#section-a'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md', 'skills/foo/notes.md']),
    });
    expect(result.classification).toBe('in-tree-included');
    expect(result.resolvedRelative).toBe('skills/foo/notes.md');
    expect(result.anchor).toBe('#section-a');
  });

  it('returns empty anchor when link has no #fragment', async () => {
    write('skills/foo/SKILL.md');
    write('skills/foo/notes.md');
    const result = await resolveLink({
      link: link('notes.md'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md', 'skills/foo/notes.md']),
    });
    expect(result.anchor).toBe('');
  });

  it('treats a directory target as "in-tree-included" when the directory is in includedPaths', async () => {
    write('skills/foo/SKILL.md');
    mkdirSync(join(contentRoot, 'skills/foo/scripts'), { recursive: true });
    const result = await resolveLink({
      link: link('scripts/'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md', 'skills/foo/scripts']),
    });
    expect(result.classification).toBe('in-tree-included');
    expect(result.resolvedRelative).toBe('skills/foo/scripts');
  });

  it('treats an existing directory NOT in includedPaths as "resolvable-outside"', async () => {
    write('skills/foo/SKILL.md');
    mkdirSync(join(contentRoot, 'references'), { recursive: true });
    write('references/index.md');
    const result = await resolveLink({
      link: link('../../references/'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md']),
    });
    expect(result.classification).toBe('resolvable-outside');
    expect(result.resolvedRelative).toBe('references');
  });

  it('classifies an absolute-root link (./...) inside includedPaths correctly', async () => {
    write('skills/foo/SKILL.md');
    write('skills/foo/scripts/run.sh');
    const result = await resolveLink({
      link: link('./scripts/run.sh'),
      fromFile: 'skills/foo/SKILL.md',
      contentRoot,
      includedPaths: new Set(['skills/foo/SKILL.md', 'skills/foo/scripts/run.sh']),
    });
    expect(result.classification).toBe('in-tree-included');
    expect(result.resolvedRelative).toBe('skills/foo/scripts/run.sh');
  });
});
