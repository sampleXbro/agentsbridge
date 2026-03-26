import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseGithubBlobUrl,
  parseGithubRepoUrl,
  parseGithubTreeUrl,
  parseGitlabBlobUrl,
  parseGitlabRepoUrl,
  parseGitlabTreeUrl,
  parseInstallSource,
} from '../../../src/install/url-parser.js';

describe('parseGithubTreeUrl', () => {
  it('parses org repo ref and path', () => {
    expect(
      parseGithubTreeUrl('https://github.com/anthropics/skills/tree/main/skills/pptx'),
    ).toEqual({
      org: 'anthropics',
      repo: 'skills',
      ref: 'main',
      path: 'skills/pptx',
    });
  });

  it('parses directory path only', () => {
    expect(parseGithubTreeUrl('https://github.com/o/r/tree/main/skills')).toEqual({
      org: 'o',
      repo: 'r',
      ref: 'main',
      path: 'skills',
    });
  });

  it('parses blob file path', () => {
    expect(
      parseGithubBlobUrl(
        'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-standards-enforcer.md',
      ),
    ).toEqual({
      org: 'Njengah',
      repo: 'claude-code-cheat-sheet',
      ref: 'main',
      path: 'subagents/code-standards-enforcer.md',
    });
  });
});

describe('parseGitlabTreeUrl', () => {
  it('parses nested namespace', () => {
    expect(parseGitlabTreeUrl('https://gitlab.com/g1/g2/proj/-/tree/v1.0/skills')).toEqual({
      namespace: 'g1/g2',
      project: 'proj',
      ref: 'v1.0',
      path: 'skills',
    });
  });

  it('parses blob file path', () => {
    expect(
      parseGitlabBlobUrl('https://gitlab.com/g1/g2/proj/-/blob/v1.0/skills/review.md'),
    ).toEqual({
      namespace: 'g1/g2',
      project: 'proj',
      ref: 'v1.0',
      path: 'skills/review.md',
    });
  });
});

describe('parseGithubRepoUrl', () => {
  it('parses bare GitHub repo URL', () => {
    expect(parseGithubRepoUrl('https://github.com/awesome-skills/code-review-skill')).toEqual({
      org: 'awesome-skills',
      repo: 'code-review-skill',
    });
  });

  it('strips .git suffix', () => {
    expect(parseGithubRepoUrl('https://github.com/org/repo.git')).toEqual({
      org: 'org',
      repo: 'repo',
    });
  });

  it('handles trailing slash', () => {
    expect(parseGithubRepoUrl('https://github.com/org/repo/')).toEqual({
      org: 'org',
      repo: 'repo',
    });
  });

  it('returns null for tree URLs', () => {
    expect(parseGithubRepoUrl('https://github.com/org/repo/tree/main/skills')).toBeNull();
  });

  it('returns null for blob URLs', () => {
    expect(parseGithubRepoUrl('https://github.com/org/repo/blob/main/SKILL.md')).toBeNull();
  });

  it('returns null for non-github hosts', () => {
    expect(parseGithubRepoUrl('https://gitlab.com/org/repo')).toBeNull();
  });

  it('returns null for single-segment paths', () => {
    expect(parseGithubRepoUrl('https://github.com/org')).toBeNull();
  });

  it('returns null for 3+ path segments', () => {
    expect(parseGithubRepoUrl('https://github.com/org/repo/something-extra')).toBeNull();
  });
});

describe('parseGitlabRepoUrl', () => {
  it('parses bare GitLab repo URL', () => {
    expect(parseGitlabRepoUrl('https://gitlab.com/group/project')).toEqual({
      namespace: 'group',
      project: 'project',
    });
  });

  it('strips .git suffix', () => {
    expect(parseGitlabRepoUrl('https://gitlab.com/group/project.git')).toEqual({
      namespace: 'group',
      project: 'project',
    });
  });

  it('returns null for tree URLs', () => {
    expect(parseGitlabRepoUrl('https://gitlab.com/group/project/-/tree/main/path')).toBeNull();
  });

  it('returns null for non-gitlab hosts', () => {
    expect(parseGitlabRepoUrl('https://github.com/org/repo')).toBeNull();
  });

  it('returns null for single-segment paths', () => {
    expect(parseGitlabRepoUrl('https://gitlab.com/group')).toBeNull();
  });
});

describe('parseInstallSource', () => {
  const base = join(tmpdir(), 'am-install-parse');
  const cfg = join(base, 'proj');

  it('parses local path with .agentsmesh segment', async () => {
    mkdirSync(join(cfg, '.agentsmesh', 'skills', 'tdd'), { recursive: true });
    writeFileSync(join(cfg, 'agentsmesh.yaml'), 'version: 1\n');
    const p = await parseInstallSource(join(cfg, '.agentsmesh', 'skills', 'tdd'), cfg);
    expect(p.kind).toBe('local');
    expect(p.localRoot).toBe(cfg);
    expect(p.pathInRepo).toBe('skills/tdd');
    rmSync(base, { recursive: true, force: true });
  });

  it('parses pinned github sources written by install metadata', async () => {
    const parsed = await parseInstallSource(
      'github:vijaythecoder/awesome-claude-agents@2050f3c',
      cfg,
    );
    expect(parsed).toEqual({
      kind: 'github',
      rawRef: '2050f3c',
      org: 'vijaythecoder',
      repo: 'awesome-claude-agents',
      gitRemoteUrl: 'https://github.com/vijaythecoder/awesome-claude-agents.git',
      pathInRepo: '',
    });
  });

  it('parses pinned gitlab sources written by install metadata', async () => {
    const parsed = await parseInstallSource('gitlab:group/subgroup/project@abcdef', cfg);
    expect(parsed).toEqual({
      kind: 'gitlab',
      rawRef: 'abcdef',
      org: 'group/subgroup',
      repo: 'project',
      gitRemoteUrl: 'https://gitlab.com/group/subgroup/project.git',
      pathInRepo: '',
    });
  });

  it('parses bare GitHub repo URL as remote install source', async () => {
    const parsed = await parseInstallSource(
      'https://github.com/awesome-skills/code-review-skill',
      cfg,
    );
    expect(parsed).toEqual({
      kind: 'github',
      rawRef: 'HEAD',
      org: 'awesome-skills',
      repo: 'code-review-skill',
      gitRemoteUrl: 'https://github.com/awesome-skills/code-review-skill.git',
      pathInRepo: '',
    });
  });

  it('parses bare GitLab repo URL as remote install source', async () => {
    const parsed = await parseInstallSource('https://gitlab.com/group/project', cfg);
    expect(parsed).toEqual({
      kind: 'gitlab',
      rawRef: 'HEAD',
      org: 'group',
      repo: 'project',
      gitRemoteUrl: 'https://gitlab.com/group/project.git',
      pathInRepo: '',
    });
  });

  it('parses github blob URLs as remote install sources', async () => {
    const parsed = await parseInstallSource(
      'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-standards-enforcer.md',
      cfg,
    );
    expect(parsed).toEqual({
      kind: 'github',
      rawRef: 'main',
      org: 'Njengah',
      repo: 'claude-code-cheat-sheet',
      gitRemoteUrl: 'https://github.com/Njengah/claude-code-cheat-sheet.git',
      pathInRepo: 'subagents/code-standards-enforcer.md',
    });
  });
});
