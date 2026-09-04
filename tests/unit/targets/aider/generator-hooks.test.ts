import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  clearAiderConf,
  emitAiderConf,
  projectAiderConf,
} from '../../../../src/targets/aider/conf-file.js';
import { generateRules } from '../../../../src/targets/aider/generator.js';
import { AIDER_CONF_FILE, AIDER_CONVENTIONS } from '../../../../src/targets/aider/constants.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

const ROOT_RULE = {
  source: '/proj/.agentsmesh/rules/_root.md',
  root: true,
  targets: [] as string[],
  description: '',
  globs: [] as string[],
  body: 'Use TDD.',
};

const ALL = new Set(['rules', 'hooks']);

describe('emitAiderConf', () => {
  it('writes the mapped hook keys into .aider.conf.yml', () => {
    const outputs = emitAiderConf(
      makeCanonical({
        hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write' }] },
      }),
      'project',
      ALL,
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0].path).toBe(AIDER_CONF_FILE);
    expect(parseYaml(outputs[0].content)).toEqual({
      'lint-cmd': ['prettier --write'],
      'auto-lint': true,
    });
  });

  it('emits the same path in global mode so ~/.aider.conf.yml is written', () => {
    const outputs = emitAiderConf(
      makeCanonical({ hooks: { Notification: [{ matcher: '*', command: 'notify' }] } }),
      'global',
      ALL,
    );
    expect(outputs[0].path).toBe(AIDER_CONF_FILE);
  });

  it('wires read: in project scope and suppresses it in global scope', () => {
    const canonical = makeCanonical({ rules: [ROOT_RULE] });
    expect(projectAiderConf(canonical, 'project', ALL)).toEqual({ read: [AIDER_CONVENTIONS] });
    expect(projectAiderConf(canonical, 'global', ALL)).toEqual({});
  });

  it('skips read: when the rules feature is off or produces no conventions', () => {
    expect(projectAiderConf(makeCanonical({ rules: [ROOT_RULE] }), 'project', new Set())).toEqual(
      {},
    );
    expect(projectAiderConf(makeCanonical(), 'project', ALL)).toEqual({});
  });

  it('skips the hook keys when the hooks feature is off', () => {
    const canonical = makeCanonical({
      hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff' }] },
    });
    expect(projectAiderConf(canonical, 'project', new Set(['rules']))).toEqual({});
  });

  it('emits nothing when there is nothing to write', () => {
    expect(emitAiderConf(makeCanonical(), 'project', ALL)).toEqual([]);
  });
});

describe('clearAiderConf', () => {
  let dir = '';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aider-clear-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('clears the keys agentsmesh marked once the projection is empty', async () => {
    writeFileSync(
      join(dir, AIDER_CONF_FILE),
      'model: gpt-4o\n# agentsmesh: generated\nlint-cmd:\n  - ruff\n',
    );

    const results = await clearAiderConf(makeCanonical(), dir, 'global', new Set(['hooks']));

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AIDER_CONF_FILE);
    expect(results[0].status).toBe('updated');
    expect(parseYaml(results[0].content)).toEqual({ model: 'gpt-4o' });
  });

  it('stays out of the way while the projection still has keys', async () => {
    writeFileSync(join(dir, AIDER_CONF_FILE), '# agentsmesh: generated\nlint-cmd:\n  - ruff\n');
    const canonical = makeCanonical({
      hooks: { Notification: [{ matcher: '*', command: 'notify' }] },
    });
    expect(await clearAiderConf(canonical, dir, 'global', new Set(['hooks']))).toEqual([]);
  });

  it('never creates a config file that does not exist', async () => {
    expect(await clearAiderConf(makeCanonical(), dir, 'global', new Set(['hooks']))).toEqual([]);
  });

  it('leaves a config file that carries no agentsmesh-marked key', async () => {
    writeFileSync(join(dir, AIDER_CONF_FILE), 'lint-cmd:\n  - my own linter\n');
    expect(await clearAiderConf(makeCanonical(), dir, 'global', new Set(['hooks']))).toEqual([]);
  });
});

describe('generateRules (aider)', () => {
  it('emits CONVENTIONS.md only — the read: wiring lives in conf-file', () => {
    expect(generateRules(makeCanonical({ rules: [ROOT_RULE] })).map((r) => r.path)).toEqual([
      AIDER_CONVENTIONS,
    ]);
  });
});
