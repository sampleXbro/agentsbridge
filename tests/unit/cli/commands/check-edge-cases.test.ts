/**
 * Senior-QA edge-case coverage for `runCheck`. Complements `check.test.ts`
 * by exercising scenarios the existing suite does not pin:
 *   - all drift buckets reported in one invocation (output formatting)
 *   - `[LOCKED]` annotation on added and removed paths (not just modified)
 *   - lock from a previous version (pre-`packs` field) loads cleanly
 *   - malformed YAML lock is treated as missing (returns 1, not throws)
 *   - check with --global on a workspace without ~/.agentsmesh fails clearly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCheck } from '../../../../src/cli/commands/check.js';

const TEST_DIR = join(tmpdir(), 'am-check-edge-' + String(process.pid));

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function captureStderr(): { read: () => string; restore: () => void } {
  let out = '';
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    out += String(chunk);
    return true;
  };
  return {
    read: () => out,
    restore: () => {
      process.stderr.write = original;
    },
  };
}

describe('runCheck — multi-drift output formatting', () => {
  it('reports modified, added, removed, AND extendsModified in one pass with [LOCKED] suffix on locked items only', async () => {
    process.env.NO_COLOR = '1';
    const baseDir = join(TEST_DIR, 'shared-base');
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(baseDir, '.agentsmesh', 'rules', '_root.md'), '# Base v2');

    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, mcp]
collaboration:
  strategy: lock
  lock_features: [rules]
extends:
  - name: base
    source: ./shared-base
    features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    // Modified: stale lock checksum.
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# changed-rules');
    // Added: present now, not in lock.
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'added.md'), '# added');
    // mcp.json drifts but is NOT a lock_feature.
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), '{"changed":true}');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-04-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:${'0'.repeat(64)}"
  rules/removed.md: "sha256:${'1'.repeat(64)}"
  mcp.json: "sha256:${'2'.repeat(64)}"
extends:
  base: "local:sha256:${'b'.repeat(64)}"
packs: {}
`,
    );

    const cap = captureStderr();
    let exit: number;
    try {
      exit = await runCheck({}, TEST_DIR);
    } finally {
      cap.restore();
      delete process.env.NO_COLOR;
    }

    expect(exit).toBe(1);
    const out = cap.read();
    expect(out).toContain('Conflict detected');
    expect(out).toContain('extend "base" was modified');
    // Locked annotations: rules/* under lock_features.
    expect(out).toContain('rules/_root.md was modified [LOCKED]');
    expect(out).toContain('rules/added.md was added [LOCKED]');
    expect(out).toContain('rules/removed.md was removed [LOCKED]');
    // Non-locked drift remains visible but unannotated.
    expect(out).toMatch(/mcp\.json was modified(?! \[LOCKED\])/);
  });

  it('annotates [LOCKED] on added paths within hooks/permissions lock_features', async () => {
    process.env.NO_COLOR = '1';
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, hooks, permissions]
collaboration:
  strategy: lock
  lock_features: [hooks, permissions]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# stable');
    // permissions.yaml is added relative to lock; lock contains hooks.yaml that no longer exists.
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'allow: []');
    const stableHash = 'sha256:' + 'a'.repeat(64);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-04-01T00:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "${stableHash}"
  hooks.yaml: "sha256:${'9'.repeat(64)}"
extends: {}
packs: {}
`,
    );

    const cap = captureStderr();
    let exit: number;
    try {
      exit = await runCheck({}, TEST_DIR);
    } finally {
      cap.restore();
      delete process.env.NO_COLOR;
    }
    expect(exit).toBe(1);
    const out = cap.read();
    expect(out).toContain('permissions.yaml was added [LOCKED]');
    expect(out).toContain('hooks.yaml was removed [LOCKED]');
  });
});

describe('runCheck — lock format compatibility', () => {
  it('accepts a lock written by a pre-`packs` library version (missing packs field)', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    const body = '# stable';
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), body);
    const { hashContent } = await import('../../../../src/utils/crypto/hash.js');
    const h = 'sha256:' + hashContent(body);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2025-01-01T00:00:00Z"
generated_by: legacy
lib_version: "0.0.5"
checksums:
  rules/_root.md: "${h}"
extends: {}
`, // <- intentionally no `packs:` field
    );
    const exit = await runCheck({}, TEST_DIR);
    expect(exit).toBe(0);
  });

  it('treats a malformed YAML lock as "no lock" and exits 1', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), '# x');
    writeFileSync(join(TEST_DIR, '.agentsmesh', '.lock'), 'this is: not valid: yaml: [unclosed');

    const cap = captureStderr();
    let exit: number;
    try {
      exit = await runCheck({}, TEST_DIR);
    } finally {
      cap.restore();
    }
    expect(exit).toBe(1);
    expect(cap.read()).toContain('Not initialized for collaboration');
  });
});

describe('runCheck — error surfaces', () => {
  it('throws ConfigNotFoundError-shaped error when run with --global without ~/.agentsmesh', async () => {
    const fakeHome = join(TEST_DIR, 'home');
    mkdirSync(fakeHome, { recursive: true });
    vi.stubEnv('HOME', fakeHome);
    vi.stubEnv('USERPROFILE', fakeHome);
    const workspace = join(TEST_DIR, 'workspace');
    mkdirSync(workspace, { recursive: true });

    await expect(runCheck({ global: true }, workspace)).rejects.toThrow(
      /agentsmesh\.yaml not found/i,
    );
  });
});
