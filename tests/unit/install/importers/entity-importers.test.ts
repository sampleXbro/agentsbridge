import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  importAgents,
  importCommands,
  importRules,
  importSkills,
} from '../../../../src/install/importers/entity-importers.js';

let root = '';

beforeEach(() => {
  root = join(tmpdir(), `am-entity-importers-${randomBytes(8).toString('hex')}`);
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeFm(path: string, frontmatter: string, body = ''): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `---\n${frontmatter}\n---\n${body}`);
}

describe('importAgents', () => {
  it('returns exactly 3 agents from a dir containing 3 personas + README boilerplate', async () => {
    const agentsDir = join(root, 'agents');
    mkdirSync(agentsDir, { recursive: true });
    writeFm(join(agentsDir, 'code-reviewer.md'), 'description: Reviews code', '# Code Reviewer');
    writeFm(join(agentsDir, 'test-engineer.md'), 'description: Writes tests', '# Test Engineer');
    writeFm(join(agentsDir, 'security-auditor.md'), 'description: Audits security', '# Auditor');
    writeFileSync(join(agentsDir, 'README.md'), '# Agents directory\n\nDocs.\n');

    const result = await importAgents(agentsDir);
    const names = result.map((a) => a.name).sort();
    expect(names).toEqual(['code-reviewer', 'security-auditor', 'test-engineer']);
  });

  it('excludes LICENSE.md and CONTRIBUTING.md boilerplate', async () => {
    const agentsDir = join(root, 'agents');
    mkdirSync(agentsDir, { recursive: true });
    writeFm(join(agentsDir, 'planner.md'), 'description: Plans work', '# Planner');
    writeFileSync(join(agentsDir, 'LICENSE.md'), 'MIT\n');
    writeFileSync(join(agentsDir, 'CONTRIBUTING.md'), 'See CONTRIBUTING\n');

    const result = await importAgents(agentsDir);
    expect(result.map((a) => a.name)).toEqual(['planner']);
  });

  it('excludes case-insensitive boilerplate variants (Readme.md)', async () => {
    const agentsDir = join(root, 'agents');
    mkdirSync(agentsDir, { recursive: true });
    writeFm(join(agentsDir, 'interview-me.md'), 'description: Interview helper', '# Interview');
    writeFileSync(join(agentsDir, 'Readme.md'), '# Mixed-case readme\n');
    writeFileSync(join(agentsDir, 'CHANGELOG.md'), 'v1.0\n');

    const result = await importAgents(agentsDir);
    expect(result.map((a) => a.name)).toEqual(['interview-me']);
  });

  it('returns empty array when agents dir is missing', async () => {
    const result = await importAgents(join(root, 'does-not-exist'));
    expect(result).toEqual([]);
  });
});

describe('importCommands', () => {
  it('returns exactly 2 commands when dir contains 2 commands + CHANGELOG.md', async () => {
    const commandsDir = join(root, 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFm(join(commandsDir, 'review.md'), 'description: Run review', '# Review');
    writeFm(join(commandsDir, 'release.md'), 'description: Cut a release', '# Release');
    writeFileSync(join(commandsDir, 'CHANGELOG.md'), '## 1.0\n');

    const result = await importCommands(commandsDir);
    expect(result.map((c) => c.name).sort()).toEqual(['release', 'review']);
  });

  it('excludes SECURITY.md and CODE_OF_CONDUCT.md boilerplate', async () => {
    const commandsDir = join(root, 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFm(join(commandsDir, 'deploy.md'), 'description: Deploy app', '# Deploy');
    writeFileSync(join(commandsDir, 'SECURITY.md'), 'Report to security@\n');
    writeFileSync(join(commandsDir, 'CODE_OF_CONDUCT.md'), 'Be kind.\n');

    const result = await importCommands(commandsDir);
    expect(result.map((c) => c.name)).toEqual(['deploy']);
  });
});

describe('importRules', () => {
  it('returns exactly 2 rules when dir contains 2 rules + README.md', async () => {
    const rulesDir = join(root, 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFm(join(rulesDir, '_root.md'), 'description: Root rule', '# Root');
    writeFm(join(rulesDir, 'typescript.md'), 'description: TS rule', '# TypeScript');
    writeFileSync(join(rulesDir, 'README.md'), '# Rules dir docs\n');

    const result = await importRules(rulesDir);
    const sources = result.map((r) => r.source.split(/[\\/]/).pop()).sort();
    expect(sources).toEqual(['_root.md', 'typescript.md']);
  });

  it('preserves the canonical _root.md filename (not boilerplate)', async () => {
    const rulesDir = join(root, 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFm(join(rulesDir, '_root.md'), 'description: Root rule', '# Root');
    writeFileSync(join(rulesDir, 'LICENSE'), 'MIT\n');

    const result = await importRules(rulesDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.root).toBe(true);
  });
});

describe('importSkills', () => {
  it('returns a skill that preserves scripts/ subdir as supporting files', async () => {
    const skillsDir = join(root, 'skills');
    const skillDir = join(skillsDir, 'release-manager');
    mkdirSync(join(skillDir, 'scripts'), { recursive: true });
    writeFm(join(skillDir, 'SKILL.md'), 'description: Manage releases', '# Release Manager');
    writeFileSync(join(skillDir, 'scripts', 'tag.sh'), '#!/usr/bin/env bash\necho tag\n');
    writeFileSync(join(skillDir, 'scripts', 'changelog.py'), 'print("notes")\n');

    const result = await importSkills(skillsDir);
    expect(result).toHaveLength(1);
    const skill = result[0]!;
    expect(skill.name).toBe('release-manager');
    const relPaths = skill.supportingFiles.map((f) => f.relativePath).sort();
    expect(relPaths).toEqual(['scripts/changelog.py', 'scripts/tag.sh']);
  });

  it('ignores README.md at the skills/ root (not a skill directory)', async () => {
    const skillsDir = join(root, 'skills');
    const skillDir = join(skillsDir, 'lint');
    mkdirSync(skillDir, { recursive: true });
    writeFm(join(skillDir, 'SKILL.md'), 'description: Lint code', '# Lint');
    writeFileSync(join(skillsDir, 'README.md'), '# Skills index\n');

    const result = await importSkills(skillsDir);
    expect(result.map((s) => s.name)).toEqual(['lint']);
  });

  it('returns empty array when skills dir is missing', async () => {
    const result = await importSkills(join(root, 'does-not-exist'));
    expect(result).toEqual([]);
  });
});
