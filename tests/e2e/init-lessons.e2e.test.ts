/**
 * E2E: `agentsmesh init --lessons` against the real CLI binary.
 *
 * The lessons ritual is canonical content wrapped in managed-block sentinels
 * (`<!-- agentsmesh:lessons-contract:start -->`). init injects it into
 * `.agentsmesh/rules/_root.md` and creates `lessons.json`; generate then
 * projects the block to every target.
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
  it('fresh init + lessons in one shot; ritual block lands in canonical _root.md', async () => {
    const result = await runCli('init --lessons', tempDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created agentsmesh.yaml');
    expect(result.stdout).toContain('Lessons subsystem ready');

    expect(existsSync(join(tempDir, 'agentsmesh.yaml'))).toBe(true);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons/lessons.json'))).toBe(true);

    const rootRule = readFileSync(join(tempDir, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('<!-- agentsmesh:lessons-contract:start -->');
    expect(rootRule).toContain('**Recall');
    expect(rootRule).toContain('**Capture');
  });

  it('generate projects the lessons block into the target root file', async () => {
    await runCli('init --lessons', tempDir);
    const gen = await runCli('generate --targets claude-code', tempDir);
    expect(gen.exitCode).toBe(0);

    const claude = readFileSync(join(tempDir, '.claude/CLAUDE.md'), 'utf8');
    expect(claude).toContain('<!-- agentsmesh:lessons-contract:start -->');
    expect(claude).toContain('agentsmesh lessons query');
  });

  it('retrofits lessons onto an already-initialized project', async () => {
    const first = await runCli('init', tempDir);
    expect(first.exitCode).toBe(0);
    expect(existsSync(join(tempDir, '.agentsmesh/lessons'))).toBe(false);

    const second = await runCli('init --lessons', tempDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('Lessons subsystem ready');

    expect(existsSync(join(tempDir, '.agentsmesh/lessons/lessons.json'))).toBe(true);
    const rootRule = readFileSync(join(tempDir, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('<!-- agentsmesh:lessons-contract:start -->');
  });

  it('is idempotent — re-running --lessons does not duplicate the block', async () => {
    await runCli('init --lessons', tempDir);
    const second = await runCli('init --lessons', tempDir);
    expect(second.exitCode).toBe(0);

    const rootRule = readFileSync(join(tempDir, '.agentsmesh/rules/_root.md'), 'utf8');
    const starts = rootRule.match(/<!-- agentsmesh:lessons-contract:start -->/g) ?? [];
    expect(starts.length).toBe(1);
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
