import { describe, expect, it } from 'vitest';
import {
  compareFormattedLinks,
  formatLinkPathForDestination,
  pickShortestValidatedFormattedLink,
} from '../../../src/core/reference/link-rebaser-output.js';

describe('formatLinkPathForDestination — extra branches', () => {
  it('formats inline-code .agentsmesh/ token as destination-relative', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.agentsmesh/skills/foo/SKILL.md';
    const result = formatLinkPathForDestination(root, dest, target, false, {
      tokenContext: { role: 'inline-code', start: 0, end: 0, line: '', source: '' } as never,
      originalToken: '.agentsmesh/skills/foo/SKILL.md',
    });
    expect(result).toBe('../.agentsmesh/skills/foo/SKILL.md');
  });

  it('uses forceRelative path when forceRelative=true (project scope)', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/skills/foo/SKILL.md';
    expect(
      formatLinkPathForDestination(root, dest, target, false, {
        forceRelative: true,
        explicitCurrentDirLinks: true,
      }),
    ).toBe('./skills/foo/SKILL.md');
  });

  it('global scope with non-mesh destination returns project-root-relative path', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/skills/foo/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false, { scope: 'global' })).toBe(
      '.claude/skills/foo/SKILL.md',
    );
  });

  it('uses logicalMeshSourceAbsolute as mesh canonical when target itself is outside mesh', () => {
    const root = '/proj';
    const dest = '/proj/.agentsmesh/rules/_root.md';
    const target = '/proj/.cursor/skills/foo/SKILL.md';
    const out = formatLinkPathForDestination(root, dest, target, true, {
      logicalMeshSourceAbsolute: '/proj/.agentsmesh/skills/foo',
    });
    // mesh-rooted directory path
    expect(out).toBe('skills/foo/');
  });

  it('returns project-root path when no mesh canonical (target outside mesh, no logical)', () => {
    const root = '/proj';
    const dest = '/proj/.agentsmesh/rules/_root.md';
    const target = '/proj/.cursor/x.md';
    const out = formatLinkPathForDestination(root, dest, target, false);
    expect(out).toBe('.cursor/x.md');
  });

  it('treats path as directory when pathIsDirectory returns true even with keepSlash=false', () => {
    const root = '/proj';
    const dest = '/proj/.claude/SKILL.md';
    const target = '/proj/.agentsmesh/skills/foo';
    const out = formatLinkPathForDestination(root, dest, target, false, {
      pathIsDirectory: (p) => p === '/proj/.agentsmesh/skills/foo',
    });
    expect(out).toBe('skills/foo');
  });

  it('falls back to project-root for directory mesh target when toAgentsMeshRootRelative returns null', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    // mesh canonical = mesh root itself; relative('/proj/.agentsmesh', '/proj/.agentsmesh') = ''
    // toAgentsMeshRootRelative returns null when relPath is empty
    const target = '/proj/.agentsmesh';
    const out = formatLinkPathForDestination(root, dest, target, true, {
      pathIsDirectory: () => true,
      logicalMeshSourceAbsolute: '/proj/.agentsmesh',
    });
    expect(out).toBe('.agentsmesh/');
  });
});

describe('compareFormattedLinks', () => {
  it('returns negative when a has lower tier', () => {
    expect(compareFormattedLinks('./a.md', '../b.md')).toBeLessThan(0);
    expect(compareFormattedLinks('./a.md', 'foo/x.md')).toBeLessThan(0);
    expect(compareFormattedLinks('../a.md', 'foo/x.md')).toBeLessThan(0);
  });

  it('returns positive when b has lower tier', () => {
    expect(compareFormattedLinks('foo/x.md', '../b.md')).toBeGreaterThan(0);
  });

  it('compares ../ count when tiers equal', () => {
    expect(compareFormattedLinks('../../a.md', '../b.md')).toBeGreaterThan(0);
    expect(compareFormattedLinks('../a.md', '../../b.md')).toBeLessThan(0);
  });

  it('falls back to length comparison when tiers and ../ counts equal', () => {
    expect(compareFormattedLinks('foo/abc.md', 'foo/x.md')).toBeGreaterThan(0);
    expect(compareFormattedLinks('foo/x.md', 'foo/abc.md')).toBeLessThan(0);
  });

  it('returns 0 for identical strings', () => {
    expect(compareFormattedLinks('a/b.md', 'a/b.md')).toBe(0);
  });
});

describe('pickShortestValidatedFormattedLink', () => {
  it('returns null when no targets exist', () => {
    expect(
      pickShortestValidatedFormattedLink(
        '/proj',
        '/proj/.claude/CLAUDE.md',
        ['/proj/.claude/foo.md'],
        false,
        {},
        () => false,
      ),
    ).toBeNull();
  });

  it('skips duplicate targets (seen set)', () => {
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/skills/foo/SKILL.md';
    let calls = 0;
    pickShortestValidatedFormattedLink(
      '/proj',
      dest,
      [target, target, target],
      false,
      { explicitCurrentDirLinks: true },
      (_p) => {
        calls++;
        return true;
      },
    );
    // Each unique target invokes pathExists once
    expect(calls).toBe(1);
  });

  it('skips targets where formatted link does not resolve to the same path', () => {
    // Use a target that pathExists says exists but linkResolvesToTarget will reject
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    // Target outside the project root — formatted link will be null and skipped
    const target = '/outside/file.md';
    expect(
      pickShortestValidatedFormattedLink(
        root,
        dest,
        [target],
        false,
        { forceRelative: true },
        () => true,
      ),
    ).toBeNull();
  });

  it('replaces best when a strictly shorter formatted link is found later', () => {
    const root = '/proj';
    const dest = '/proj/.claude/SKILL.md';
    const longer = '/proj/.claude/skills/aaaaaaaaaaa/SKILL.md';
    const shorter = '/proj/.claude/skills/x/SKILL.md';
    const result = pickShortestValidatedFormattedLink(
      root,
      dest,
      [longer, shorter],
      false,
      { forceRelative: true, explicitCurrentDirLinks: true },
      () => true,
    );
    expect(result).toBe('./skills/x/SKILL.md');
  });
});
