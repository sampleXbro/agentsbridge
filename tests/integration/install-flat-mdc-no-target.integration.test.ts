/**
 * Regression: flat `rules/*.mdc` collection whose `.mdc` frontmatter lacks
 * both `alwaysApply` (cursor) and `trigger` (windsurf) keys. `inferMdcTarget`
 * returns `null`, so the picker auto-picks with `target.target = undefined`.
 *
 * Bug: the picker's recursive `runInstall` call coerced the undefined target
 * to `''`, which propagated to `manual-install-discovery` → `installAsPack`
 * → `targetSchema.parse('')` → ZodError ("Invalid option: expected one of …").
 *
 * Real-world repro: `agentsmesh install github:PatrickJS/awesome-cursorrules`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { listRelativeFiles } from '../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'am-install-flat-mdc-no-target');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('install flat .mdc collection without inferable target (integration)', () => {
  it('installs successfully when .mdc frontmatter lacks cursor/windsurf marker keys', async () => {
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');
    mkdirSync(join(upstream, 'rules'), { recursive: true });
    // Frontmatter has neither `alwaysApply` (cursor) nor `trigger` (windsurf).
    writeFileSync(
      join(upstream, 'rules', 'style.mdc'),
      '---\ndescription: Style guide\n---\n# Style\n',
    );
    writeFileSync(
      join(upstream, 'rules', 'review.mdc'),
      '---\ndescription: Review guide\n---\n# Review\n',
    );
    mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(project, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
    );
    writeFileSync(
      join(project, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );

    await expect(runInstall({ force: true }, [upstream], project)).resolves.toBeDefined();

    expect(listRelativeFiles(join(project, '.claude'))).toContain('rules/style.md');
    expect(listRelativeFiles(join(project, '.claude'))).toContain('rules/review.md');
  });
});
