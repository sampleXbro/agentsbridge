/**
 * Integration: `agentsmesh installs list` against the live install pipeline.
 *
 * Drives the full install -> list -> uninstall -> list loop:
 *   1. Empty project -> list returns zero rows.
 *   2. After installing a pack -> list shows the entry with
 *      `installed_at` + `source_type` hydrated from the pack manifest.
 *   3. After uninstalling -> list returns zero rows again.
 *
 * Verifies forward-slash `pack_path` per the project CLI display rule.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';
import { runInstalls } from '../../src/cli/commands/installs.js';

const ROOT = join(tmpdir(), 'am-installs-list-integration');

function buildUpstream(upstream: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(can, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: body\n---\n# demo\n',
  );
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

describe('installs list (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('reflects install and uninstall lifecycle round-trip', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    const before = await runInstalls({}, ['list'], project);
    expect(before.exitCode).toBe(0);
    expect(before.data.installs).toEqual([]);

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const after = await runInstalls({}, ['list'], project);
    expect(after.exitCode).toBe(0);
    expect(after.data.installs.map((r) => r.name)).toEqual(['demo-pack']);
    expect(after.data.installs[0]?.pack_path).toBe('.agentsmesh/packs/demo-pack');
    expect(after.data.installs[0]?.installed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Local upstream has `.agentsmesh/` at root, so the classifier reports
    // canonical-agentsmesh; the install manifest persists that verdict.
    expect(after.data.installs[0]?.source_type).toBe('canonical-agentsmesh');

    await runUninstall({ force: true }, ['demo-pack'], project);

    const final = await runInstalls({}, ['list'], project);
    expect(final.exitCode).toBe(0);
    expect(final.data.installs).toEqual([]);
  });
});
