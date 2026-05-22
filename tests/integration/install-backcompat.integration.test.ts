/**
 * Backward-compatibility guard: tool-native source repositories must not
 * trip the skill-pack layout detection, and must continue to flow through
 * the existing native importer with the exact same pack outputs.
 *
 * Five representative tool-native fixtures are exercised below. For each:
 *   1. `detectLayout(contentRoot)` returns a layout with NO `skillPack`.
 *   2. `runInstall` succeeds and produces a pack whose
 *      `.agentsmesh-install-manifest.json` matches the expected file set.
 *   3. The pack manifest's `source_type` is never `anthropic-skill-pack`.
 *
 * These five repos cover the most popular agent tools and were chosen for
 * their distinct on-disk shapes (top-level dotdir vs `.github/` subtree).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { detectLayout } from '../../src/install/classify/layout-detect.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-backcompat-integration');

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

function buildProject(project: string, target: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFile(
    project + '/agentsmesh.yaml',
    `version: 1\ntargets: [${target}]\nfeatures: [rules]\nextends: []\n`,
  );
  writeFile(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

interface InstallManifest {
  readonly source_type: string | null;
  readonly files: Readonly<Record<string, string>>;
}

function readManifest(packDir: string): InstallManifest {
  return JSON.parse(
    readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8'),
  ) as InstallManifest;
}

interface BackcompatCase {
  readonly id: string;
  readonly seedTarget: string;
  readonly buildUpstream: (upstream: string) => void;
  readonly expectedFiles: readonly string[];
  readonly extraFlags?: Record<string, string | boolean>;
}

const CASES: readonly BackcompatCase[] = [
  {
    id: 'claude-code',
    seedTarget: 'claude-code',
    buildUpstream: (upstream) => {
      mkdirSync(join(upstream, '.claude', 'rules'), { recursive: true });
      writeFile(join(upstream, '.claude', 'CLAUDE.md'), '---\nroot: true\n---\n# Claude rules\n');
      writeFile(
        join(upstream, '.claude', 'rules', 'style.md'),
        '---\ndescription: Style\n---\n# Style\n',
      );
    },
    expectedFiles: ['rules/_root.md', 'rules/style.md'],
  },
  {
    id: 'cursor',
    seedTarget: 'cursor',
    buildUpstream: (upstream) => {
      mkdirSync(join(upstream, '.cursor', 'rules'), { recursive: true });
      writeFile(
        join(upstream, '.cursor', 'rules', 'style.mdc'),
        '---\ndescription: Cursor style rule\nalwaysApply: false\nglobs:\n  - "src/**/*.ts"\n---\n# Style\n',
      );
    },
    expectedFiles: ['rules/style.md'],
  },
  {
    id: 'gemini-cli',
    seedTarget: 'gemini-cli',
    buildUpstream: (upstream) => {
      mkdirSync(join(upstream, '.gemini'), { recursive: true });
      writeFile(join(upstream, 'GEMINI.md'), '---\nroot: true\n---\n# Gemini root\n');
    },
    expectedFiles: ['rules/_root.md'],
  },
  {
    id: 'codex-cli',
    seedTarget: 'codex-cli',
    buildUpstream: (upstream) => {
      mkdirSync(join(upstream, '.codex'), { recursive: true });
      writeFile(join(upstream, 'AGENTS.md'), '---\nroot: true\n---\n# Codex root\n');
    },
    expectedFiles: ['rules/_root.md'],
  },
  {
    id: 'copilot',
    seedTarget: 'copilot',
    buildUpstream: (upstream) => {
      mkdirSync(join(upstream, '.github', 'instructions'), { recursive: true });
      writeFile(
        join(upstream, '.github', 'instructions', 'review.instructions.md'),
        '---\ndescription: Review instructions\napplyTo: src/**/*.ts\n---\n# Review\n',
      );
    },
    expectedFiles: ['rules/review.md'],
    extraFlags: { path: '.github/instructions' },
  },
];

describe('install backcompat (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  for (const c of CASES) {
    it(`${c.id}: classifier does not fire and pack matches existing path`, async () => {
      const upstream = join(ROOT, c.id, 'upstream');
      const project = join(ROOT, c.id, 'project');
      mkdirSync(upstream, { recursive: true });
      mkdirSync(project, { recursive: true });
      c.buildUpstream(upstream);
      buildProject(project, c.seedTarget);

      const layout = await detectLayout(upstream);
      expect(layout.skillPack).toBeNull();

      const flags: Record<string, string | boolean> = {
        force: true,
        target: c.seedTarget,
        name: `pack-${c.id}`,
        ...(c.extraFlags ?? {}),
      };
      await runInstall(flags, [upstream], project);

      const manifest = readManifest(join(project, '.agentsmesh', 'packs', `pack-${c.id}`));
      expect(manifest.source_type).not.toBe('anthropic-skill-pack');
      expect(Object.keys(manifest.files).sort()).toEqual([...c.expectedFiles].sort());
    });
  }
});
