/**
 * Branch coverage for various small import-map builders.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildTraeImportPaths } from '../../../../src/core/reference/import-maps/trae.js';
import {
  TRAE_GLOBAL_ROOT_RULE,
  TRAE_PROJECT_RULES,
} from '../../../../src/targets/trae/constants.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-import-misc-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('buildTraeImportPaths — branch coverage', () => {
  it('global scope: excludes the global root file from rules-dir mappings', async () => {
    mkdirSync(join(root, '.trae', 'user_rules'), { recursive: true });
    writeFileSync(join(root, '.trae', 'user_rules', 'rules.md'), 'root');
    writeFileSync(join(root, '.trae', 'user_rules', 'style.md'), 'style');
    const refs = new Map<string, string>();
    await buildTraeImportPaths(refs, root, 'global');
    // Global root alias is set.
    expect(refs.get(TRAE_GLOBAL_ROOT_RULE)).toBe('.agentsmesh/rules/_root.md');
    // Sibling rule files mapped under canonical rules dir.
    expect(refs.get('.trae/user_rules/style.md')).toBe('.agentsmesh/rules/style.md');
    // The root rule itself is NOT remapped a second time as a sibling rule.
    expect([...refs.entries()].filter(([k]) => k === TRAE_GLOBAL_ROOT_RULE)).toHaveLength(1);
  });

  it('project scope: excludes TRAE_PROJECT_RULES from steering dir mappings', async () => {
    mkdirSync(join(root, '.trae', 'rules'), { recursive: true });
    writeFileSync(join(root, '.trae', 'rules', 'project_rules.md'), 'root');
    writeFileSync(join(root, '.trae', 'rules', 'naming.md'), 'naming');
    const refs = new Map<string, string>();
    await buildTraeImportPaths(refs, root, 'project');
    expect(refs.get('.trae/rules/naming.md')).toBe('.agentsmesh/rules/naming.md');
    // Project root alias points to canonical _root.md; the sibling rules dir
    // must NOT re-add the project_rules.md path as a separate mapping.
    expect(refs.get(TRAE_PROJECT_RULES)).toBe('.agentsmesh/rules/_root.md');
    expect([...refs.entries()].filter(([k]) => k === TRAE_PROJECT_RULES)).toHaveLength(1);
  });

  it('project scope with no rules dir on disk sets exactly the project root alias', async () => {
    const refs = new Map<string, string>();
    await buildTraeImportPaths(refs, root, 'project');
    expect(refs.get(TRAE_PROJECT_RULES)).toBe('.agentsmesh/rules/_root.md');
    expect(refs.size).toBe(1);
  });
});
