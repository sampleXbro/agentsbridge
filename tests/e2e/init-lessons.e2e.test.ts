/**
 * E2E: `agentsmesh init --lessons` against the real CLI binary.
 *
 * Exercises the full path users hit: argv parse → runInit → renderInit, with
 * `dist/cli.js` as the executor. Covers the three flows:
 *   - fresh init + lessons (one shot)
 *   - lessons-only retrofit on an existing init
 *   - idempotent re-run
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'am-init-lessons-e2e-'));
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
});

describe('agentsmesh init --lessons (e2e)', () => {
  it('fresh init + lessons in one shot', async () => {
    const result = await runCli('init --lessons', tempDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created agentsmesh.yaml');
    expect(result.stdout).toContain('Lessons subsystem ready');

    expect(existsSync(join(tempDir, 'agentsmesh.yaml'))).toBe(true);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons/journal.md'))).toBe(true);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons/index.yaml'))).toBe(true);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons/topics'))).toBe(true);

    const rootRule = readFileSync(join(tempDir, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('## Lessons (mandatory)');
    expect(rootRule).toContain('**Recall**');
    expect(rootRule).toContain('**Capture**');
  });

  it('retrofits lessons onto an already-initialized project', async () => {
    const first = await runCli('init', tempDir);
    expect(first.exitCode).toBe(0);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons'))).toBe(false);

    const second = await runCli('init --lessons', tempDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('Lessons subsystem ready');
    expect(second.stdout).toContain("Run 'agentsmesh generate'");

    expect(existsSync(join(tempDir, '.agentsmesh/lessons/journal.md'))).toBe(true);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons/index.yaml'))).toBe(true);
  });

  it('is idempotent — re-running --lessons does not duplicate the procedural paragraph', async () => {
    await runCli('init --lessons', tempDir);
    const second = await runCli('init --lessons', tempDir);

    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('already contains the Lessons paragraph');

    const rootRule = readFileSync(join(tempDir, '.agentsmesh/rules/_root.md'), 'utf8');
    const occurrences = rootRule.match(/## Lessons \(mandatory\)/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('errors when --lessons is combined with --global', async () => {
    const result = await runCli('init --lessons --global', tempDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/project-mode only/i);
  });

  it('still errors on bare init when project is already initialized', async () => {
    await runCli('init', tempDir);
    const second = await runCli('init', tempDir);
    expect(second.exitCode).not.toBe(0);
    expect(second.stderr + second.stdout).toMatch(/Already initialized/i);
  });
});
