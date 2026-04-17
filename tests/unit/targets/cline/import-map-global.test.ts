import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildClineImportPaths } from '../../../../src/core/reference/import-map-builders.js';

const TEST_DIR = join(tmpdir(), 'am-cline-import-map-global-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(join(TEST_DIR, 'Documents', 'Cline', 'Rules'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'Documents', 'Cline', 'Workflows'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.cline', 'skills', 'ts-pro', 'references'), { recursive: true });

  writeFileSync(join(TEST_DIR, 'Documents', 'Cline', 'Rules', 'typescript.md'), '# TS\n');
  writeFileSync(join(TEST_DIR, 'Documents', 'Cline', 'Rules', 'testing.md'), '# Testing\n');
  writeFileSync(join(TEST_DIR, 'Documents', 'Cline', 'Workflows', 'commit.md'), '# Commit\n');
  writeFileSync(join(TEST_DIR, '.cline', 'skills', 'ts-pro', 'SKILL.md'), '# Skill\n');
  writeFileSync(
    join(TEST_DIR, '.cline', 'skills', 'ts-pro', 'references', 'checklist.md'),
    '# Checklist\n',
  );
  writeFileSync(join(TEST_DIR, '.cline', 'cline_mcp_settings.json'), '{}');
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('buildClineImportPaths — global scope', () => {
  it('maps Documents/Cline/Rules/ files to .agentsmesh/rules/', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('Documents/Cline/Rules/typescript.md')).toBe('.agentsmesh/rules/typescript.md');
    expect(refs.get('Documents/Cline/Rules/testing.md')).toBe('.agentsmesh/rules/testing.md');
  });

  it('maps Documents/Cline/Workflows/ files to .agentsmesh/commands/', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('Documents/Cline/Workflows/commit.md')).toBe('.agentsmesh/commands/commit.md');
  });

  it('maps .cline/skills/ to .agentsmesh/skills/', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.cline/skills/ts-pro/SKILL.md')).toBe('.agentsmesh/skills/ts-pro/SKILL.md');
    expect(refs.get('.cline/skills/ts-pro/references/checklist.md')).toBe(
      '.agentsmesh/skills/ts-pro/references/checklist.md',
    );
  });

  it('maps .cline/cline_mcp_settings.json to .agentsmesh/mcp.json', async () => {
    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    expect(refs.get('.cline/cline_mcp_settings.json')).toBe('.agentsmesh/mcp.json');
  });

  it('does not map project-mode .clinerules/ paths in global scope', async () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', 'typescript.md'), '# TS\n');

    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'global');

    // .clinerules/ should not appear in global scope refs
    for (const key of refs.keys()) {
      expect(key).not.toMatch(/^\.clinerules\//);
    }
  });
});

describe('buildClineImportPaths — project scope (unchanged)', () => {
  it('maps .clinerules/ files to .agentsmesh/rules/ in project scope', async () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', '_root.md'), '# Root\n');
    writeFileSync(join(TEST_DIR, '.clinerules', 'typescript.md'), '# TS\n');

    const refs = new Map<string, string>();
    await buildClineImportPaths(refs, TEST_DIR, 'project');

    expect(refs.get('.clinerules/_root.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get('.clinerules/typescript.md')).toBe('.agentsmesh/rules/typescript.md');
  });
});
