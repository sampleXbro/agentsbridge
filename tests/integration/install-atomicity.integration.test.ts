/**
 * Integration test for install pack atomicity.
 *
 * Verifies the plan's "staging-dir + rename" contract:
 *  - Happy path: final pack dir present, no stale `.tmp` dir left behind,
 *    `.agentsmesh-install-manifest.json` written with per-file sha256 hashes.
 *  - FS error mid-write: staging dir is cleaned up; no partial pack dir
 *    appears at the final destination.
 *
 * Drives `materializePack` directly (no CLI spawn) — the contract under test
 * lives in pack-writer.ts, not in the orchestration above it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { materializePack } from '../../src/install/pack/pack-writer.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';
import type { CanonicalFiles } from '../../src/core/types.js';

let TEST_DIR: string;
let srcDir: string;
let packsDir: string;

const BASE_META = {
  name: 'atomic-pack',
  source: 'github:org/repo@abc123',
  version: 'abc123',
  source_kind: 'github' as const,
  installed_at: '2026-05-16T10:00:00Z',
  updated_at: '2026-05-16T10:00:00Z',
  features: ['rules', 'skills'] as ('rules' | 'skills' | 'commands' | 'agents')[],
};

function writeRule(name: string, body: string): string {
  const dir = join(srcDir, 'rules');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.md`);
  writeFileSync(path, `---\nroot: false\ndescription: ${name}\n---\n\n${body}`, 'utf-8');
  return path;
}

function writeSkill(name: string, body: string): { skillPath: string; supportPath: string } {
  const dir = join(srcDir, 'skills', name);
  mkdirSync(dir, { recursive: true });
  const skillPath = join(dir, 'SKILL.md');
  const supportPath = join(dir, 'checklist.md');
  writeFileSync(skillPath, `---\ndescription: ${name}\n---\n\n${body}`, 'utf-8');
  writeFileSync(supportPath, `# ${name} checklist\n`, 'utf-8');
  return { skillPath, supportPath };
}

function makeCanonical(): CanonicalFiles {
  const rulePath = writeRule('security', 'Use HTTPS.');
  const { skillPath, supportPath } = writeSkill('tdd', 'Tests first.');
  return {
    rules: [
      {
        source: rulePath,
        root: false,
        targets: [],
        description: 'security',
        globs: [],
        body: 'Use HTTPS.',
      },
    ],
    commands: [],
    agents: [],
    skills: [
      {
        source: skillPath,
        name: 'tdd',
        description: 'tdd skill',
        body: 'Tests first.',
        supportingFiles: [
          {
            relativePath: 'checklist.md',
            absolutePath: supportPath,
            content: '# tdd checklist\n',
          },
        ],
      },
    ],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

beforeEach(() => {
  TEST_DIR = join(tmpdir(), `am-install-atomicity-${process.pid}-${Date.now()}`);
  srcDir = join(TEST_DIR, 'src');
  packsDir = join(TEST_DIR, 'packs');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(packsDir, { recursive: true });
});

afterEach(async () => {
  // Restore permissions in case a test left a read-only dir.
  try {
    await chmod(packsDir, 0o755);
  } catch {
    /* best-effort */
  }
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('install pack atomicity (integration)', () => {
  it('happy path writes pack dir, install manifest, and leaves no staging dir', async () => {
    const canonical = makeCanonical();

    const meta = await materializePack(packsDir, 'atomic-pack', canonical, BASE_META);

    expect(meta.name).toBe('atomic-pack');
    const packDir = join(packsDir, 'atomic-pack');
    expect(existsSync(packDir)).toBe(true);

    // No leftover staging dir.
    const siblings = readdirSync(packsDir);
    expect(siblings).toEqual(['atomic-pack']);

    // Manifest landed alongside pack content.
    const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string;
      source: string;
      installed_at: string;
      source_type: string | null;
      extends_id: string | null;
      files: Record<string, string>;
    };
    expect(manifest.name).toBe('atomic-pack');
    expect(manifest.source).toBe('github:org/repo@abc123');
    expect(manifest.installed_at).toBe('2026-05-16T10:00:00Z');
    expect(manifest.extends_id).toBeNull();
    // `source_type` defaults to null when not supplied; classifier-aware
    // pipeline will pass an explicit value during P8.3+.
    expect(manifest.source_type).toBeNull();
    expect(Object.keys(manifest.files).sort()).toEqual([
      'rules/security.md',
      'skills/tdd/SKILL.md',
      'skills/tdd/checklist.md',
    ]);
    for (const value of Object.values(manifest.files)) {
      expect(value).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    // pack.yaml and the manifest itself are excluded from the file map.
    expect(manifest.files['pack.yaml']).toBeUndefined();
    expect(manifest.files[INSTALL_MANIFEST_FILENAME]).toBeUndefined();
  });

  it('cleans up staging dir and writes nothing final when materialization fails mid-write', async () => {
    // Build a canonical that points one rule at a path that does not exist on
    // disk. `copyFile` will throw ENOENT during the staging-write step, after
    // the staging directory itself has already been created. The staging dir
    // must be cleaned up so subsequent operations cannot see a half-written
    // pack, and no final pack dir must appear at the destination.
    const canonical: CanonicalFiles = {
      rules: [
        {
          source: join(srcDir, 'rules', 'missing.md'),
          root: false,
          targets: [],
          description: 'missing rule',
          globs: [],
          body: 'missing',
        },
      ],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };

    await expect(materializePack(packsDir, 'atomic-pack', canonical, BASE_META)).rejects.toThrow(
      /ENOENT/,
    );

    expect(existsSync(join(packsDir, 'atomic-pack'))).toBe(false);
    const siblings = readdirSync(packsDir);
    expect(siblings).toEqual([]);
  });
});
