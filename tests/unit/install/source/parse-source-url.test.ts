import { describe, it, expect } from 'vitest';
import { parseSourceUrl } from '../../../../src/install/source/parse-source-url.js';

describe('parseSourceUrl', () => {
  // ── github: shorthand ────────────────────────────────────────────────────

  it('parses github:<org>/<repo> (bare)', () => {
    expect(parseSourceUrl('github:org/repo')).toEqual({
      kind: 'github',
      remoteUrl: 'https://github.com/org/repo.git',
      ref: 'HEAD',
    });
  });

  it('parses github:<org>/<repo>@<ref>', () => {
    expect(parseSourceUrl('github:org/repo@v1.2.3')).toEqual({
      kind: 'github',
      remoteUrl: 'https://github.com/org/repo.git',
      ref: 'v1.2.3',
    });
  });

  it('parses github:<org>/<repo>@<sha>', () => {
    expect(parseSourceUrl('github:myorg/myrepo@2050f3c')).toEqual({
      kind: 'github',
      remoteUrl: 'https://github.com/myorg/myrepo.git',
      ref: '2050f3c',
    });
  });

  // ── gitlab: shorthand ────────────────────────────────────────────────────

  it('parses gitlab:<ns>/<repo> (bare)', () => {
    expect(parseSourceUrl('gitlab:ns/repo')).toEqual({
      kind: 'gitlab',
      remoteUrl: 'https://gitlab.com/ns/repo.git',
      ref: 'HEAD',
    });
  });

  it('parses gitlab:<ns>/<repo>@<ref>', () => {
    expect(parseSourceUrl('gitlab:ns/repo@v2')).toEqual({
      kind: 'gitlab',
      remoteUrl: 'https://gitlab.com/ns/repo.git',
      ref: 'v2',
    });
  });

  it('parses gitlab with nested namespace', () => {
    expect(parseSourceUrl('gitlab:group/subgroup/project@abcdef')).toEqual({
      kind: 'gitlab',
      remoteUrl: 'https://gitlab.com/group/subgroup/project.git',
      ref: 'abcdef',
    });
  });

  // ── git+ prefix ─────────────────────────────────────────────────────────

  it('parses git+https://<url>#<branch>', () => {
    expect(parseSourceUrl('git+https://example.com/repo.git#mybranch')).toEqual({
      kind: 'git',
      remoteUrl: 'https://example.com/repo.git',
      ref: 'mybranch',
    });
  });

  it('parses git+https://<url> without a ref (defaults to HEAD)', () => {
    expect(parseSourceUrl('git+https://example.com/repo.git')).toEqual({
      kind: 'git',
      remoteUrl: 'https://example.com/repo.git',
      ref: 'HEAD',
    });
  });

  // ── HTTPS passthrough ────────────────────────────────────────────────────

  it('parses bare https://github.com/<org>/<repo>', () => {
    expect(parseSourceUrl('https://github.com/org/repo.git')).toEqual({
      kind: 'github',
      remoteUrl: 'https://github.com/org/repo.git',
      ref: 'HEAD',
    });
  });

  it('parses https://github.com/<org>/<repo>/tree/<ref>/<path>', () => {
    expect(parseSourceUrl('https://github.com/org/repo/tree/main/skills')).toEqual({
      kind: 'github',
      remoteUrl: 'https://github.com/org/repo.git',
      ref: 'main',
    });
  });

  it('parses bare https://gitlab.com/<ns>/<project>', () => {
    expect(parseSourceUrl('https://gitlab.com/ns/project')).toEqual({
      kind: 'gitlab',
      remoteUrl: 'https://gitlab.com/ns/project.git',
      ref: 'HEAD',
    });
  });

  // ── SCP-style SSH ────────────────────────────────────────────────────────

  it('parses git@github.com:<org>/<repo>.git', () => {
    expect(parseSourceUrl('git@github.com:org/repo.git')).toEqual({
      kind: 'github',
      remoteUrl: 'https://github.com/org/repo.git',
      ref: 'HEAD',
    });
  });

  it('parses git@gitlab.com:<ns>/<project>.git', () => {
    expect(parseSourceUrl('git@gitlab.com:ns/project.git')).toEqual({
      kind: 'gitlab',
      remoteUrl: 'https://gitlab.com/ns/project.git',
      ref: 'HEAD',
    });
  });

  it('parses generic git@<host>:<path> as kind=git', () => {
    expect(parseSourceUrl('git@bitbucket.org:team/repo.git')).toEqual({
      kind: 'git',
      remoteUrl: 'ssh://git@bitbucket.org/team/repo.git',
      ref: 'HEAD',
    });
  });

  // ── local: ──────────────────────────────────────────────────────────────

  it('returns kind=local without remoteUrl/ref for local: sources', () => {
    expect(parseSourceUrl('local:./path')).toEqual({ kind: 'local' });
  });

  it('returns kind=local without remoteUrl/ref for any local: prefix', () => {
    expect(parseSourceUrl('local:/abs/path')).toEqual({ kind: 'local' });
  });

  // ── null for unparseable ─────────────────────────────────────────────────

  it('returns null for completely unrecognized input', () => {
    expect(parseSourceUrl('not-a-valid-source')).toBeNull();
  });
});
