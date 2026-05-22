/**
 * Smoke coverage for the `agentsmesh uninstall` CLI wrapper in
 * `src/cli/commands/uninstall.ts`. The wrapper is a single delegation to
 * `runUninstall` in `src/install/uninstall/run-uninstall.ts`; this test
 * proves the indirection wires through without altering the result shape.
 *
 * End-to-end uninstall behavior is owned by the integration suite under
 * `tests/integration/uninstall-*`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runUninstall } from '../../../../src/cli/commands/uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-dispatcher');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(join(ROOT, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(ROOT, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
  writeFileSync(join(ROOT, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('runUninstall dispatcher wrapper', () => {
  it('delegates to runUninstallCore and returns its result shape', async () => {
    const result = await runUninstall({}, ['no-such-pack'], ROOT);
    // Wrapper preserves the core's exitCode / data envelope; the specific
    // behavior on a missing pack is owned by integration tests — we just
    // assert that the wrapper does not mutate or hide the result.
    expect(result).toBeDefined();
    expect(typeof result.exitCode).toBe('number');
    expect(result.data).toBeDefined();
  });
});
