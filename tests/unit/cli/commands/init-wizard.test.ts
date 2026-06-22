import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveScopeContext } from '../../../../src/config/core/scope.js';
import { runInitWizard, buildTargetOptions } from '../../../../src/cli/commands/init-wizard.js';
import type { MultiselectOptions, Prompter } from '../../../../src/cli/prompts/prompter.js';
import { BUILTIN_TARGET_IDS } from '../../../../src/targets/catalog/target-ids.js';
import {
  starterInitTargetIds,
  globalInitTargetIds,
} from '../../../../src/targets/catalog/init-starter-targets.js';

const TEST_DIR = join(tmpdir(), 'am-init-wizard-test');
const CANCEL = Symbol('cancel');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

interface Scripted {
  import?: boolean | symbol;
  targets?: string[] | symbol;
  lessons?: boolean | symbol;
  generate?: boolean | symbol;
}

function fakePrompter(a: Scripted): Prompter {
  return {
    intro: () => {},
    outro: () => {},
    note: () => {},
    cancel: () => {},
    isCancel: (v) => v === CANCEL,
    confirm: async ({ message }) => {
      if (message.startsWith('Found existing')) return a.import ?? true;
      if (message.startsWith('Enable Lessons')) return a.lessons ?? true;
      if (message.startsWith('Run generate')) return a.generate ?? false;
      throw new Error(`unexpected confirm: ${message}`);
    },
    multiselect: async () => a.targets ?? [],
  };
}

describe('buildTargetOptions', () => {
  it('project: lists every builtin target once, recommended set first then alphabetical', () => {
    const values = buildTargetOptions('project').map((o) => o.value);
    const starter = [...starterInitTargetIds()];
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...BUILTIN_TARGET_IDS].sort());
    expect(values.slice(0, starter.length)).toEqual(starter);
  });

  it('global: only global-capable targets, a strict subset', () => {
    const values = buildTargetOptions('global').map((o) => o.value);
    expect([...values].sort()).toEqual([...globalInitTargetIds()].sort());
    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThan(BUILTIN_TARGET_IDS.length);
  });
});

describe('runInitWizard (project)', () => {
  it('writes config with exactly the selected targets, scaffolds lessons, skips generate', async () => {
    const context = resolveScopeContext(TEST_DIR, 'project');
    const result = await runInitWizard(
      fakePrompter({ targets: ['claude-code', 'cursor'], lessons: true, generate: false }),
      { projectRoot: TEST_DIR, context, detected: [], defaultTargets: undefined },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.cancelled).toBeUndefined();
    const config = readFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'utf-8');
    expect(config).toContain('- claude-code');
    expect(config).toContain('- cursor');
    expect(config).not.toContain('- gemini-cli');
    expect(result.data.scaffoldType).toBe('full');
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'lessons', 'lessons.json'))).toBe(true);
  });

  it('imports detected tools and gap-fills when the user accepts import', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# My Rules\n\nUse TDD.');
    const context = resolveScopeContext(TEST_DIR, 'project');
    const result = await runInitWizard(
      fakePrompter({ import: true, targets: ['claude-code'], lessons: false, generate: false }),
      { projectRoot: TEST_DIR, context, detected: ['claude-code'], defaultTargets: undefined },
    );
    expect(result.data.scaffoldType).toBe('gap-fill');
    const root = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(root).toContain('My Rules');
    expect(result.data.lessons).toBeUndefined();
  });

  it('hints how to add lessons later when the user declines them', async () => {
    const context = resolveScopeContext(TEST_DIR, 'project');
    let note = '';
    const prompter: Prompter = {
      ...fakePrompter({ targets: ['claude-code'], lessons: false, generate: false }),
      note: (message) => {
        note = message;
      },
    };
    await runInitWizard(prompter, {
      projectRoot: TEST_DIR,
      context,
      detected: [],
      defaultTargets: undefined,
    });
    expect(note).toContain('agentsmesh init --lessons');
  });

  it('pre-selects no targets and requires at least one (even when configs are detected)', async () => {
    const context = resolveScopeContext(TEST_DIR, 'project');
    let captured: MultiselectOptions | undefined;
    const prompter: Prompter = {
      ...fakePrompter({ import: true, targets: ['claude-code'], lessons: false, generate: false }),
      multiselect: async (opts) => {
        captured = opts;
        return ['claude-code'];
      },
    };
    await runInitWizard(prompter, {
      projectRoot: TEST_DIR,
      context,
      detected: ['claude-code'],
      defaultTargets: undefined,
    });
    expect(captured?.required).toBe(true);
    expect(captured?.initialValues ?? []).toEqual([]); // nothing pre-checked
  });

  it('cancels cleanly at target selection — nothing written', async () => {
    const context = resolveScopeContext(TEST_DIR, 'project');
    const result = await runInitWizard(fakePrompter({ targets: CANCEL }), {
      projectRoot: TEST_DIR,
      context,
      detected: [],
      defaultTargets: undefined,
    });
    expect(result.data.cancelled).toBe(true);
    expect(existsSync(join(TEST_DIR, 'agentsmesh.yaml'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);
  });
});

describe('runInitWizard (global) — interactive, but no lessons', () => {
  it('restricts to global targets, never asks about lessons, writes home config, scaffolds none', async () => {
    const home = join(TEST_DIR, 'home');
    const workspace = join(TEST_DIR, 'workspace');
    mkdirSync(workspace, { recursive: true });
    const globalDir = join(home, '.agentsmesh');
    const context = {
      scope: 'global' as const,
      rootBase: home,
      configDir: globalDir,
      canonicalDir: globalDir,
    };

    const asked: string[] = [];
    const prompter: Prompter = {
      intro: () => {},
      outro: () => {},
      note: () => {},
      cancel: () => {},
      isCancel: () => false,
      confirm: async ({ message }) => {
        asked.push(message);
        return false; // decline generate (and import, though none is detected)
      },
      multiselect: async () => ['claude-code'],
    };

    const result = await runInitWizard(prompter, {
      projectRoot: workspace,
      context,
      detected: [],
      defaultTargets: [...globalInitTargetIds()],
    });

    expect(result.data.scope).toBe('global');
    expect(asked.some((m) => m.startsWith('Enable Lessons'))).toBe(false);
    expect(result.data.lessons).toBeUndefined();
    const config = readFileSync(join(globalDir, 'agentsmesh.yaml'), 'utf-8');
    expect(config).toContain('- claude-code');
    expect(existsSync(join(workspace, '.agentsmesh', 'lessons', 'lessons.json'))).toBe(false);
    expect(existsSync(join(globalDir, 'lessons', 'lessons.json'))).toBe(false);
  });
});
