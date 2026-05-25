/**
 * Regression: claude-code skill importer must skip SKILL.md files with
 * invalid YAML frontmatter, not abort the whole install.
 *
 * Real-world repro: `agentsmesh install github:christianestay/claude-code-base-project`.
 * One of the SKILL.md files contains an unquoted scalar with an embedded
 * colon (`argument-hint: mensaje del commit (ej. feat: add auth system)`),
 * which the YAML 1.2 parser interprets as a compact-mapping nested key
 * and rejects. Before the lenient fix, the entire install aborted before
 * any skill was staged.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { listRelativeFiles } from '../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'am-install-broken-skill-frontmatter');

const BAD_SKILL = [
  '---',
  'name: commit',
  'description: Commit con auto-bump.',
  // Unquoted scalar with embedded colon — YAML compact-mapping error.
  'argument-hint: mensaje del commit (ej. feat: add auth system)',
  '---',
  '',
  '# commit',
  'Body.',
].join('\n');

const GOOD_SKILL = (name: string): string =>
  ['---', `name: ${name}`, `description: ${name} skill.`, '---', '', `# ${name}`, 'Body.'].join(
    '\n',
  );

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('install claude-code skills with invalid frontmatter (integration)', () => {
  it('skips a SKILL.md with broken YAML and installs the rest', async () => {
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');

    // Native claude-code layout: root CLAUDE.md is the unique detection
    // marker; skills live under .claude/skills/<name>/SKILL.md.
    mkdirSync(join(upstream, '.claude', 'skills', 'commit'), { recursive: true });
    mkdirSync(join(upstream, '.claude', 'skills', 'research'), { recursive: true });
    mkdirSync(join(upstream, '.claude', 'skills', 'status'), { recursive: true });
    writeFileSync(join(upstream, 'CLAUDE.md'), '---\nroot: true\n---\n# Project rules\n');
    writeFileSync(join(upstream, '.claude', 'skills', 'commit', 'SKILL.md'), BAD_SKILL);
    writeFileSync(
      join(upstream, '.claude', 'skills', 'research', 'SKILL.md'),
      GOOD_SKILL('research'),
    );
    writeFileSync(join(upstream, '.claude', 'skills', 'status', 'SKILL.md'), GOOD_SKILL('status'));

    mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(project, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
    );
    writeFileSync(
      join(project, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );

    await expect(runInstall({ force: true }, [upstream], project)).resolves.toBeDefined();

    const generated = listRelativeFiles(join(project, '.claude'));
    expect(generated).toContain('skills/research/SKILL.md');
    expect(generated).toContain('skills/status/SKILL.md');
    // Broken skill must NOT appear in the install output.
    expect(generated).not.toContain('skills/commit/SKILL.md');
  });
});
