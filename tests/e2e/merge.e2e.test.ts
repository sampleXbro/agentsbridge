/**
 * E2E tests for agentsbridge merge.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';

describe('merge', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('no conflict → "No conflicts to resolve"', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const r = await runCli('merge', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/No conflicts/i);
  });

  it('lock conflict → resolves and check passes', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    writeFileSync(
      join(dir, '.agentsbridge', '.lock'),
      `<<<<<<< HEAD
generated_at: "2026-03-12T14:30:00Z"
generated_by: "alice"
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:aaa111"
extends: {}
=======
generated_at: "2026-03-12T15:00:00Z"
generated_by: "bob"
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:bbb222"
extends: {}
>>>>>>> feature
`,
    );
    const r = await runCli('merge', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/resolved|conflict/i);
    const check = await runCli('check', dir);
    expect(check.exitCode).toBe(0);
  });
});
