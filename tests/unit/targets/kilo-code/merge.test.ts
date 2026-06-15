import { describe, it, expect } from 'vitest';
import { mergeKiloConfig } from '../../../../src/targets/kilo-code/merge.js';
import {
  KILO_CONFIG_FILE,
  KILO_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/kilo-code/constants.js';

const PERMISSION_CONTENT = JSON.stringify({
  permission: { allow: ['Read'], deny: ['Bash'] },
});

describe('mergeKiloConfig (kilo-code)', () => {
  it('returns null when resolvedPath is not a kilo config file', () => {
    expect(mergeKiloConfig(null, null, PERMISSION_CONTENT, 'other.json')).toBeNull();
  });

  it('merges for the project-level config file path', () => {
    const existing = JSON.stringify({ custom: 'keep', permission: { allow: [] } });
    const result = mergeKiloConfig(existing, null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.custom).toBe('keep');
    expect(parsed.permission).toEqual({ allow: ['Read'], deny: ['Bash'] });
  });

  it('merges for the global-level config file path', () => {
    const existing = JSON.stringify({ custom: 'keep' });
    const result = mergeKiloConfig(existing, null, PERMISSION_CONTENT, KILO_GLOBAL_CONFIG_FILE);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.custom).toBe('keep');
    expect(parsed.permission).toEqual({ allow: ['Read'], deny: ['Bash'] });
  });

  it('prefers pending.content over existing as the merge base', () => {
    const existing = JSON.stringify({ from: 'existing' });
    const pending = {
      path: KILO_CONFIG_FILE,
      content: JSON.stringify({ from: 'pending', keepMe: true }),
    };
    const result = mergeKiloConfig(existing, pending, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.from).toBe('pending');
    expect(parsed.keepMe).toBe(true);
  });

  it('uses existing as base when pending is null', () => {
    const existing = JSON.stringify({ from: 'existing', keepMe: 1 });
    const result = mergeKiloConfig(existing, null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.from).toBe('existing');
    expect(parsed.keepMe).toBe(1);
  });

  it('returns newContent when both existing and pending are null', () => {
    expect(mergeKiloConfig(null, null, PERMISSION_CONTENT, KILO_CONFIG_FILE)).toBe(
      PERMISSION_CONTENT,
    );
  });

  it('returns newContent when pending content is null and existing is null', () => {
    const pending = { path: KILO_CONFIG_FILE, content: null as unknown as string };
    expect(mergeKiloConfig(null, pending, PERMISSION_CONTENT, KILO_CONFIG_FILE)).toBe(
      PERMISSION_CONTENT,
    );
  });

  it('falls back to {} when the base JSON is an array', () => {
    const base = JSON.stringify(['a', 'b']);
    const result = mergeKiloConfig(base, null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({ permission: { allow: ['Read'], deny: ['Bash'] } });
  });

  it('falls back to {} when the base JSON is null', () => {
    const result = mergeKiloConfig('null', null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({ permission: { allow: ['Read'], deny: ['Bash'] } });
  });

  it('falls back to {} when the base JSON is a non-object scalar (number)', () => {
    const result = mergeKiloConfig('42', null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({ permission: { allow: ['Read'], deny: ['Bash'] } });
  });

  it('falls back to {} when the base JSON is a non-object scalar (string)', () => {
    const result = mergeKiloConfig('"hello"', null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({ permission: { allow: ['Read'], deny: ['Bash'] } });
  });

  it('falls back to {} when the base JSON is invalid', () => {
    const result = mergeKiloConfig('{not valid json', null, PERMISSION_CONTENT, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({ permission: { allow: ['Read'], deny: ['Bash'] } });
  });

  it('returns base unchanged when incoming is null', () => {
    const base = JSON.stringify({ custom: 'keep' });
    expect(mergeKiloConfig(base, null, 'null', KILO_CONFIG_FILE)).toBe(base);
  });

  it('returns base unchanged when incoming is a non-object scalar', () => {
    const base = JSON.stringify({ custom: 'keep' });
    expect(mergeKiloConfig(base, null, '7', KILO_CONFIG_FILE)).toBe(base);
  });

  it('returns base unchanged when incoming is an array', () => {
    const base = JSON.stringify({ custom: 'keep' });
    expect(mergeKiloConfig(base, null, '["x"]', KILO_CONFIG_FILE)).toBe(base);
  });

  it('does not touch permission when overlay has no permission key', () => {
    const base = JSON.stringify({ permission: { allow: ['keep'] }, custom: 'keep' });
    const incoming = JSON.stringify({ unrelated: true });
    const result = mergeKiloConfig(base, null, incoming, KILO_CONFIG_FILE);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.permission).toEqual({ allow: ['keep'] });
    expect(parsed.custom).toBe('keep');
    expect(parsed.unrelated).toBeUndefined();
  });
});
