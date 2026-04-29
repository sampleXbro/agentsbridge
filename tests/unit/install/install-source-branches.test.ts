import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseGithubBlobUrl,
  parseGithubRepoUrl,
  parseGithubTreeUrl,
  parseGitlabBlobUrl,
  parseGitlabRepoUrl,
  parseGitlabTreeUrl,
  parseGitSshGithub,
  parseGitSshGitlab,
} from '../../../src/install/source/url-parser-remotes.js';
import { parseInstallSource } from '../../../src/install/source/parse-install-source.js';

describe('url-parser-remotes null branches', () => {
  describe('parseGithubTreeUrl', () => {
    it('returns null for invalid URL string', () => {
      expect(parseGithubTreeUrl('not a url')).toBeNull();
    });

    it('returns null for non-github host', () => {
      expect(parseGithubTreeUrl('https://gitlab.com/o/r/tree/main/x')).toBeNull();
    });

    it('returns null when no tree segment', () => {
      expect(parseGithubTreeUrl('https://github.com/o/r/something/main')).toBeNull();
    });

    it('returns null when tree index < 2', () => {
      expect(parseGithubTreeUrl('https://github.com/tree/main/path')).toBeNull();
    });

    it('returns null when tree segment is at end (no ref)', () => {
      expect(parseGithubTreeUrl('https://github.com/o/r/tree')).toBeNull();
    });

    it('returns null when ref is empty (tree followed by nothing usable)', () => {
      // empty ref via trailing slash gets filtered out, falls into ti+1 >= length
      expect(parseGithubTreeUrl('https://github.com/o/r/tree/')).toBeNull();
    });
  });

  describe('parseGithubBlobUrl', () => {
    it('returns null for invalid URL string', () => {
      expect(parseGithubBlobUrl('::::')).toBeNull();
    });

    it('returns null for non-github host', () => {
      expect(parseGithubBlobUrl('https://gitlab.com/o/r/blob/main/x.md')).toBeNull();
    });

    it('returns null when no blob segment', () => {
      expect(parseGithubBlobUrl('https://github.com/o/r/tree/main/x')).toBeNull();
    });

    it('returns null when blob index < 2', () => {
      expect(parseGithubBlobUrl('https://github.com/blob/main/file.md')).toBeNull();
    });

    it('returns null when blob segment is at end (no ref)', () => {
      expect(parseGithubBlobUrl('https://github.com/o/r/blob')).toBeNull();
    });

    it('returns null when path is empty', () => {
      // ref present, no further path
      expect(parseGithubBlobUrl('https://github.com/o/r/blob/main')).toBeNull();
    });
  });

  describe('parseGitlabTreeUrl', () => {
    it('returns null for invalid URL string', () => {
      expect(parseGitlabTreeUrl('not://a-url')).toBeNull();
    });

    it('returns null for non-gitlab host', () => {
      expect(parseGitlabTreeUrl('https://github.com/g/p/-/tree/main')).toBeNull();
    });

    it('returns null when missing - marker', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/g/p/tree/main/x')).toBeNull();
    });

    it('returns null when - is not followed by tree', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/g/p/-/blob/main/file.md')).toBeNull();
    });

    it('returns null when before-section length < 2', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/g/-/tree/main/x')).toBeNull();
    });

    it('returns null when ref is missing after tree', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/g/p/-/tree')).toBeNull();
    });
  });

  describe('parseGitlabBlobUrl', () => {
    it('returns null for invalid URL string', () => {
      expect(parseGitlabBlobUrl('::not-a-url::')).toBeNull();
    });

    it('returns null for non-gitlab host', () => {
      expect(parseGitlabBlobUrl('https://github.com/g/p/-/blob/main/file.md')).toBeNull();
    });

    it('returns null when missing - marker', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/p/blob/main/file.md')).toBeNull();
    });

    it('returns null when - is not followed by blob', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/p/-/tree/main/x')).toBeNull();
    });

    it('returns null when before-section length < 2', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/-/blob/main/file.md')).toBeNull();
    });

    it('returns null when ref missing after blob', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/p/-/blob')).toBeNull();
    });

    it('returns null when path is empty', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/p/-/blob/main')).toBeNull();
    });
  });

  describe('parseGithubRepoUrl', () => {
    it('returns null for invalid URL string', () => {
      expect(parseGithubRepoUrl('not a url at all')).toBeNull();
    });

    it('returns null when parts > 2', () => {
      expect(parseGithubRepoUrl('https://github.com/o/r/extra')).toBeNull();
    });

    it('returns null when parts[1] is a route word: tree', () => {
      expect(parseGithubRepoUrl('https://github.com/o/tree')).toBeNull();
    });

    it('returns null when parts[1] is a route word: blob', () => {
      expect(parseGithubRepoUrl('https://github.com/o/blob')).toBeNull();
    });

    it('returns null when parts[1] is a route word: issues', () => {
      expect(parseGithubRepoUrl('https://github.com/o/issues')).toBeNull();
    });

    it('returns null when parts[1] is a route word: pulls', () => {
      expect(parseGithubRepoUrl('https://github.com/o/pulls')).toBeNull();
    });
  });

  describe('parseGitlabRepoUrl', () => {
    it('returns null for invalid URL string', () => {
      expect(parseGitlabRepoUrl('!!nope!!')).toBeNull();
    });

    it('returns null when parts include - marker', () => {
      expect(parseGitlabRepoUrl('https://gitlab.com/g/p/-/tree/main')).toBeNull();
    });
  });

  describe('parseGitSshGithub', () => {
    it('returns null for non-matching string', () => {
      expect(parseGitSshGithub('git@gitlab.com:org/repo.git')).toBeNull();
    });

    it('returns null when format is bogus', () => {
      expect(parseGitSshGithub('not-an-ssh-url')).toBeNull();
    });
  });

  describe('parseGitSshGitlab', () => {
    it('returns null for non-matching string', () => {
      expect(parseGitSshGitlab('git@github.com:org/repo.git')).toBeNull();
    });

    it('returns null for single-part path', () => {
      expect(parseGitSshGitlab('git@gitlab.com:onlyone.git')).toBeNull();
    });
  });
});

describe('parseInstallSource branches', () => {
  function makeTmpCfg(): string {
    return mkdtempSync(join(tmpdir(), 'amesh-parse-src-'));
  }

  describe('git+ prefix', () => {
    it('parses git+ URL with #ref', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('git+https://example.com/o/r.git#abc123', cfg);
        expect(parsed).toEqual({
          kind: 'git',
          rawRef: 'abc123',
          gitPlusBase: 'https://example.com/o/r.git',
          gitRemoteUrl: 'https://example.com/o/r.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses git+ URL without #ref defaulting to HEAD', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('git+https://example.com/o/r.git', cfg);
        expect(parsed).toEqual({
          kind: 'git',
          rawRef: 'HEAD',
          gitPlusBase: 'https://example.com/o/r.git',
          gitRemoteUrl: 'https://example.com/o/r.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });

  describe('HTTPS GitHub', () => {
    it('parses tree URL via detailed parser', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('https://github.com/o/r/tree/main/skills/x', cfg);
        expect(parsed).toEqual({
          kind: 'github',
          rawRef: 'main',
          org: 'o',
          repo: 'r',
          gitRemoteUrl: 'https://github.com/o/r.git',
          pathInRepo: 'skills/x',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses blob URL via detailed parser', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('https://github.com/o/r/blob/main/SKILL.md', cfg);
        expect(parsed).toEqual({
          kind: 'github',
          rawRef: 'main',
          org: 'o',
          repo: 'r',
          gitRemoteUrl: 'https://github.com/o/r.git',
          pathInRepo: 'SKILL.md',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses bare repo URL', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('https://github.com/o/r', cfg);
        expect(parsed).toEqual({
          kind: 'github',
          rawRef: 'HEAD',
          org: 'o',
          repo: 'r',
          gitRemoteUrl: 'https://github.com/o/r.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });

  describe('HTTPS GitLab', () => {
    it('parses tree URL via detailed parser', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource(
          'https://gitlab.com/g1/g2/proj/-/tree/v1/skills',
          cfg,
        );
        expect(parsed).toEqual({
          kind: 'gitlab',
          rawRef: 'v1',
          org: 'g1/g2',
          repo: 'proj',
          gitRemoteUrl: 'https://gitlab.com/g1/g2/proj.git',
          pathInRepo: 'skills',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses blob URL via detailed parser', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('https://gitlab.com/g/p/-/blob/main/SKILL.md', cfg);
        expect(parsed).toEqual({
          kind: 'gitlab',
          rawRef: 'main',
          org: 'g',
          repo: 'p',
          gitRemoteUrl: 'https://gitlab.com/g/p.git',
          pathInRepo: 'SKILL.md',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses bare GitLab repo URL', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('https://gitlab.com/g/p', cfg);
        expect(parsed).toEqual({
          kind: 'gitlab',
          rawRef: 'HEAD',
          org: 'g',
          repo: 'p',
          gitRemoteUrl: 'https://gitlab.com/g/p.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });

  describe('SSH URLs', () => {
    it('parses git@github.com SSH URL', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('git@github.com:o/r.git', cfg);
        expect(parsed).toEqual({
          kind: 'github',
          rawRef: 'HEAD',
          org: 'o',
          repo: 'r',
          gitRemoteUrl: 'https://github.com/o/r.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('throws on invalid github SSH URL', async () => {
      const cfg = makeTmpCfg();
      try {
        await expect(parseInstallSource('git@github.com:', cfg)).rejects.toThrow(
          /Invalid GitHub SSH URL/,
        );
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses git@gitlab.com SSH URL', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('git@gitlab.com:g/p.git', cfg);
        expect(parsed).toEqual({
          kind: 'gitlab',
          rawRef: 'HEAD',
          gitRemoteUrl: 'https://gitlab.com/g/p.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('throws on invalid gitlab SSH URL', async () => {
      const cfg = makeTmpCfg();
      try {
        await expect(parseInstallSource('git@gitlab.com:onlyone', cfg)).rejects.toThrow(
          /Invalid GitLab SSH URL/,
        );
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses generic git@host SSH URL', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('git@bitbucket.org:team/repo.git', cfg);
        expect(parsed).toEqual({
          kind: 'git',
          rawRef: 'HEAD',
          gitRemoteUrl: 'ssh://git@bitbucket.org/team/repo.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('throws on invalid generic SSH URL', async () => {
      const cfg = makeTmpCfg();
      try {
        await expect(parseInstallSource('git@no-colon-here', cfg)).rejects.toThrow(
          /Invalid SSH git URL/,
        );
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });

  describe('Pinned formats', () => {
    it('parses github:org/repo@ref', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('github:o/r@v1.0', cfg);
        expect(parsed).toEqual({
          kind: 'github',
          rawRef: 'v1.0',
          org: 'o',
          repo: 'r',
          gitRemoteUrl: 'https://github.com/o/r.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('parses gitlab:ns/sub/proj@ref with multi-segment namespace', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource('gitlab:ns/sub/proj@abcd', cfg);
        expect(parsed).toEqual({
          kind: 'gitlab',
          rawRef: 'abcd',
          org: 'ns/sub',
          repo: 'proj',
          gitRemoteUrl: 'https://gitlab.com/ns/sub/proj.git',
          pathInRepo: '',
        });
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });

  describe('Trim and pathFlag', () => {
    it('trims surrounding whitespace before parsing local path', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource(`  ${cfg}  `, cfg);
        expect(parsed.kind).toBe('local');
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('uses pathFlag override for github detailed parse', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource(
          'https://github.com/o/r/tree/main/orig',
          cfg,
          'override/path',
        );
        expect(parsed.pathInRepo).toBe('override/path');
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });

    it('uses pathFlag override for gitlab detailed parse', async () => {
      const cfg = makeTmpCfg();
      try {
        const parsed = await parseInstallSource(
          'https://gitlab.com/g/p/-/tree/main/orig',
          cfg,
          'flag/path',
        );
        expect(parsed.pathInRepo).toBe('flag/path');
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });

  describe('Local path errors', () => {
    it('throws when local path does not exist', async () => {
      const cfg = makeTmpCfg();
      try {
        await expect(parseInstallSource('definitely-not-a-real-dir-xyz', cfg)).rejects.toThrow(
          /Path does not exist/,
        );
      } finally {
        rmSync(cfg, { recursive: true, force: true });
      }
    });
  });
});
