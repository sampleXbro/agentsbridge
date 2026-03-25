import { describe, it, expect, afterEach } from 'vitest';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';

describe('import CLI', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('requires --from', async () => {
    dir = createTestProject();
    const r = await runCli('import', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--from|required/i);
  });

  it('rejects unknown --from', async () => {
    dir = createTestProject();
    const r = await runCli('import --from fake-tool', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Unknown|Supported|claude-code/i);
  });

  it('import from empty dir prints an informational message', async () => {
    dir = createTestProject();
    const r = await runCli('import --from claude-code', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/No Claude|config found|found/i);
  });
});
