import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveScopeContext } from '../../../../src/config/core/scope.js';
import { runInitWizard, buildTargetOptions } from '../../../../src/cli/commands/init-wizard.js';
import type { Prompter } from '../../../../src/cli/prompts/prompter.js';
import { BUILTIN_TARGET_IDS } from '../../../../src/targets/catalog/target-ids.js';
import { starterInitTargetIds } from '../../../../src/targets/catalog/init-starter-targets.js';

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
  it('lists every builtin target once, starter set first then alphabetical', () => {
    const { options, starter } = buildTargetOptions();
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...BUILTIN_TARGET_IDS].sort());
    expect(values.slice(0, starter.length)).toEqual([...starterInitTargetIds()]);
    expect(starter).toEqual([...starterInitTargetIds()]);
  });
});

describe('runInitWizard', () => {
  it('writes config with exactly the selected targets, scaffolds lessons, skips generate', async () => {
    const context = resolveScopeContext(TEST_DIR, 'project');
    const result = await runInitWizard(
      fakePrompter({ targets: ['claude-code', 'cursor'], lessons: true, generate: false }),
      {
        projectRoot: TEST_DIR,
        context,
        detected: [],
      },
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
      { projectRoot: TEST_DIR, context, detected: ['claude-code'] },
    );
    expect(result.data.scaffoldType).toBe('gap-fill');
    const root = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(root).toContain('My Rules');
    expect(result.data.lessons).toBeUndefined();
  });

  it('cancels cleanly at target selection — nothing written', async () => {
    const context = resolveScopeContext(TEST_DIR, 'project');
    const result = await runInitWizard(fakePrompter({ targets: CANCEL }), {
      projectRoot: TEST_DIR,
      context,
      detected: [],
    });
    expect(result.data.cancelled).toBe(true);
    expect(existsSync(join(TEST_DIR, 'agentsmesh.yaml'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);
  });
});
