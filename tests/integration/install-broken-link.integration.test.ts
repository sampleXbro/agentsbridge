/**
 * B1 broken-link integration coverage under `--force` (leave-with-warnings).
 *
 * This test exercises the install-time leg of the broken-link path: a skill
 * body links to a file outside the install scope (a `references/` sibling),
 * the prompt is bypassed by `--force`, `apply-decisions` downgrades to
 * leave-with-warnings, and a warning is emitted to the logger. The pack
 * body must keep the original link verbatim (no rewrite, no supportingFile
 * copy).
 *
 * Generate is invoked at the end of every install; its markdown link
 * validator would crash on the dangling link if the skill were emitted to
 * the target tree. The project here selects only the `rules` feature so the
 * skill never reaches a target output, isolating the assertion to the pack
 * write phase. Interactive [i]/[a] paths are covered by unit tests in
 * `tests/unit/install/prompts/broken-link-prompt.test.ts` and by the P14
 * manual e2e checklist.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-install-broken-link-integration');

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

function buildUpstream(upstream: string): void {
  mkdirSync(upstream, { recursive: true });

  // Skill with two broken links: one resolvable-outside, one unresolvable.
  mkdirSync(join(upstream, 'skills', 'with-broken-links'), { recursive: true });
  writeFile(
    join(upstream, 'skills', 'with-broken-links', 'SKILL.md'),
    [
      '---',
      'name: with-broken-links',
      'description: A skill that links outside its scope.',
      '---',
      '# with-broken-links',
      '',
      'See [orchestration patterns](../../references/orchestration-patterns.md) for more.',
      'See [missing reference](../../references/missing.md) for nothing.',
    ].join('\n'),
  );

  // Reference target that exists outside the install scope.
  mkdirSync(join(upstream, 'references'), { recursive: true });
  writeFile(
    join(upstream, 'references', 'orchestration-patterns.md'),
    '# Orchestration patterns\n',
  );

  // Agent file is required so the skill-pack signal sum crosses the
  // classifier threshold (skill-pack-layout 1.0 + agents-dir 0.4 = 1.4).
  mkdirSync(join(upstream, 'agents'), { recursive: true });
  writeFile(
    join(upstream, 'agents', 'helper.md'),
    '---\nname: helper\ndescription: helper agent\n---\n# helper\n',
  );

  // Multi-tool rule files at root push the score further.
  writeFile(join(upstream, 'CLAUDE.md'), '# Claude\n');
  writeFile(join(upstream, 'AGENTS.md'), '# Agents\n');
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  // Only `rules` is enabled so the broken-linked skill never reaches a
  // generated target file (the target-side markdown link validator is
  // strict and would crash on dangling links).
  writeFile(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
  writeFile(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

interface InstallManifest {
  readonly source_type: string | null;
  readonly files: Readonly<Record<string, string>>;
}

describe('install broken-link (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('under --force, leaves broken links unchanged in the pack body', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'pack-bl' }, [upstream], project);

    // Pack body keeps both link destinations verbatim — no rewrite, no copy.
    const packDir = join(project, '.agentsmesh', 'packs', 'pack-bl');
    expect(readdirSync(packDir).sort()).toEqual([
      INSTALL_MANIFEST_FILENAME,
      'agents',
      'pack.yaml',
      'skills',
    ]);
    const skillBody = readFileSync(
      join(packDir, 'skills', 'with-broken-links', 'SKILL.md'),
      'utf-8',
    );
    expect(skillBody).toContain('../../references/orchestration-patterns.md');
    expect(skillBody).toContain('../../references/missing.md');

    // No supportingFiles directory created (include-resolvable not chosen).
    expect(existsSync(join(packDir, 'skills', 'with-broken-links', 'references'))).toBe(false);

    // Pack manifest records the skill-pack source_type and exactly the two
    // entity files (no references/ copy).
    const manifest = JSON.parse(
      readFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), 'utf-8'),
    ) as InstallManifest;
    expect(manifest.source_type).toBe('anthropic-skill-pack');
    expect(Object.keys(manifest.files).sort()).toEqual([
      'agents/helper.md',
      'skills/with-broken-links/SKILL.md',
    ]);
  });
});
