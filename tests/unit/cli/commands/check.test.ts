/**
 * Unit tests for agentsmesh check command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashContent } from '../../../../src/utils/crypto/hash.js';
import { runCheck } from '../../../../src/cli/commands/check.js';

/** Lock body with an in-sync canonical `_root.md` plus a caller-supplied outputs block. */
function lockWithOutputs(rootBody: string, outputsBlock: string): string {
  const h = 'sha256:' + hashContent(rootBody);
  return `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "${h}"
extends: {}
${outputsBlock}`;
}

const TEST_DIR = join(tmpdir(), 'am-check-test');

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runCheck', () => {
  it('returns 0 when checksums match', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    const body = '# Rules';
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), body);
    const h = 'sha256:' + hashContent(body);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "${h}"
extends: {}
`,
    );
    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.data.hasLock).toBe(true);
    expect(result.data.inSync).toBe(true);
    // Old-format lock (no outputs map) → verification is skipped.
    expect(result.data.outputsChecked).toBe(false);
    expect(result.data.outputsModified).toEqual([]);
    expect(result.data.outputsRemoved).toEqual([]);
  });

  it('returns exitCode 1 when lock is missing', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# Rules');
    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.hasLock).toBe(false);
    expect(result.data.inSync).toBe(false);
    expect(result.data.outputsChecked).toBe(false);
    expect(result.data.outputsModified).toEqual([]);
    expect(result.data.outputsRemoved).toEqual([]);
  });

  it('returns exitCode 1 when checksums mismatch', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# Modified');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
extends: {}
`,
    );
    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.hasLock).toBe(true);
    expect(result.data.inSync).toBe(false);
    expect(result.data.modified).toContain('rules/_root.md');
  });

  it('returns exitCode 1 when new file added (not in lock)', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# Rules');
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'new.md'), '# New');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
extends: {}
`,
    );
    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.added).toContain('rules/new.md');
  });

  it('returns exitCode 1 when extend checksum has changed (extendModified path)', async () => {
    const baseDir = join(TEST_DIR, 'base-config');
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(baseDir, '.agentsmesh', 'rules', '_root.md'), '# Base');
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends:\n  - name: base\n    source: ./base-config\n    features: [rules]\n`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# Local');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"\ngenerated_by: test\nlib_version: "0.1.0"\nchecksums:\n  rules/_root.md: "sha256:${'a'.repeat(64)}"\nextends:\n  base: "sha256:${'b'.repeat(64)}"\n`,
    );
    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.extendsModified.length).toBeGreaterThan(0);
  });

  it('returns exitCode 1 when file removed from canonical', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# Rules');
    const h = 'sha256:' + 'a'.repeat(64);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "${h}"
  rules/removed.md: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
extends: {}
`,
    );
    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.removed).toContain('rules/removed.md');
  });

  it('includes lockedViolations in data when locked features are modified', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# Modified');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:${'0'.repeat(64)}"
extends: {}
packs: {}
`,
    );

    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.lockedViolations).toContain('rules/_root.md');
    expect(result.data.modified).toContain('rules/_root.md');
  });

  it('returns exitCode 1 with exact output drift when a generated file is hand-edited', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    const body = '# Rules';
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), body);
    // AGENTS.md exists on disk but its content no longer matches the locked hash.
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# hand-edited');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      lockWithOutputs(
        body,
        `packs: {}
outputs:
  AGENTS.md: "sha256:${'0'.repeat(64)}"
  .cursor/rules/_root.mdc: "sha256:${'1'.repeat(64)}"
`,
      ),
    );

    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.inSync).toBe(false);
    expect(result.data.outputsChecked).toBe(true);
    expect(result.data.outputsModified).toEqual(['AGENTS.md']);
    // Locked-but-absent output is reported as removed.
    expect(result.data.outputsRemoved).toEqual(['.cursor/rules/_root.mdc']);
  });

  it('returns exitCode 0 and outputsChecked:false for an old-format lock (no outputs map)', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    const body = '# Rules';
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), body);
    // A drifted AGENTS.md must NOT fail an old-format lock — it isn't tracked.
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# hand-edited');
    writeFileSync(join(TEST_DIR, '.agentsmesh', '.lock'), lockWithOutputs(body, ''));

    const result = await runCheck({}, TEST_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.data.inSync).toBe(true);
    expect(result.data.outputsChecked).toBe(false);
    expect(result.data.outputsModified).toEqual([]);
    expect(result.data.outputsRemoved).toEqual([]);
  });

  it('skips output verification and returns exitCode 0 with --no-outputs despite drift', async () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    const body = '# Rules';
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), body);
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# hand-edited');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      lockWithOutputs(
        body,
        `packs: {}
outputs:
  AGENTS.md: "sha256:${'0'.repeat(64)}"
`,
      ),
    );

    const result = await runCheck({ 'no-outputs': true }, TEST_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.data.inSync).toBe(true);
    expect(result.data.outputsChecked).toBe(false);
    expect(result.data.outputsModified).toEqual([]);
    expect(result.data.outputsRemoved).toEqual([]);
  });

  it('reads ~/.agentsmesh/.lock when --global is set', async () => {
    vi.stubEnv('HOME', TEST_DIR);
    vi.stubEnv('USERPROFILE', TEST_DIR);
    const workspace = `${TEST_DIR}-workspace`;
    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(workspace, { recursive: true });

    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const body = '# Global Rules';
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), body);
    const h = 'sha256:' + hashContent(body);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-01-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "${h}"
extends: {}
packs: {}
`,
    );

    const result = await runCheck({ global: true }, workspace);
    expect(result.exitCode).toBe(0);
    expect(result.data.hasLock).toBe(true);
    expect(result.data.inSync).toBe(true);
  });
});
