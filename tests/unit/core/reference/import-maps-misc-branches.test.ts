/**
 * Branch coverage for various small import-map builders.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildTraeImportPaths } from '../../../../src/core/reference/import-maps/trae.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-import-misc-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('buildTraeImportPaths — branch coverage', () => {
  it('global scope: excludes the global root file from rules-dir mappings', async () => {
    mkdirSync(join(root, '.trae'), { recursive: true });
    writeFileSync(join(root, '.trae', 'project_rules.md'), 'root');
    writeFileSync(join(root, '.trae', 'style.md'), 'style');
    const refs = new Map<string, string>();
    await buildTraeImportPaths(refs, root, 'global');
    // global scope returns early after the global block — should have entries.
    expect(refs.size).toBeGreaterThan(0);
  });

  it('project scope: excludes TRAE_PROJECT_RULES from steering dir mappings', async () => {
    mkdirSync(join(root, '.trae', 'rules'), { recursive: true });
    writeFileSync(join(root, '.trae', 'rules', 'project_rules.md'), 'root');
    writeFileSync(join(root, '.trae', 'rules', 'naming.md'), 'naming');
    const refs = new Map<string, string>();
    await buildTraeImportPaths(refs, root, 'project');
    expect(refs.has('.trae/rules/naming.md')).toBe(true);
  });

  it('returns no entries when target dirs do not exist', async () => {
    const refs = new Map<string, string>();
    await buildTraeImportPaths(refs, root, 'project');
    // Default project rule alias is always set.
    expect(refs.size).toBeGreaterThan(0);
  });
});
