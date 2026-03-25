import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { fileExists, fileNotExists } from './helpers/assertions.js';

describe('generate --check', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('exits 1 when files would be created and writes nothing', async () => {
    dir = createTestProject('canonical-full');

    const result = await runCli('generate --check', dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr + result.stdout).toMatch(/out of sync|generate --check|would change/i);
    fileNotExists(join(dir, '.claude', 'CLAUDE.md'));
  });

  it('exits 0 when generated files are in sync', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    const result = await runCli('generate --check', dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/in sync|unchanged|up to date/i);
  });

  it('exits 1 and does not rewrite drifted files', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    mkdirSync(join(dir, '.claude'), { recursive: true });
    const claudePath = join(dir, '.claude', 'CLAUDE.md');
    writeFileSync(claudePath, '# Drifted output\n');

    const result = await runCli('generate --check', dir);

    expect(result.exitCode).toBe(1);
    expect(readFileSync(claudePath, 'utf-8')).toBe('# Drifted output\n');
  });
});
