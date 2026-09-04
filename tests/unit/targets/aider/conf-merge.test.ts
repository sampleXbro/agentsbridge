import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { hasManagedAiderKeys, mergeAiderConf } from '../../../../src/targets/aider/conf-merge.js';

const HOOKS = 'test-cmd: pytest\nauto-test: true\nlint-cmd:\n  - ruff\nauto-lint: true\n';
const READ = 'read:\n  - CONVENTIONS.md\n';
const FULL = `${READ}${HOOKS}`;

describe('mergeAiderConf', () => {
  it('unions read: into an existing config and keeps every other key', () => {
    const merged = mergeAiderConf('model: gpt-4o\nread:\n  - PROJECT.md\n', READ);
    const parsed = parseYaml(merged) as { model?: string; read?: string[] };
    expect(parsed.model).toBe('gpt-4o');
    expect(parsed.read).toEqual(['PROJECT.md', 'CONVENTIONS.md']);
  });

  it('accepts a scalar read: value', () => {
    const parsed = parseYaml(mergeAiderConf('read: PROJECT.md\n', READ)) as { read?: string[] };
    expect(parsed.read).toEqual(['PROJECT.md', 'CONVENTIONS.md']);
  });

  it('keeps the user comments and unrelated keys of the config file', () => {
    const existing = '# my aider setup\nmodel: gpt-4o # inline\ndark-mode: true\n';
    const merged = mergeAiderConf(existing, HOOKS);
    expect(merged).toContain('# my aider setup');
    expect(merged).toContain('model: gpt-4o # inline');
    expect(merged).toContain('dark-mode: true');
    expect(merged).toContain('test-cmd: pytest');
  });

  it('writes read: and the hook keys in one pass', () => {
    const parsed = parseYaml(mergeAiderConf(null, FULL)) as Record<string, unknown>;
    expect(parsed.read).toEqual(['CONVENTIONS.md']);
    expect(parsed['lint-cmd']).toEqual(['ruff']);
    expect(parsed['auto-lint']).toBe(true);
  });

  it('marks every key it writes so the next run knows what it owns', () => {
    const merged = mergeAiderConf(null, HOOKS);
    expect(hasManagedAiderKeys(merged)).toBe(true);
    expect(merged).toContain('# agentsmesh:');
  });

  it('clears the keys it marked once they leave the projection', () => {
    const first = mergeAiderConf('model: gpt-4o\n', HOOKS);
    const parsed = parseYaml(mergeAiderConf(first, READ)) as Record<string, unknown>;
    expect(parsed.model).toBe('gpt-4o');
    expect(parsed['test-cmd']).toBeUndefined();
    expect(parsed['auto-test']).toBeUndefined();
    expect(parsed['lint-cmd']).toBeUndefined();
    expect(parsed.read).toEqual(['CONVENTIONS.md']);
  });

  it('never deletes a hook key the user wrote', () => {
    const existing = 'model: gpt-4o\ntest-cmd: pytest\nauto-test: true\nlint-cmd:\n  - ruff\n';
    const parsed = parseYaml(mergeAiderConf(existing, '')) as Record<string, unknown>;
    expect(parsed.model).toBe('gpt-4o');
    expect(parsed['test-cmd']).toBe('pytest');
    expect(parsed['auto-test']).toBe(true);
    expect(parsed['lint-cmd']).toEqual(['ruff']);
  });

  it('never flips an explicit auto-lint the user set by hand', () => {
    const parsed = parseYaml(mergeAiderConf('auto-lint: false\n', HOOKS)) as Record<
      string,
      unknown
    >;
    expect(parsed['auto-lint']).toBe(false);
    expect(parsed['lint-cmd']).toEqual(['ruff']);
  });

  it('rewrites the switch it wrote itself', () => {
    const first = mergeAiderConf(null, HOOKS);
    const parsed = parseYaml(mergeAiderConf(first, HOOKS)) as Record<string, unknown>;
    expect(parsed['auto-lint']).toBe(true);
  });

  it('is stable across repeated runs', () => {
    const first = mergeAiderConf('model: gpt-4o\n', FULL);
    expect(mergeAiderConf(first, FULL)).toBe(first);
  });

  it('never clears read: when only the hook keys are rewritten', () => {
    const existing = 'read:\n  - CONVENTIONS.md\n';
    const parsed = parseYaml(mergeAiderConf(existing, HOOKS)) as Record<string, unknown>;
    expect(parsed.read).toEqual(['CONVENTIONS.md']);
    expect(parsed['test-cmd']).toBe('pytest');
  });

  it('returns an empty file when nothing is left to write', () => {
    expect(mergeAiderConf(null, '')).toBe('');
  });

  it('starts from a fresh document when the existing config is not a YAML map', () => {
    expect(parseYaml(mergeAiderConf('just a scalar', READ))).toEqual({ read: ['CONVENTIONS.md'] });
  });

  it('starts from a fresh document when the existing config is unparseable', () => {
    expect(parseYaml(mergeAiderConf('read: [broken', READ))).toEqual({
      read: ['CONVENTIONS.md'],
    });
  });

  it('ignores a projection that is not a YAML map', () => {
    expect(parseYaml(mergeAiderConf('model: gpt-4o\n', 'plain scalar'))).toEqual({
      model: 'gpt-4o',
    });
  });
});

describe('hasManagedAiderKeys', () => {
  it('is false for a missing file, a plain config and an unrelated comment', () => {
    expect(hasManagedAiderKeys(null)).toBe(false);
    expect(hasManagedAiderKeys('model: gpt-4o\nlint-cmd:\n  - ruff\n')).toBe(false);
    expect(hasManagedAiderKeys('# my note\nlint-cmd:\n  - ruff\n')).toBe(false);
  });
});
