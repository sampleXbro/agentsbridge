import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from './helpers/run-cli.js';

const TARGETS = [
  'claude-code',
  'cursor',
  'copilot',
  'continue',
  'junie',
  'kiro',
  'gemini-cli',
  'cline',
  'codex-cli',
  'windsurf',
] as const;

const REAL_FIXTURES_DIR = join(process.cwd(), 'tests', 'e2e', 'fixtures-real');

function makeDir(target: string): string {
  return join(
    tmpdir(),
    `am-e2e-real-${target}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

describe('real export smoke lane', () => {
  let dir = '';

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it.each(TARGETS)('imports real validated %s fixture when present', async (target) => {
    const fixtureDir = join(REAL_FIXTURES_DIR, target);
    if (!existsSync(fixtureDir)) {
      return;
    }

    dir = makeDir(target);
    mkdirSync(dir, { recursive: true });
    cpSync(fixtureDir, dir, { recursive: true });

    const result = await runCli(`import --from ${target}`, dir);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(existsSync(join(dir, '.agentsmesh'))).toBe(true);
    expect(readdirSync(join(dir, '.agentsmesh')).length).toBeGreaterThan(0);
  });
});
