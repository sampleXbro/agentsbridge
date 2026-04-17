import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildContinueImportPaths } from '../../../../src/core/reference/import-map-builders.js';

const TEST_DIR = join(tmpdir(), 'am-continue-import-map-global-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(join(TEST_DIR, '.continue', 'rules'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.continue', 'prompts'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.continue', 'skills', 'ts-pro', 'references'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.agents', 'skills', 'shared-skill', 'references'), { recursive: true });

  writeFileSync(join(TEST_DIR, '.continue', 'rules', 'general.md'), '# Root\n');
  writeFileSync(join(TEST_DIR, '.continue', 'rules', 'typescript.md'), '# TS\n');
  writeFileSync(join(TEST_DIR, '.continue', 'prompts', 'commit.md'), '# Commit\n');
  writeFileSync(join(TEST_DIR, '.continue', 'skills', 'ts-pro', 'SKILL.md'), '# Skill\n');
  writeFileSync(
    join(TEST_DIR, '.continue', 'skills', 'ts-pro', 'references', 'checklist.md'),
    '# Checklist\n',
  );
  writeFileSync(join(TEST_DIR, '.agents', 'skills', 'shared-skill', 'SKILL.md'), '# Shared\n');
  writeFileSync(
    join(TEST_DIR, '.agents', 'skills', 'shared-skill', 'references', 'guide.md'),
    '# Guide\n',
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('buildContinueImportPaths — global scope', () => {
  it('maps .continue/rules/general.md to .agentsmesh/rules/_root.md', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.continue/rules/general.md')).toBe('.agentsmesh/rules/_root.md');
  });

  it('maps non-root rules to .agentsmesh/rules/', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.continue/rules/typescript.md')).toBe('.agentsmesh/rules/typescript.md');
  });

  it('maps .continue/prompts/ to .agentsmesh/commands/', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.continue/prompts/commit.md')).toBe('.agentsmesh/commands/commit.md');
  });

  it('maps .continue/skills/ to .agentsmesh/skills/', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.continue/skills/ts-pro/SKILL.md')).toBe('.agentsmesh/skills/ts-pro/SKILL.md');
    expect(refs.get('.continue/skills/ts-pro/references/checklist.md')).toBe(
      '.agentsmesh/skills/ts-pro/references/checklist.md',
    );
  });

  it('maps .agents/skills/ to .agentsmesh/skills/ in global scope', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.agents/skills/shared-skill/SKILL.md')).toBe(
      '.agentsmesh/skills/shared-skill/SKILL.md',
    );
    expect(refs.get('.agents/skills/shared-skill/references/guide.md')).toBe(
      '.agentsmesh/skills/shared-skill/references/guide.md',
    );
  });
});

describe('buildContinueImportPaths — project scope (unchanged)', () => {
  it('maps .continue/rules/general.md to .agentsmesh/rules/_root.md in project scope', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'project');

    expect(refs.get('.continue/rules/general.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get('.continue/rules/typescript.md')).toBe('.agentsmesh/rules/typescript.md');
  });

  it('does not map .agents/skills/ in project scope', async () => {
    const refs = new Map<string, string>();
    await buildContinueImportPaths(refs, TEST_DIR, 'project');

    for (const key of refs.keys()) {
      expect(key).not.toMatch(/^\.agents\/skills\//);
    }
  });
});
