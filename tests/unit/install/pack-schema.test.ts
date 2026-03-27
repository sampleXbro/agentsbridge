import { describe, it, expect } from 'vitest';
import { packMetadataSchema } from '../../../src/install/pack/pack-schema.js';

const VALID_PACK: Record<string, unknown> = {
  name: 'org-repo-skills',
  source: 'github:org/repo@abc123def',
  version: 'abc123def',
  source_kind: 'github',
  installed_at: '2026-03-22T10:30:00Z',
  updated_at: '2026-03-22T10:30:00Z',
  features: ['skills', 'rules'],
  content_hash: 'sha256:a1b2c3d4',
};

describe('packMetadataSchema', () => {
  it('parses a valid pack metadata object', () => {
    const result = packMetadataSchema.parse(VALID_PACK);
    expect(result.name).toBe('org-repo-skills');
    expect(result.source).toBe('github:org/repo@abc123def');
    expect(result.version).toBe('abc123def');
    expect(result.source_kind).toBe('github');
    expect(result.features).toEqual(['skills', 'rules']);
    expect(result.content_hash).toBe('sha256:a1b2c3d4');
  });

  it('accepts optional fields missing', () => {
    const minimal = {
      name: 'x',
      source: 'github:a/b@sha',
      source_kind: 'github',
      installed_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      features: ['skills'],
      content_hash: 'sha256:abc',
    };
    const result = packMetadataSchema.parse(minimal);
    expect(result.version).toBeUndefined();
    expect(result.pick).toBeUndefined();
    expect(result.target).toBeUndefined();
    expect(result.path).toBeUndefined();
    expect(result.paths).toBeUndefined();
  });

  it('accepts aggregated scoped paths', () => {
    const result = packMetadataSchema.parse({
      ...VALID_PACK,
      paths: ['agents/core', 'agents/universal'],
    });
    expect(result.paths).toEqual(['agents/core', 'agents/universal']);
  });

  it('accepts pick with skill and rule names', () => {
    const result = packMetadataSchema.parse({
      ...VALID_PACK,
      pick: { skills: ['tdd', 'code-review'], rules: ['security'] },
    });
    expect(result.pick?.skills).toEqual(['tdd', 'code-review']);
    expect(result.pick?.rules).toEqual(['security']);
  });

  it('accepts valid target', () => {
    const result = packMetadataSchema.parse({ ...VALID_PACK, target: 'cursor' });
    expect(result.target).toBe('cursor');
  });

  it('rejects invalid target', () => {
    expect(() => packMetadataSchema.parse({ ...VALID_PACK, target: 'unknown-ide' })).toThrow();
  });

  it('rejects invalid feature', () => {
    expect(() =>
      packMetadataSchema.parse({ ...VALID_PACK, features: ['skills', 'bogus'] }),
    ).toThrow();
  });

  it('rejects invalid source_kind', () => {
    expect(() => packMetadataSchema.parse({ ...VALID_PACK, source_kind: 'npm' })).toThrow();
  });

  it('rejects missing required fields', () => {
    const { name: _n, ...withoutName } = VALID_PACK;
    expect(() => packMetadataSchema.parse(withoutName)).toThrow();

    const { content_hash: _h, ...withoutHash } = VALID_PACK;
    expect(() => packMetadataSchema.parse(withoutHash)).toThrow();
  });

  it('accepts all valid source_kinds', () => {
    for (const kind of ['github', 'gitlab', 'git', 'local'] as const) {
      expect(() => packMetadataSchema.parse({ ...VALID_PACK, source_kind: kind })).not.toThrow();
    }
  });

  it('accepts all valid features', () => {
    const result = packMetadataSchema.parse({
      ...VALID_PACK,
      features: ['rules', 'commands', 'agents', 'skills'],
    });
    expect(result.features).toHaveLength(4);
  });
});
