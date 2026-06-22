import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from '../../src/cli/commands/init.js';
import type { Prompter } from '../../src/cli/prompts/prompter.js';

const TEST_DIR = join(tmpdir(), 'am-init-wizard-int');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

// Declines import/lessons/generate (all confirms → false); selects the given targets.
function scripted(targets: string[]): Prompter {
  return {
    intro: () => {},
    outro: () => {},
    note: () => {},
    cancel: () => {},
    isCancel: () => false,
    confirm: async () => false,
    multiselect: async () => targets,
  };
}

describe('runInit with injected prompter (interactive path)', () => {
  it('runs the wizard and writes only the chosen targets', async () => {
    const result = await runInit(
      TEST_DIR,
      {},
      { prompter: scripted(['claude-code', 'gemini-cli']) },
    );
    expect(result.exitCode).toBe(0);
    const config = readFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'utf-8');
    expect(config).toContain('- claude-code');
    expect(config).toContain('- gemini-cli');
    expect(config).not.toContain('- cursor');
  });

  it('ignores the prompter and uses the default path when --yes is set', async () => {
    const result = await runInit(TEST_DIR, { yes: true }, { prompter: scripted(['claude-code']) });
    expect(result.exitCode).toBe(0);
    const config = readFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'utf-8');
    // --yes bypasses the wizard → starter target set (includes cursor), not the scripted single target.
    expect(config).toContain('- cursor');
  });

  it('runs the wizard in global scope and writes the selected global target', async () => {
    const homeDir = join(TEST_DIR, 'home');
    mkdirSync(homeDir, { recursive: true });
    vi.stubEnv('HOME', homeDir);
    vi.stubEnv('USERPROFILE', homeDir);
    const result = await runInit(
      join(TEST_DIR, 'ws'),
      { global: true },
      { prompter: scripted(['claude-code']) },
    );
    expect(result.data.scope).toBe('global');
    const config = readFileSync(join(homeDir, '.agentsmesh', 'agentsmesh.yaml'), 'utf-8');
    expect(config).toContain('- claude-code');
  });
});

describe('lessons is never available in global mode', () => {
  it('rejects --global --lessons (CLI-level guard)', async () => {
    await expect(runInit(join(TEST_DIR, 'ws'), { global: true, lessons: true })).rejects.toThrow(
      /project-mode only/i,
    );
  });

  it('enters the wizard in global scope but never asks about lessons / scaffolds none', async () => {
    const homeDir = join(TEST_DIR, 'home');
    mkdirSync(homeDir, { recursive: true });
    vi.stubEnv('HOME', homeDir);
    vi.stubEnv('USERPROFILE', homeDir);

    let multiselectCalled = false;
    const asked: string[] = [];
    const spy: Prompter = {
      intro: () => {},
      outro: () => {},
      note: () => {},
      cancel: () => {},
      isCancel: () => false,
      confirm: async ({ message }) => {
        asked.push(message);
        return false;
      },
      multiselect: async () => {
        multiselectCalled = true;
        return ['claude-code'];
      },
    };

    const result = await runInit(join(TEST_DIR, 'ws'), { global: true }, { prompter: spy });

    expect(result.data.scope).toBe('global');
    expect(multiselectCalled).toBe(true); // the wizard WAS entered in global scope
    expect(asked.some((m) => m.startsWith('Enable Lessons'))).toBe(false); // lessons never offered
    expect(existsSync(join(homeDir, '.agentsmesh', 'lessons', 'lessons.json'))).toBe(false);
  });
});
