import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as yamlStringify } from 'yaml';
import { materializePack } from '../../../src/install/pack/pack-writer.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

let tmpDir: string;
let srcDir: string; // simulated source (cache / .agentsmesh) dir
let packsDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `pack-writer-test-${Date.now()}`);
  srcDir = join(tmpDir, 'src');
  packsDir = join(tmpDir, 'packs');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(packsDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Write a rule file at srcDir and return its path */
function writeRule(name: string, body: string): string {
  const dir = join(srcDir, 'rules');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.md`);
  writeFileSync(path, `---\nroot: false\ndescription: ${name} rule\n---\n\n${body}`, 'utf-8');
  return path;
}

/** Write a command file at srcDir and return its path */
function writeCommand(name: string, body: string): string {
  const dir = join(srcDir, 'commands');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.md`);
  writeFileSync(path, `---\ndescription: ${name} command\n---\n\n${body}`, 'utf-8');
  return path;
}

/** Write a skill directory at srcDir and return SKILL.md path */
function writeSkill(name: string, body: string): { skillPath: string; supportPath: string } {
  const dir = join(srcDir, 'skills', name);
  mkdirSync(dir, { recursive: true });
  const skillPath = join(dir, 'SKILL.md');
  const supportPath = join(dir, 'checklist.md');
  writeFileSync(skillPath, `---\ndescription: ${name} skill\n---\n\n${body}`, 'utf-8');
  writeFileSync(supportPath, `# ${name} checklist\n`, 'utf-8');
  return { skillPath, supportPath };
}

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

const BASE_META = {
  name: 'test-pack',
  source: 'github:org/repo@abc123',
  version: 'abc123',
  source_kind: 'github' as const,
  installed_at: '2026-03-22T10:00:00Z',
  updated_at: '2026-03-22T10:00:00Z',
  features: ['rules'] as ('rules' | 'skills' | 'commands' | 'agents')[],
};

describe('materializePack', () => {
  it('creates pack directory with rules/', async () => {
    const rulePath = writeRule('security', 'Use HTTPS always.');
    const canonical = makeCanonical({
      rules: [
        {
          source: rulePath,
          root: false,
          targets: [],
          description: 'security rule',
          globs: [],
          body: 'Use HTTPS always.',
        },
      ],
    });

    const meta = await materializePack(packsDir, 'test-pack', canonical, {
      ...BASE_META,
      features: ['rules'],
    });

    expect(existsSync(join(packsDir, 'test-pack'))).toBe(true);
    expect(existsSync(join(packsDir, 'test-pack', 'rules', 'security.md'))).toBe(true);
    expect(existsSync(join(packsDir, 'test-pack', 'pack.yaml'))).toBe(true);
    expect(meta.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('creates pack directory with commands/', async () => {
    const cmdPath = writeCommand('deploy', 'Run deploy script.');
    const canonical = makeCanonical({
      commands: [
        {
          source: cmdPath,
          name: 'deploy',
          description: 'deploy command',
          allowedTools: [],
          body: 'Run deploy script.',
        },
      ],
    });

    await materializePack(packsDir, 'test-pack', canonical, {
      ...BASE_META,
      features: ['commands'],
    });

    expect(existsSync(join(packsDir, 'test-pack', 'commands', 'deploy.md'))).toBe(true);
  });

  it('creates pack directory with skills/ including supporting files', async () => {
    const { skillPath, supportPath } = writeSkill('tdd', 'Write tests first.');
    const canonical = makeCanonical({
      skills: [
        {
          source: skillPath,
          name: 'tdd',
          description: 'TDD skill',
          body: 'Write tests first.',
          supportingFiles: [
            {
              relativePath: 'checklist.md',
              absolutePath: supportPath,
              content: '# tdd checklist\n',
            },
          ],
        },
      ],
    });

    await materializePack(packsDir, 'test-pack', canonical, {
      ...BASE_META,
      features: ['skills'],
    });

    expect(existsSync(join(packsDir, 'test-pack', 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(packsDir, 'test-pack', 'skills', 'tdd', 'checklist.md'))).toBe(true);
  });

  it('writes pack.yaml with correct metadata and content_hash', async () => {
    const rulePath = writeRule('ts', 'Use TypeScript.');
    const canonical = makeCanonical({
      rules: [
        {
          source: rulePath,
          root: false,
          targets: [],
          description: 'ts rule',
          globs: [],
          body: 'Use TypeScript.',
        },
      ],
    });

    const meta = await materializePack(packsDir, 'test-pack', canonical, {
      ...BASE_META,
      features: ['rules'],
    });

    expect(meta.name).toBe('test-pack');
    expect(meta.source).toBe('github:org/repo@abc123');
    expect(meta.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('cleans up stale .tmp directory before writing', async () => {
    // Create a stale .tmp directory
    const staleTmp = join(packsDir, 'test-pack.tmp');
    mkdirSync(staleTmp, { recursive: true });
    writeFileSync(join(staleTmp, 'stale-file.txt'), 'stale', 'utf-8');

    const rulePath = writeRule('x', 'body');
    const canonical = makeCanonical({
      rules: [
        {
          source: rulePath,
          root: false,
          targets: [],
          description: 'x',
          globs: [],
          body: 'body',
        },
      ],
    });

    await materializePack(packsDir, 'test-pack', canonical, {
      ...BASE_META,
      features: ['rules'],
    });

    // stale .tmp should be gone, final pack should exist
    expect(existsSync(staleTmp)).toBe(false);
    expect(existsSync(join(packsDir, 'test-pack'))).toBe(true);
  });

  it('does not create subdirs for features with no resources', async () => {
    const rulePath = writeRule('x', 'body');
    const canonical = makeCanonical({
      rules: [
        {
          source: rulePath,
          root: false,
          targets: [],
          description: 'x',
          globs: [],
          body: 'body',
        },
      ],
    });

    await materializePack(packsDir, 'test-pack', canonical, {
      ...BASE_META,
      features: ['rules'],
    });

    expect(existsSync(join(packsDir, 'test-pack', 'commands'))).toBe(false);
    expect(existsSync(join(packsDir, 'test-pack', 'agents'))).toBe(false);
    expect(existsSync(join(packsDir, 'test-pack', 'skills'))).toBe(false);
  });
});
