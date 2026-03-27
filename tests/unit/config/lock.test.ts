import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readLock,
  writeLock,
  buildChecksums,
  buildExtendChecksums,
  buildPackChecksums,
  detectLockedFeatureViolations,
} from '../../../src/config/core/lock.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-lock-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('readLock', () => {
  it('reads valid lock file', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(
      join(abDir, '.lock'),
      `generated_at: "2026-03-12T14:30:00Z"
generated_by: "test"
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:abc123"
extends: {}
`,
    );
    const lock = await readLock(abDir);
    expect(lock).not.toBeNull();
    if (lock) {
      expect(lock.generatedAt).toBe('2026-03-12T14:30:00Z');
      expect(lock.generatedBy).toBe('test');
      expect(lock.libVersion).toBe('0.1.0');
      expect(lock.checksums['rules/_root.md']).toBe('sha256:abc123');
    }
  });

  it('returns null for non-existent lock', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    expect(await readLock(abDir)).toBeNull();
  });

  it('returns null for non-existent .agentsmesh', async () => {
    expect(await readLock(join(TEST_DIR, 'nope'))).toBeNull();
  });

  it('returns null for malformed YAML', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(join(abDir, '.lock'), 'not valid: yaml: [unclosed');
    expect(await readLock(abDir)).toBeNull();
  });

  it('returns null when lock content parses to non-object (scalar)', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(join(abDir, '.lock'), '"just a string"');
    expect(await readLock(abDir)).toBeNull();
  });

  it('reads packs field when present', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(
      join(abDir, '.lock'),
      `generated_at: "2026-03-22T10:00:00Z"
generated_by: "test"
lib_version: "0.1.0"
checksums: {}
extends: {}
packs:
  my-pack: sha256:aabbcc
`,
    );
    const lock = await readLock(abDir);
    expect(lock?.packs?.['my-pack']).toBe('sha256:aabbcc');
  });

  it('defaults packs to empty object when missing', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(
      join(abDir, '.lock'),
      `generated_at: "2026-03-22"
generated_by: "test"
lib_version: "0.1.0"
checksums: {}
extends: {}
`,
    );
    const lock = await readLock(abDir);
    expect(lock?.packs).toEqual({});
  });

  it('handles lock with non-object checksums or extends', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    writeFileSync(
      join(abDir, '.lock'),
      `generated_at: "2026-03-12"
generated_by: "test"
lib_version: "0.1.0"
checksums: "invalid"
extends: "invalid"
`,
    );
    const lock = await readLock(abDir);
    expect(lock).not.toBeNull();
    expect(lock!.checksums).toEqual({});
    expect(lock!.extends).toEqual({});
  });
});

describe('writeLock', () => {
  it('writes lock file', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(abDir, { recursive: true });
    const lock = {
      generatedAt: '2026-03-12T14:30:00Z',
      generatedBy: 'me',
      libVersion: '0.1.0',
      checksums: { 'rules/_root.md': 'sha256:abc' },
      extends: {},
    };
    await writeLock(abDir, lock);
    const content = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(abDir, '.lock'), 'utf8'),
    );
    expect(content).toContain('generated_at:');
    expect(content).toContain('rules/_root.md');
  });

  it('creates .agentsmesh if missing', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    const lock = {
      generatedAt: '2026-03-12T14:30:00Z',
      generatedBy: 'me',
      libVersion: '0.1.0',
      checksums: {},
      extends: {},
    };
    await writeLock(abDir, lock);
    expect(await readLock(abDir)).not.toBeNull();
  });
});

describe('buildChecksums', () => {
  it('hashes canonical files', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), '# Rules\nUse TypeScript');
    const sums = await buildChecksums(abDir);
    expect(Object.keys(sums)).toContain('rules/_root.md');
    expect(sums['rules/_root.md']).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('includes rules, commands, agents, skills, mcp, permissions, hooks, ignore', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    mkdirSync(join(abDir, 'commands'), { recursive: true });
    mkdirSync(join(abDir, 'agents'), { recursive: true });
    mkdirSync(join(abDir, 'skills', 'foo'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), 'x');
    writeFileSync(join(abDir, 'commands', 'review.md'), 'y');
    writeFileSync(join(abDir, 'agents', 'foo.md'), 'z');
    writeFileSync(join(abDir, 'skills', 'foo', 'SKILL.md'), 's');
    writeFileSync(join(abDir, 'mcp.json'), '{}');
    writeFileSync(join(abDir, 'permissions.yaml'), 'allow: []');
    writeFileSync(join(abDir, 'hooks.yaml'), '{}');
    writeFileSync(join(abDir, 'ignore'), 'dist');

    const sums = await buildChecksums(abDir);
    expect(sums['rules/_root.md']).toBeDefined();
    expect(sums['commands/review.md']).toBeDefined();
    expect(sums['agents/foo.md']).toBeDefined();
    expect(sums['skills/foo/SKILL.md']).toBeDefined();
    expect(sums['mcp.json']).toBeDefined();
    expect(sums['permissions.yaml']).toBeDefined();
    expect(sums['hooks.yaml']).toBeDefined();
    expect(sums['ignore']).toBeDefined();
  });

  it('excludes files under packs/ from checksums (tracked separately)', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    const packRulesDir = join(abDir, 'packs', 'my-pack', 'rules');
    mkdirSync(packRulesDir, { recursive: true });
    writeFileSync(join(packRulesDir, 'rule.md'), '# Pack rule');
    const sums = await buildChecksums(abDir);
    expect(Object.keys(sums).some((k) => k.startsWith('packs/'))).toBe(false);
  });

  it('excludes .lock from checksums', async () => {
    const abDir = join(TEST_DIR, '.agentsmesh');
    mkdirSync(join(abDir, 'rules'), { recursive: true });
    writeFileSync(join(abDir, 'rules', '_root.md'), 'x');
    writeFileSync(join(abDir, '.lock'), 'dummy');
    const sums = await buildChecksums(abDir);
    expect(sums['.lock']).toBeUndefined();
  });

  it('returns empty object for non-existent .agentsmesh', async () => {
    const sums = await buildChecksums(join(TEST_DIR, 'nope'));
    expect(sums).toEqual({});
  });
});

describe('buildPackChecksums', () => {
  it('returns empty for non-existent packsDir', async () => {
    const sums = await buildPackChecksums(join(TEST_DIR, 'nonexistent', 'packs'));
    expect(sums).toEqual({});
  });

  it('returns pack name -> content_hash for valid packs', async () => {
    const packsDir = join(TEST_DIR, 'packs');
    const packDir = join(packsDir, 'my-pack');
    mkdirSync(packDir, { recursive: true });
    writeFileSync(
      join(packDir, 'pack.yaml'),
      [
        'name: my-pack',
        'source: github:org/repo@abc123',
        'source_kind: github',
        'installed_at: "2026-03-22T10:00:00Z"',
        'updated_at: "2026-03-22T10:00:00Z"',
        'content_hash: sha256:aabbcc',
        'features:',
        '  - skills',
      ].join('\n'),
    );
    const sums = await buildPackChecksums(packsDir);
    expect(sums['my-pack']).toBe('sha256:aabbcc');
  });

  it('skips directories without valid pack.yaml', async () => {
    const packsDir = join(TEST_DIR, 'packs');
    mkdirSync(join(packsDir, 'bad-pack'), { recursive: true });
    // no pack.yaml
    const sums = await buildPackChecksums(packsDir);
    expect(Object.keys(sums)).toHaveLength(0);
  });
});

describe('buildExtendChecksums', () => {
  it('returns fingerprint per extend name', async () => {
    const extDir = join(TEST_DIR, 'shared');
    mkdirSync(join(extDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(extDir, '.agentsmesh', 'rules', '_root.md'), '# Shared\n');
    const sums = await buildExtendChecksums([{ name: 'base', resolvedPath: extDir }]);
    expect(sums.base).toMatch(/^local:sha256:[a-f0-9]{64}$/);
  });

  it('returns empty when no resolved extends', async () => {
    const sums = await buildExtendChecksums([]);
    expect(sums).toEqual({});
  });

  it('different content produces different fingerprints', async () => {
    const ext1 = join(TEST_DIR, 'ext1');
    const ext2 = join(TEST_DIR, 'ext2');
    mkdirSync(join(ext1, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(ext2, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(ext1, '.agentsmesh', 'rules', '_root.md'), 'A');
    writeFileSync(join(ext2, '.agentsmesh', 'rules', '_root.md'), 'B');
    const sums = await buildExtendChecksums([
      { name: 'a', resolvedPath: ext1 },
      { name: 'b', resolvedPath: ext2 },
    ]);
    expect(sums.a).not.toBe(sums.b);
  });

  it('uses version for remote extends (no content hash)', async () => {
    const sums = await buildExtendChecksums([
      { name: 'company-base', resolvedPath: '/any/path', version: 'v2.1.0' },
    ]);
    expect(sums['company-base']).toBe('v2.1.0');
  });
});

describe('detectLockedFeatureViolations', () => {
  it('returns changed paths only within locked features', () => {
    const violations = detectLockedFeatureViolations(
      {
        'rules/_root.md': 'sha256:old-root',
        'mcp.json': 'sha256:old-mcp',
        ignore: 'sha256:same-ignore',
      },
      {
        'rules/_root.md': 'sha256:new-root',
        'mcp.json': 'sha256:new-mcp',
        ignore: 'sha256:same-ignore',
      },
      ['rules'],
    );

    expect(violations).toEqual(['rules/_root.md']);
  });

  it('reports added and removed paths inside locked features', () => {
    const violations = detectLockedFeatureViolations(
      {
        'hooks.yaml': 'sha256:old-hooks',
      },
      {
        'permissions.yaml': 'sha256:new-permissions',
      },
      ['hooks', 'permissions'],
    );

    expect(violations).toEqual(['hooks.yaml', 'permissions.yaml']);
  });
});
