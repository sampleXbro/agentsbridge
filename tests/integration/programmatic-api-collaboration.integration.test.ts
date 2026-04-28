/**
 * Senior-QA programmatic API coverage for the team collaboration surface
 * (lock-sync drift detection + diff). Complements
 * `programmatic-api.integration.test.ts` by pinning the report fields and
 * scenarios that the existing suite does not exercise:
 *  - `lockedViolations` exposed alongside modified/added/removed
 *  - `extendsModified` populated from a real local extend
 *  - lock with `packs` field round-trips through `check`
 *  - `diff()` returns deterministic ordering for filtered targets
 *  - public `check()` does not mutate canonical files
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  check,
  diff,
  loadCanonical,
  loadConfig,
  type LockSyncReport,
} from '../../src/public/index.js';
import { writeLock } from '../../src/config/core/lock.js';

const TEST_ROOT = join(tmpdir(), 'am-public-collab-' + String(process.pid));

beforeAll(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });
});
afterAll(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Fixture {
  projectRoot: string;
  canonicalDir: string;
}

function makeProject(name: string, configYaml: string): Fixture {
  const projectRoot = join(TEST_ROOT, name);
  const canonicalDir = join(projectRoot, '.agentsmesh');
  mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
  writeFileSync(join(projectRoot, 'agentsmesh.yaml'), configYaml);
  writeFileSync(
    join(canonicalDir, 'rules', '_root.md'),
    '---\nroot: true\ndescription: "Project rules"\n---\n# Rules\n- Use TypeScript\n',
  );
  return { projectRoot, canonicalDir };
}

describe('public check() — full-shape report', () => {
  it('exposes lockedViolations when collaboration.lock_features fires', async () => {
    const { projectRoot, canonicalDir } = makeProject(
      'check-locked-violations',
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.6.0',
      checksums: {
        'rules/_root.md': 'sha256:' + '0'.repeat(64),
      },
      extends: {},
      packs: {},
    });

    const { config } = await loadConfig(projectRoot);
    const report: LockSyncReport = await check({ config, configDir: projectRoot, canonicalDir });

    expect(report.hasLock).toBe(true);
    expect(report.inSync).toBe(false);
    expect(report.modified).toEqual(['rules/_root.md']);
    expect(report.lockedViolations).toEqual(['rules/_root.md']);
    // Other drift buckets stay empty.
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.extendsModified).toEqual([]);
  });

  it('populates extendsModified for a local extend whose content drifted', async () => {
    const baseDir = join(TEST_ROOT, 'shared-base');
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(baseDir, '.agentsmesh', 'rules', '_root.md'), '# Base v2');

    const { projectRoot, canonicalDir } = makeProject(
      'check-extend-drift',
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ../shared-base
    features: [rules]
`,
    );
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.6.0',
      checksums: {},
      extends: { base: 'local:sha256:' + 'c'.repeat(64) },
      packs: {},
    });

    const { config } = await loadConfig(projectRoot);
    const report = await check({ config, configDir: projectRoot, canonicalDir });

    expect(report.extendsModified).toEqual(['base']);
    expect(report.inSync).toBe(false);
  });

  it('does NOT mutate canonical files when invoked', async () => {
    const { projectRoot, canonicalDir } = makeProject(
      'check-readonly',
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const before = readFileSync(join(canonicalDir, 'rules', '_root.md'), 'utf-8');
    const { config } = await loadConfig(projectRoot);
    await check({ config, configDir: projectRoot, canonicalDir });
    const after = readFileSync(join(canonicalDir, 'rules', '_root.md'), 'utf-8');
    expect(after).toBe(before);
  });

  it('round-trips a lock that contains the packs field (no schema drift)', async () => {
    const { projectRoot, canonicalDir } = makeProject(
      'check-packs-field',
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const { buildChecksums } = await import('../../src/config/core/lock.js');
    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.6.0',
      checksums,
      extends: {},
      packs: { 'team-base': 'sha256:0123456789abcdef' },
    });
    const { config } = await loadConfig(projectRoot);
    const report = await check({ config, configDir: projectRoot, canonicalDir });
    expect(report.inSync).toBe(true);
    expect(report.hasLock).toBe(true);
  });
});

describe('public diff() — multi-result determinism', () => {
  it('returns one diff entry per non-unchanged result, in result order', async () => {
    const { projectRoot } = makeProject(
      'diff-order',
      'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\n',
    );
    const { config } = await loadConfig(projectRoot);
    const canonical = await loadCanonical(projectRoot);

    const result = await diff({ config, canonical, projectRoot, scope: 'project' });

    // Every entry that is neither 'unchanged' nor 'skipped' produces a patch.
    const expectedPatchPaths = result.results
      .filter(
        (r) => r.status === 'created' || (r.status === 'updated' && r.currentContent !== undefined),
      )
      .map((r) => r.path);
    expect(result.diffs.map((d) => d.path)).toEqual(expectedPatchPaths);
    // Counts in summary equal classified results.
    const created = result.results.filter((r) => r.status === 'created').length;
    expect(result.summary.new).toBe(created);
    expect(result.summary.deleted).toBe(0);
  });
});
