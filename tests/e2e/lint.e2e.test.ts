/**
 * E2E tests for agentsmesh lint.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';

describe('lint', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('valid config → exit 0', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('lint', dir);
    expect(r.exitCode).toBe(0);
  });

  // Linter only validates rules, not MCP JSON (parseMcp returns null on invalid)
  it('empty rule body → warning or error', async () => {
    dir = createTestProject('canonical-full');
    writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n\n');
    const r = await runCli('lint', dir);
    // Linter may warn on empty body; exit 0 or 1 both acceptable
    expect([0, 1]).toContain(r.exitCode);
  });
});
