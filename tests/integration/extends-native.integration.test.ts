import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadCanonicalWithExtends } from '../../src/canonical/extends.js';

const TEST_DIR = join(tmpdir(), 'am-extends-native-integration');

function makeProject(): string {
  const projectDir = join(TEST_DIR, 'project');
  mkdirSync(join(projectDir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(projectDir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
  writeFileSync(
    join(projectDir, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Local rule\n',
  );
  return projectDir;
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('native format local extends', () => {
  it('imports rules from a CLAUDE.md native-format repo and merges with local', async () => {
    const projectDir = makeProject();

    // Native-format source: has CLAUDE.md and .claude/rules/ but NO .agentsmesh/
    const nativeDir = join(TEST_DIR, 'native-claude');
    mkdirSync(join(nativeDir, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(nativeDir, 'CLAUDE.md'), '---\nroot: true\n---\n# Shared Claude root\n');
    writeFileSync(
      join(nativeDir, '.claude', 'rules', 'security.md'),
      '---\ndescription: Security rule\n---\n# Always sanitize inputs\n',
    );

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'shared', source: join('..', 'native-claude'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, projectDir);

    // Local rule wins over extended root (same _root slug, overlay wins)
    expect(canonical.rules.some((r) => r.body.includes('Local rule'))).toBe(true);
    // security.md from extended repo is a distinct slug, so it is merged in
    expect(canonical.rules.some((r) => r.body.includes('Always sanitize inputs'))).toBe(true);
  });

  it('writes .agentsmesh/ into the native repo dir after first import, second call still returns the imported rules', async () => {
    const projectDir = makeProject();

    const nativeDir = join(TEST_DIR, 'native-cache-test');
    mkdirSync(nativeDir, { recursive: true });
    writeFileSync(join(nativeDir, 'CLAUDE.md'), '---\nroot: true\n---\n# Repo root\n');

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'repo', source: join('..', 'native-cache-test'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    // First call: detects + imports
    const { canonical: first } = await loadCanonicalWithExtends(config, projectDir);
    // Local project has _root.md with "Local rule" — it wins over the extended _root.
    // The import still happened (we verify .agentsmesh/ was written below).
    expect(first.rules.some((r) => r.body.includes('Local rule'))).toBe(true);

    // Verify .agentsmesh/ was written with exactly the expected files
    const abDir = join(nativeDir, '.agentsmesh');
    const writtenFiles = (readdirSync(abDir, { recursive: true }) as string[]).sort();
    expect(writtenFiles).toHaveLength(2);
    expect(writtenFiles[0]).toBe('rules');
    expect(writtenFiles[1]).toBe('rules/_root.md');

    // Second call: .agentsmesh/ exists, no re-detection needed
    const { canonical: second } = await loadCanonicalWithExtends(config, projectDir);
    expect(second.rules.some((r) => r.body.includes('Local rule'))).toBe(true);
  });

  it('throws a descriptive error when repo has no recognized agent configuration', async () => {
    const projectDir = makeProject();

    const emptyDir = join(TEST_DIR, 'empty-repo');
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, 'README.md'), '# Nothing here\n');

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'empty', source: join('..', 'empty-repo'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const err = await loadCanonicalWithExtends(config, projectDir).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/No supported agent configuration found/);
    expect((err as Error).message).toMatch(/empty/);
  });

  it('detects cursor format from .cursor/rules/ and imports rules', async () => {
    const projectDir = makeProject();

    const cursorDir = join(TEST_DIR, 'native-cursor');
    mkdirSync(join(cursorDir, '.cursor', 'rules'), { recursive: true });
    // Cursor imports .mdc files from .cursor/rules/
    writeFileSync(
      join(cursorDir, '.cursor', 'rules', 'style.mdc'),
      '---\ndescription: Style guide\n---\n# Use tabs\n',
    );

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'cursor-base', source: join('..', 'native-cursor'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, projectDir);
    expect(canonical.rules.some((r) => r.body.includes('Use tabs'))).toBe(true);
  });
});
