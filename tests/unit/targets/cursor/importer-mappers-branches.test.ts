/**
 * Branch coverage for src/targets/cursor/importer-mappers.ts deriveCursorTrigger:
 * - alwaysApply !== false → null.
 * - alwaysApply === false + globs → 'glob'.
 * - alwaysApply === false + description → 'model_decision'.
 * - alwaysApply === false + neither → 'manual'.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mapCursorRuleFile } from '../../../../src/targets/cursor/importer-mappers.js';

let destDir = '';

beforeEach(() => {
  destDir = mkdtempSync(join(tmpdir(), 'am-cursor-mappers-'));
  mkdirSync(destDir, { recursive: true });
});

afterEach(() => {
  rmSync(destDir, { recursive: true, force: true });
});

describe('mapCursorRuleFile — deriveCursorTrigger branches', () => {
  it('alwaysApply:false + globs → trigger: glob', async () => {
    const dest = join(destDir, 'rule.md');
    writeFileSync(dest, '---\nalwaysApply: false\nglobs:\n  - "**/*.ts"\n---\nbody');
    let rootCalled = false;
    const mapping = await mapCursorRuleFile(
      'rule.mdc',
      destDir,
      () => '---\nalwaysApply: false\nglobs:\n  - "**/*.ts"\n---\nbody',
      () => {
        rootCalled = true;
      },
    );
    expect(rootCalled).toBe(false);
    expect(mapping.content).toContain('trigger: glob');
  });

  it('alwaysApply:false + description only → trigger: model_decision', async () => {
    const mapping = await mapCursorRuleFile(
      'r.mdc',
      destDir,
      () => '---\nalwaysApply: false\ndescription: When TypeScript\n---\nbody',
      () => {},
    );
    expect(mapping.content).toContain('trigger: model_decision');
  });

  it('alwaysApply:false + neither globs nor description → trigger: manual', async () => {
    const mapping = await mapCursorRuleFile(
      'r.mdc',
      destDir,
      () => '---\nalwaysApply: false\n---\nbody',
      () => {},
    );
    expect(mapping.content).toContain('trigger: manual');
  });

  it('alwaysApply omitted (not literal false) → no trigger emitted', async () => {
    const mapping = await mapCursorRuleFile(
      'r.mdc',
      destDir,
      () => '---\nglobs:\n  - "**/*.ts"\n---\nbody',
      () => {},
    );
    expect(mapping.content).not.toContain('trigger:');
  });

  it('alwaysApply:true → triggers onRootRule callback and writes _root.md', async () => {
    let rootCalled = false;
    const mapping = await mapCursorRuleFile(
      'rule.mdc',
      destDir,
      () => '---\nalwaysApply: true\n---\nroot body',
      () => {
        rootCalled = true;
      },
    );
    expect(rootCalled).toBe(true);
    expect(mapping.destPath.endsWith('_root.md')).toBe(true);
  });
});
