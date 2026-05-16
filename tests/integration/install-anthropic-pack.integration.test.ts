/**
 * Integration coverage for skill-pack install against a synthetic Anthropic
 * skill-pack fixture with the exact same shape as
 * `addyosmani/agent-skills @ 5b4c6da`:
 *
 *   - 23 skills under `skills/<kebab>/SKILL.md`
 *   - 3 agents under `agents/<name>.md` (plus a boilerplate README to test
 *     the importer filter)
 *   - 4 commands under `.claude/commands/` + 3 under `.gemini/commands/`
 *     (no name collisions; aggregator must surface 7 distinct commands)
 *   - 1 root rule under `rules/_root.md`
 *   - References at root contribute to the skill-pack classifier signal
 *     but are NOT linked from any skill body here. The broken-link
 *     behavior is covered by `install-broken-link.integration.test.ts`.
 *
 * Per the P9 scope correction, fixtures are built inline in `beforeEach`
 * rather than committed under `tests/fixtures/`: matches the existing
 * integration-test pattern and avoids large fixture trees in the repo.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-anthropic-pack-integration');

const SKILL_NAMES: readonly string[] = [
  'agent-discovery',
  'agent-init',
  'agent-loop',
  'api-design',
  'arch-review',
  'changeset-generator',
  'code-reviewer',
  'commit-message',
  'data-pipeline',
  'debug-systematic',
  'design-docs',
  'devops-helper',
  'docker-helper',
  'documentation',
  'feature-spec',
  'frontend-design',
  'git-helper',
  'incident-response',
  'interview-me',
  'observability',
  'security-review',
  'sql-helper',
  'test-runner',
];

const AGENT_NAMES: readonly string[] = ['code-reviewer-agent', 'qa-engineer', 'release-manager'];

const CLAUDE_COMMAND_NAMES: readonly string[] = ['init', 'plan', 'release', 'review'];
const GEMINI_COMMAND_NAMES: readonly string[] = ['analyze', 'document', 'refactor'];

const REFERENCE_FILES: readonly string[] = ['orchestration-patterns.md', 'tdd-philosophy.md'];

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

function writeSkill(upstream: string, name: string): void {
  const dir = join(upstream, 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFile(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} skill description\n---\n# ${name}\n`,
  );
}

function writeAgent(upstream: string, name: string): void {
  const dir = join(upstream, 'agents');
  mkdirSync(dir, { recursive: true });
  writeFile(
    join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: ${name} agent description\n---\n# ${name}\n`,
  );
}

function writeCommand(upstream: string, subdir: string, name: string): void {
  const dir = join(upstream, subdir);
  mkdirSync(dir, { recursive: true });
  writeFile(
    join(dir, `${name}.md`),
    `---\ndescription: ${name} command\n---\n# ${name}\n`,
  );
}

function writeRootRule(upstream: string): void {
  const dir = join(upstream, 'rules');
  mkdirSync(dir, { recursive: true });
  writeFile(join(dir, '_root.md'), '---\nroot: true\n---\n# Pack root rule\n');
}

function writeReferences(upstream: string): void {
  const dir = join(upstream, 'references');
  mkdirSync(dir, { recursive: true });
  for (const f of REFERENCE_FILES) {
    writeFile(join(dir, f), `# ${f}\n`);
  }
}

function writeBoilerplate(upstream: string): void {
  // README under agents/ must be excluded by the boilerplate filter.
  writeFile(join(upstream, 'agents', 'README.md'), '# README boilerplate; should be filtered\n');
  // Multi-tool rules at root contribute to the skill-pack classifier signals.
  writeFile(join(upstream, 'CLAUDE.md'), '# Claude rules (signal only)\n');
  writeFile(join(upstream, 'AGENTS.md'), '# AGENTS rules (signal only)\n');
}

function buildUpstream(upstream: string): void {
  mkdirSync(upstream, { recursive: true });
  for (const name of SKILL_NAMES) writeSkill(upstream, name);
  for (const name of AGENT_NAMES) writeAgent(upstream, name);
  for (const name of CLAUDE_COMMAND_NAMES) writeCommand(upstream, '.claude/commands', name);
  for (const name of GEMINI_COMMAND_NAMES) writeCommand(upstream, '.gemini/commands', name);
  writeRootRule(upstream);
  writeReferences(upstream);
  writeBoilerplate(upstream);
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
  readonly name: string;
  readonly source_type: string | null;
  readonly files: Readonly<Record<string, string>>;
}

function readManifest(packDir: string): InstallManifest {
  const raw = readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8');
  return JSON.parse(raw) as InstallManifest;
}

describe('install anthropic skill-pack (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');
    buildUpstream(upstream);
    buildProject(project);
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('imports exact 23 skills + 3 agents + 7 commands + 1 root rule with source_type', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'pack-agent-skills' }, [upstream], project);

    const packsDir = join(project, '.agentsmesh', 'packs');
    expect(readdirSync(packsDir).sort()).toEqual(['pack-agent-skills']);

    const packDir = join(packsDir, 'pack-agent-skills');
    expect(readdirSync(packDir).sort()).toEqual([
      INSTALL_MANIFEST_FILENAME,
      'agents',
      'commands',
      'pack.yaml',
      'rules',
      'skills',
    ]);

    expect(readdirSync(join(packDir, 'skills')).sort()).toEqual([...SKILL_NAMES].sort());
    for (const name of SKILL_NAMES) {
      expect(readdirSync(join(packDir, 'skills', name)).sort()).toEqual(['SKILL.md']);
    }

    expect(readdirSync(join(packDir, 'agents')).sort()).toEqual(
      [...AGENT_NAMES].map((n) => `${n}.md`).sort(),
    );

    const expectedCommandFiles = [...CLAUDE_COMMAND_NAMES, ...GEMINI_COMMAND_NAMES]
      .map((n) => `${n}.md`)
      .sort();
    expect(readdirSync(join(packDir, 'commands')).sort()).toEqual(expectedCommandFiles);

    expect(readdirSync(join(packDir, 'rules')).sort()).toEqual(['_root.md']);

    const manifest = readManifest(packDir);
    expect(manifest.name).toBe('pack-agent-skills');
    expect(manifest.source_type).toBe('anthropic-skill-pack');

    const expectedManifestFiles = [
      ...AGENT_NAMES.map((n) => `agents/${n}.md`),
      ...CLAUDE_COMMAND_NAMES.map((n) => `commands/${n}.md`),
      ...GEMINI_COMMAND_NAMES.map((n) => `commands/${n}.md`),
      'rules/_root.md',
      ...SKILL_NAMES.map((n) => `skills/${n}/SKILL.md`),
    ].sort();
    expect(Object.keys(manifest.files).sort()).toEqual(expectedManifestFiles);
    for (const value of Object.values(manifest.files)) {
      expect(value).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it('writes generated outputs to the claude-code target tree', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'pack-agent-skills' }, [upstream], project);

    for (const name of SKILL_NAMES) {
      expect(existsSync(join(project, '.claude', 'skills', name, 'SKILL.md'))).toBe(true);
    }
    for (const name of AGENT_NAMES) {
      expect(existsSync(join(project, '.claude', 'agents', `${name}.md`))).toBe(true);
    }
    for (const name of [...CLAUDE_COMMAND_NAMES, ...GEMINI_COMMAND_NAMES]) {
      expect(existsSync(join(project, '.claude', 'commands', `${name}.md`))).toBe(true);
    }
    expect(existsSync(join(project, '.claude', 'CLAUDE.md'))).toBe(true);
  });
});
