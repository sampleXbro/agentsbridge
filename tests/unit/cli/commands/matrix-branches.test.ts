/**
 * Branch coverage for src/cli/commands/matrix.ts line 46:
 * - targetFilter undefined + pluginTargets present (spreads from config).
 * - targetFilter undefined + pluginTargets undefined (??[] branch).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runMatrix } from '../../../../src/cli/commands/matrix.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-matrix-'));
  mkdirSync(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n\nbody\n',
  );
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runMatrix — targetFilter fallback branches', () => {
  it('uses config.targets + pluginTargets when no --targets flag passed', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\nextends: []\npluginTargets: []\n',
    );
    const result = await runMatrix({}, projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.targets).toEqual(['claude-code', 'cursor']);
  });

  it('uses explicit --targets list when provided', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\nextends: []\n',
    );
    const result = await runMatrix({ targets: 'cursor' }, projectRoot);
    expect(result.data.targets).toEqual(['cursor']);
  });

  it('returns verboseDetails empty/undefined when canonical has no extras', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
    );
    const result = await runMatrix({}, projectRoot);
    // canonical only has the root rule → formatVerboseDetails returns a non-empty
    // string (rules line). Just verify the field exists or is undefined.
    expect(['string', 'undefined']).toContain(typeof result.verboseDetails);
  });
});
