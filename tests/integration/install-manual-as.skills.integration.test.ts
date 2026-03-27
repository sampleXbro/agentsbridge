import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { listRelativeFiles, readInstallManifest } from '../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'am-install-manual-as-skills');

function seedProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules,skills]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

function seedSkills(upstream: string): void {
  mkdirSync(join(upstream, 'review', 'templates'), { recursive: true });
  mkdirSync(join(upstream, 'qa'), { recursive: true });
  writeFileSync(join(upstream, 'review', 'SKILL.md'), '---\ndescription: Review\n---\n\nReview.\n');
  writeFileSync(join(upstream, 'review', 'templates', 'plan.md'), '# Plan\n');
  writeFileSync(join(upstream, 'qa', 'SKILL.md'), '---\ndescription: QA\n---\n\nTest.\n');
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('install standalone skill repo (integration)', () => {
  it('installs a repo-root skill using frontmatter name and excludes boilerplate', async () => {
    const repoDir = join(ROOT, 'code-review-skill');
    const project = join(ROOT, 'project');
    mkdirSync(join(repoDir, 'reference'), { recursive: true });
    mkdirSync(join(repoDir, 'assets'), { recursive: true });
    writeFileSync(
      join(repoDir, 'SKILL.md'),
      '---\nname: code-review-excellence\ndescription: Code review\n---\n\nReview code.\n',
    );
    writeFileSync(join(repoDir, 'reference', 'react.md'), '# React guide\n');
    writeFileSync(join(repoDir, 'assets', 'template.md'), '# Template\n');
    writeFileSync(join(repoDir, 'README.md'), '# Code Review Skill\n');
    writeFileSync(join(repoDir, 'LICENSE'), 'MIT\n');
    writeFileSync(join(repoDir, 'CONTRIBUTING.md'), '# Contributing\n');
    writeFileSync(join(repoDir, '.gitignore'), 'node_modules\n');
    seedProject(project);

    await runInstall({ force: true, as: 'skills', name: 'code-review' }, [repoDir], project);

    const packFiles = listRelativeFiles(join(project, '.agentsmesh', 'packs', 'code-review'));
    expect(packFiles).toEqual([
      'pack.yaml',
      'skills/code-review-excellence/SKILL.md',
      'skills/code-review-excellence/assets/template.md',
      'skills/code-review-excellence/reference/react.md',
    ]);

    const generatedFiles = listRelativeFiles(join(project, '.claude'));
    expect(generatedFiles).toEqual([
      'CLAUDE.md',
      'skills/code-review-excellence/SKILL.md',
      'skills/code-review-excellence/assets/template.md',
      'skills/code-review-excellence/reference/react.md',
    ]);

    const manifest = readInstallManifest(join(project, '.agentsmesh', 'installs.yaml'));
    expect(manifest.installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'code-review',
        pick: { skills: ['code-review-excellence'] },
        source: '../code-review-skill',
        source_kind: 'local',
      },
    ]);
  });
});

describe('install manual --as skills (integration)', () => {
  it('bulk installs a folder of skills with exact generated and pack trees', async () => {
    const upstream = join(ROOT, 'upstream', 'skills');
    const project = join(ROOT, 'project');
    seedSkills(upstream);
    seedProject(project);

    await runInstall(
      { force: true, as: 'skills', path: 'skills', name: 'bulk-skills' },
      [join(ROOT, 'upstream')],
      project,
    );

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'bulk-skills'))).toEqual([
      'pack.yaml',
      'skills/qa/SKILL.md',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/qa/SKILL.md',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'bulk-skills',
        path: 'skills',
        source: '../upstream',
        source_kind: 'local',
      },
    ]);
  });

  it('single-item installs one skill from an explicit SKILL.md path', async () => {
    const upstream = join(ROOT, 'upstream', 'skills');
    const project = join(ROOT, 'project');
    seedSkills(upstream);
    seedProject(project);

    await runInstall(
      { force: true, as: 'skills', path: 'skills/review/SKILL.md', name: 'single-skill' },
      [join(ROOT, 'upstream')],
      project,
    );

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'single-skill'))).toEqual([
      'pack.yaml',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'single-skill',
        path: 'skills',
        pick: { skills: ['review'] },
        source: '../upstream',
        source_kind: 'local',
      },
    ]);
  });

  it('single-item installs one skill from a direct skill directory source', async () => {
    const upstream = join(ROOT, 'upstream', 'skills');
    const project = join(ROOT, 'project');
    seedSkills(upstream);
    seedProject(project);

    await runInstall(
      { force: true, as: 'skills', name: 'direct-skill' },
      [join(upstream, 'review')],
      project,
    );

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'direct-skill'))).toEqual([
      'pack.yaml',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'direct-skill',
        pick: { skills: ['review'] },
        source: '../upstream/skills/review',
        source_kind: 'local',
      },
    ]);
    expect(
      readFileSync(join(project, '.claude', 'skills', 'review', 'SKILL.md'), 'utf8'),
    ).toContain('Review.');
  });

  it('amends the same skill pack and manifest when adding another sibling skill', async () => {
    const upstream = join(ROOT, 'upstream', 'skills');
    const project = join(ROOT, 'project');
    seedSkills(upstream);
    seedProject(project);

    await runInstall(
      { force: true, as: 'skills', path: 'skills/review/SKILL.md' },
      [join(ROOT, 'upstream')],
      project,
    );
    await runInstall(
      { force: true, as: 'skills', path: 'skills/qa/SKILL.md' },
      [join(ROOT, 'upstream')],
      project,
    );

    expect(listRelativeFiles(join(project, '.agentsmesh', 'packs', 'upstream-skills'))).toEqual([
      'pack.yaml',
      'skills/qa/SKILL.md',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(listRelativeFiles(join(project, '.claude'))).toEqual([
      'CLAUDE.md',
      'skills/qa/SKILL.md',
      'skills/review/SKILL.md',
      'skills/review/templates/plan.md',
    ]);
    expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
      {
        as: 'skills',
        features: ['skills'],
        name: 'upstream-skills',
        path: 'skills',
        pick: { skills: ['review', 'qa'] },
        source: '../upstream',
        source_kind: 'local',
      },
    ]);
  });
});
