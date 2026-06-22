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

// Declines import/lessons/generate (all yes/no steps → 'no'); selects the given targets.
function scripted(targets: string[]): Prompter {
  return {
    intro: () => {},
    outro: () => {},
    note: () => {},
    cancel: () => {},
    isCancel: () => false,
    select: async () => 'no',
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
      select: async ({ message }) => {
        asked.push(message);
        return 'no';
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

describe('already-initialized project', () => {
  // A recording prompter that fails the test if the wizard ever touches it.
  function recordingPrompter(): { prompter: Prompter; wasPrompted: () => boolean } {
    let prompted = false;
    const prompter: Prompter = {
      intro: () => {
        prompted = true;
      },
      outro: () => {},
      note: () => {},
      cancel: () => {},
      isCancel: () => false,
      select: async () => {
        prompted = true;
        return 'no';
      },
      multiselect: async () => {
        prompted = true;
        return ['claude-code'];
      },
    };
    return { prompter, wasPrompted: () => prompted };
  }

  it('throws "Already initialized" without entering the wizard', async () => {
    await runInit(TEST_DIR, {}); // first init creates agentsmesh.yaml + scaffold
    const { prompter, wasPrompted } = recordingPrompter();

    await expect(runInit(TEST_DIR, {}, { prompter })).rejects.toThrow(/already initialized/i);
    expect(wasPrompted()).toBe(false);
  });

  it('--lessons retrofits the lessons subsystem without entering the wizard', async () => {
    await runInit(TEST_DIR, {}); // first init creates the project (incl. rules/_root.md)
    const { prompter, wasPrompted } = recordingPrompter();

    const result = await runInit(TEST_DIR, { lessons: true }, { prompter });

    expect(result.data.lessonsOnly).toBe(true);
    expect(wasPrompted()).toBe(false);
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'lessons', 'lessons.json'))).toBe(true);
  });
});
