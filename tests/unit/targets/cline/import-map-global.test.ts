import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildClineImportPaths } from '../../../../src/core/reference/import-map-builders.js';

const TEST_DIR = join(tmpdir(), 'am-cline-import-map-global-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(join(TEST_DIR, '.cline', 'data', 'settings', 'rules'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'Documents', 'Cline', 'Workflows'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.cline', 'data', 'settings', 'skills', 'ts-pro', 'references'), {
    recursive: true,
  });

  writeFileSync(join(TEST_DIR, '.cline', 'data', 'settings', 'rules', 'typescript.md'), '# TS\n');
  writeFileSync(join(TEST_DIR, '.cline', 'data', 'settings', 'rules', 'testing.md'), '# Testing\n');
  writeFileSync(join(TEST_DIR, 'Documents', 'Cline', 'Workflows', 'commit.md'), '# Commit\n');
  writeFileSync(
    join(TEST_DIR, '.cline', 'data', 'settings', 'skills', 'ts-pro', 'SKILL.md'),
    '# Skill\n',
  );
  writeFileSync(
    join(TEST_DIR, '.cline', 'data', 'settings', 'skills', 'ts-pro', 'references', 'checklist.md'),
    '# Checklist\n',
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('buildClineImportPaths — global scope', () => {
  it('maps .cline/data/settings/rules/ files to .agentsmesh/rules/', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.cline/data/settings/rules/typescript.md')).toBe(
      '.agentsmesh/rules/typescript.md',
    );
    expect(refs.get('.cline/data/settings/rules/testing.md')).toBe('.agentsmesh/rules/testing.md');
  });

  it('maps Documents/Cline/Workflows/ files to .agentsmesh/commands/', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('Documents/Cline/Workflows/commit.md')).toBe('.agentsmesh/commands/commit.md');
  });

  it('maps .cline/data/settings/skills/ to .agentsmesh/skills/', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.cline/data/settings/skills/ts-pro/SKILL.md')).toBe(
      '.agentsmesh/skills/ts-pro/SKILL.md',
    );
    expect(refs.get('.cline/data/settings/skills/ts-pro/references/checklist.md')).toBe(
      '.agentsmesh/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not map project-mode .cline/rules/ paths in global scope', async () => {
    mkdirSync(join(TEST_DIR, '.cline', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cline', 'rules', 'typescript.md'), '# TS\n');

    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    // Project-scope `.cline/rules/` should not appear in global scope refs.
    for (const key of refs.keys()) {
      expect(key).not.toMatch(/^\.cline\/rules\//);
    }
  });
});

describe('buildClineImportPaths — project scope (unchanged)', () => {
  it('maps .cline/rules/ files to .agentsmesh/rules/ in project scope', async () => {
    mkdirSync(join(TEST_DIR, '.cline', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cline', 'rules', '_root.md'), '# Root\n');
    writeFileSync(join(TEST_DIR, '.cline', 'rules', 'typescript.md'), '# TS\n');

    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'project');

    expect(refs.get('.cline/rules/_root.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get('.cline/rules/typescript.md')).toBe('.agentsmesh/rules/typescript.md');
  });
});
