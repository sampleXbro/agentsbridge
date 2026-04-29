import { describe, it, expect } from 'vitest';
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

describe('url-parser-remotes — error and edge branches', () => {
  describe('parseGithubTreeUrl', () => {
    it('returns null when URL constructor throws', () => {
      expect(parseGithubTreeUrl('not a url')).toBeNull();
    });

    it('returns null on non-github hostnames', () => {
      expect(parseGithubTreeUrl('https://example.com/o/r/tree/main/x')).toBeNull();
    });

    it('returns null when path lacks tree segment', () => {
      expect(parseGithubTreeUrl('https://github.com/o/r')).toBeNull();
    });

    it('returns null when tree has no ref segment', () => {
      expect(parseGithubTreeUrl('https://github.com/o/r/tree')).toBeNull();
    });

    it('returns object with empty path when only repo+ref', () => {
      expect(parseGithubTreeUrl('https://github.com/o/r/tree/main')).toEqual({
        org: 'o',
        repo: 'r',
        ref: 'main',
        path: '',
      });
    });
  });

  describe('parseGithubBlobUrl', () => {
    it('returns null on bad URL', () => {
      expect(parseGithubBlobUrl(':::nope')).toBeNull();
    });

    it('returns null when path is missing (blob requires file path)', () => {
      expect(parseGithubBlobUrl('https://github.com/o/r/blob/main')).toBeNull();
    });

    it('returns null on non-github host', () => {
      expect(parseGithubBlobUrl('https://example.com/o/r/blob/main/x.md')).toBeNull();
    });
  });

  describe('parseGitlabTreeUrl', () => {
    it('returns null on URL parse error', () => {
      expect(parseGitlabTreeUrl('::not-url')).toBeNull();
    });

    it('returns null when "-" segment is missing', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/group/proj/tree/main/x')).toBeNull();
    });

    it('returns null when "-" not followed by tree', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/group/proj/-/blob/main/x')).toBeNull();
    });

    it('returns null when there is no ref after tree', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/group/proj/-/tree')).toBeNull();
    });

    it('returns null when before is too short for namespace+project', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/onlyone/-/tree/main/x')).toBeNull();
    });

    it('returns object when no path after ref', () => {
      expect(parseGitlabTreeUrl('https://gitlab.com/group/proj/-/tree/v1')).toEqual({
        namespace: 'group',
        project: 'proj',
        ref: 'v1',
        path: '',
      });
    });
  });

  describe('parseGitlabBlobUrl', () => {
    it('returns null on URL parse error', () => {
      expect(parseGitlabBlobUrl('::nope')).toBeNull();
    });

    it('returns null when path is missing', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/p/-/blob/v1')).toBeNull();
    });

    it('returns null when - is not followed by blob', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/g/p/-/tree/v1/file.md')).toBeNull();
    });

    it('returns null when before lacks namespace/project', () => {
      expect(parseGitlabBlobUrl('https://gitlab.com/just/-/blob/v1/file.md')).toBeNull();
    });
  });

  describe('parseGithubRepoUrl', () => {
    it('returns null on URL parse error', () => {
      expect(parseGithubRepoUrl('::not-url')).toBeNull();
    });
  });

  describe('parseGitlabRepoUrl', () => {
    it('returns null on URL parse error', () => {
      expect(parseGitlabRepoUrl('::not-url')).toBeNull();
    });

    it('returns null when path contains - segment', () => {
      expect(parseGitlabRepoUrl('https://gitlab.com/group/-/tree/main')).toBeNull();
    });
  });

  describe('parseGitSshGithub', () => {
    it('parses git@github.com SSH URL', () => {
      expect(parseGitSshGithub('git@github.com:org/repo.git')).toEqual({
        org: 'org',
        repo: 'repo',
      });
    });

    it('parses without .git suffix', () => {
      expect(parseGitSshGithub('git@github.com:org/repo')).toEqual({
        org: 'org',
        repo: 'repo',
      });
    });

    it('returns null on invalid SSH form', () => {
      expect(parseGitSshGithub('https://github.com/org/repo')).toBeNull();
    });
  });

  describe('parseGitSshGitlab', () => {
    it('parses git@gitlab.com SSH with single namespace', () => {
      expect(parseGitSshGitlab('git@gitlab.com:group/proj.git')).toEqual({
        namespace: 'group',
        project: 'proj',
      });
    });

    it('parses nested namespace', () => {
      expect(parseGitSshGitlab('git@gitlab.com:g1/g2/proj.git')).toEqual({
        namespace: 'g1/g2',
        project: 'proj',
      });
    });

    it('returns null when not enough parts', () => {
      expect(parseGitSshGitlab('git@gitlab.com:onlyone.git')).toBeNull();
    });

    it('returns null on non-matching prefix', () => {
      expect(parseGitSshGitlab('git@github.com:org/repo.git')).toBeNull();
    });
  });
});
