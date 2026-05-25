/**
 * Targeted-install integration coverage.
 *
 * The locked design decision: `--as <kind>` and `--target <id>` ALWAYS
 * bypass the multi-signal classifier and route through the existing
 * manual/native importer paths. Even when the upstream tree carries every
 * skill-pack classifier signal, an explicit override must NOT mutate
 * pack contents or stamp `source_type: anthropic-skill-pack` into the
 * install manifest.
 *
 * The upstream fixture below intentionally reaches a high classifier
 * score (skill-pack-layout 1.0 + agents-dir 0.4 + multi-tool-rules 0.3
 * = 1.7). Without an override, this would dispatch to the anthropic
 * skill-pack aggregator. Each test forces a different override and
 * asserts the resulting manifest's `source_type` is null (classifier
 * bypassed).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-targeted-integration');

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

function buildSkillPackUpstream(upstream: string): void {
  mkdirSync(upstream, { recursive: true });

  // Skill that triggers the primary skill-pack-layout signal.
  mkdirSync(join(upstream, 'skills', 'alpha'), { recursive: true });
  writeFile(
    join(upstream, 'skills', 'alpha', 'SKILL.md'),
    '---\nname: alpha\ndescription: alpha skill\n---\n# alpha\n',
  );

  // Agent that triggers the agents-dir signal.
  mkdirSync(join(upstream, 'agents'), { recursive: true });
  writeFile(
    join(upstream, 'agents', 'helper.md'),
    '---\nname: helper\ndescription: helper agent\n---\n# helper\n',
  );

  // Multi-tool root rules push the total signal score over 1.4.
  writeFile(join(upstream, 'CLAUDE.md'), '# Claude\n');
  writeFile(join(upstream, 'AGENTS.md'), '# AGENTS\n');
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFile(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills, agents]\nextends: []\n',
  );
  writeFile(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

interface InstallManifest {
  readonly name: string;
  readonly source_type: string | null;
  readonly files: Readonly<Record<string, string>>;
}

function readManifest(packDir: string): InstallManifest {
  return JSON.parse(
    readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8'),
  ) as InstallManifest;
}

describe('install targeted overrides (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildSkillPackUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('--as skills bypasses the classifier (source_type is null)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall(
      { force: true, as: 'skills', path: 'skills', name: 'targeted-skills' },
      [upstream],
      project,
    );

    const manifest = readManifest(join(project, '.agentsmesh', 'packs', 'targeted-skills'));
    expect(manifest.source_type).toBeNull();
    expect(Object.keys(manifest.files).sort()).toEqual(['skills/alpha/SKILL.md']);
  });

  it('--as agents bypasses the classifier (source_type is null)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall(
      { force: true, as: 'agents', path: 'agents', name: 'targeted-agents' },
      [upstream],
      project,
    );

    const manifest = readManifest(join(project, '.agentsmesh', 'packs', 'targeted-agents'));
    expect(manifest.source_type).toBeNull();
    expect(Object.keys(manifest.files).sort()).toEqual(['agents/helper.md']);
  });

  it('--target <id> + --path bypasses the classifier (source_type is null)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    // Seed a tool-native subtree that the native importer can scope into.
    mkdirSync(join(upstream, '.github', 'instructions'), { recursive: true });
    writeFile(
      join(upstream, '.github', 'instructions', 'review.instructions.md'),
      '---\ndescription: Review instructions\napplyTo: src/**/*.ts\n---\n# Review\n',
    );

    await runInstall(
      {
        force: true,
        target: 'copilot',
        path: '.github/instructions',
        name: 'targeted-copilot',
      },
      [upstream],
      project,
    );

    const manifest = readManifest(join(project, '.agentsmesh', 'packs', 'targeted-copilot'));
    expect(manifest.source_type).toBeNull();
    expect(Object.keys(manifest.files).sort()).toEqual(['rules/review.md']);
  });
});
