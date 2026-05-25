/**
 * Integration test for skill-pack-aware install.
 *
 * Builds a synthetic Anthropic-style skill pack (no `.agentsmesh/` at root)
 * that triggers the multi-signal classifier and verifies:
 *   - classifier dispatch surfaces `source_type: anthropic-skill-pack` in
 *     the per-install `.agentsmesh-install-manifest.json`.
 *   - pack tree contains exactly the expected set of files.
 *   - generate runs and lands skills/agents in the target's tree.
 *
 * Fixture is built per-test as a fresh tmpdir; P9 owns the committed
 * fixtures under `tests/fixtures/`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-skill-pack-integration');

function writeSkill(upstream: string, name: string): void {
  const dir = join(upstream, 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} skill description\n---\n# ${name}\n`,
  );
}

function writeAgent(upstream: string, name: string): void {
  mkdirSync(join(upstream, 'agents'), { recursive: true });
  writeFileSync(
    join(upstream, 'agents', `${name}.md`),
    `---\nname: ${name}\ndescription: ${name} agent description\n---\n# ${name}\n`,
  );
}

function writeReadme(upstream: string, dir: string): void {
  const target = join(upstream, dir);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'README.md'), '# Boilerplate readme; should not be imported\n');
}

describe('install anthropic skill-pack (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');
    mkdirSync(upstream, { recursive: true });
    mkdirSync(project, { recursive: true });

    // Skill-pack signals: skill-pack-layout (1.0) + agents-dir (0.4) +
    // multi-tool-rules (0.3) = 1.7 ≥ 1.4 → anthropic-skill-pack.
    writeSkill(upstream, 'foo');
    writeAgent(upstream, 'bar');
    writeFileSync(join(upstream, 'CLAUDE.md'), '# Claude global rules\n');
    writeFileSync(join(upstream, 'AGENTS.md'), '# AGENTS rules\n');
    // Boilerplate that must be filtered out by entity importers.
    writeReadme(upstream, 'agents');

    // Project canonical scaffold.
    mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(project, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills, agents]\nextends: []\n',
    );
    writeFileSync(
      join(project, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('classifies as anthropic-skill-pack and writes source_type into the install manifest', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'pack-from-skill-pack' }, [upstream], project);

    const packsDir = join(project, '.agentsmesh', 'packs');
    expect(readdirSync(packsDir).sort()).toEqual(['pack-from-skill-pack']);

    const packDir = join(packsDir, 'pack-from-skill-pack');
    const packEntries = readdirSync(packDir).sort();
    expect(packEntries).toEqual([INSTALL_MANIFEST_FILENAME, 'agents', 'pack.yaml', 'skills']);

    // README under upstream/agents/ must NOT be imported.
    expect(readdirSync(join(packDir, 'agents')).sort()).toEqual(['bar.md']);
    expect(readdirSync(join(packDir, 'skills')).sort()).toEqual(['foo']);
    expect(readdirSync(join(packDir, 'skills', 'foo')).sort()).toEqual(['SKILL.md']);

    const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string;
      source_type: string | null;
      files: Record<string, string>;
    };
    expect(manifest.name).toBe('pack-from-skill-pack');
    expect(manifest.source_type).toBe('anthropic-skill-pack');
    expect(Object.keys(manifest.files).sort()).toEqual(['agents/bar.md', 'skills/foo/SKILL.md']);

    // Generate ran after install — claude-code target tree exists.
    expect(existsSync(join(project, '.claude', 'skills', 'foo', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(project, '.claude', 'agents', 'bar.md'))).toBe(true);
  });
});
