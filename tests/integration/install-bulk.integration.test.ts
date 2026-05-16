/**
 * Bulk-prompt (A1) integration coverage.
 *
 * This test focuses on the `force=true` bypass path of the two-tier bulk
 * prompt: every discovered entity must land in the pack with no
 * user prompting. Interactive scenarios (tier-1 [s]elect → tier-2 [c]hoose
 * → tier-3 per-entity y/N) need adapter injection through `runInstall`
 * which is intentionally out of scope here; those paths are covered by
 * the unit suite in `tests/unit/install/prompts/bulk-prompt.test.ts` and
 * by the P14 manual e2e checklist.
 *
 * The fixture aims to be small and self-checking: 3 skills, 2 agents,
 * 2 commands, 1 root rule — every count is exact so a regression where
 * the bulk-prompt narrowing drops an entity surfaces immediately.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-bulk-integration');

const SKILLS: readonly string[] = ['alpha', 'bravo', 'charlie'];
const AGENTS: readonly string[] = ['delta', 'echo'];
const COMMANDS: readonly string[] = ['foxtrot', 'golf'];

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

function buildUpstream(upstream: string): void {
  mkdirSync(upstream, { recursive: true });
  for (const s of SKILLS) {
    const dir = join(upstream, 'skills', s);
    mkdirSync(dir, { recursive: true });
    writeFile(
      join(dir, 'SKILL.md'),
      `---\nname: ${s}\ndescription: ${s} skill\n---\n# ${s}\n`,
    );
  }
  mkdirSync(join(upstream, 'agents'), { recursive: true });
  for (const a of AGENTS) {
    writeFile(
      join(upstream, 'agents', `${a}.md`),
      `---\nname: ${a}\ndescription: ${a} agent\n---\n# ${a}\n`,
    );
  }
  mkdirSync(join(upstream, '.claude', 'commands'), { recursive: true });
  for (const c of COMMANDS) {
    writeFile(
      join(upstream, '.claude', 'commands', `${c}.md`),
      `---\ndescription: ${c} command\n---\n# ${c}\n`,
    );
  }
  mkdirSync(join(upstream, 'rules'), { recursive: true });
  writeFile(join(upstream, 'rules', '_root.md'), '---\nroot: true\n---\n# Pack root\n');
  // Multi-tool rules at root push classifier signal score past threshold.
  writeFile(join(upstream, 'CLAUDE.md'), '# Claude\n');
  writeFile(join(upstream, 'AGENTS.md'), '# Agents\n');
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFile(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills, agents, commands]\nextends: []\n',
  );
  writeFile(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

interface InstallManifest {
  readonly source_type: string | null;
  readonly files: Readonly<Record<string, string>>;
}

describe('install bulk-prompt (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('accepts all discovered entities under --force (tier-1 [a]ll bypass)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'bulk-accept-all' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'bulk-accept-all');
    expect(readdirSync(packDir).sort()).toEqual([
      INSTALL_MANIFEST_FILENAME,
      'agents',
      'commands',
      'pack.yaml',
      'rules',
      'skills',
    ]);
    expect(readdirSync(join(packDir, 'skills')).sort()).toEqual([...SKILLS].sort());
    expect(readdirSync(join(packDir, 'agents')).sort()).toEqual(
      [...AGENTS].map((n) => `${n}.md`).sort(),
    );
    expect(readdirSync(join(packDir, 'commands')).sort()).toEqual(
      [...COMMANDS].map((n) => `${n}.md`).sort(),
    );
    expect(readdirSync(join(packDir, 'rules')).sort()).toEqual(['_root.md']);

    const manifest = JSON.parse(
      readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8'),
    ) as InstallManifest;
    expect(manifest.source_type).toBe('anthropic-skill-pack');
    const expectedFiles = [
      ...AGENTS.map((n) => `agents/${n}.md`),
      ...COMMANDS.map((n) => `commands/${n}.md`),
      'rules/_root.md',
      ...SKILLS.map((n) => `skills/${n}/SKILL.md`),
    ].sort();
    expect(Object.keys(manifest.files).sort()).toEqual(expectedFiles);
  });
});
