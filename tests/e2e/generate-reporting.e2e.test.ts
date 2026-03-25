import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { fileContains } from './helpers/assertions.js';

describe('generate reporting', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('prints the compatibility matrix after generate', async () => {
    dir = createTestProject('canonical-full');

    const result = await runCli('generate', dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Feature');
    expect(result.stdout).toMatch(/claude-code|cursor|copilot|windsurf/i);
    fileContains(join(dir, '.claude', 'CLAUDE.md'), 'TypeScript strict');
  });
});
