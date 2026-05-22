/**
 * Branch coverage for src/install/manual/mdc-reader.ts:
 * - toStrArray: array, string non-empty, string empty, neither (line 11-13).
 * - normalizeWindsurfKeys: glob → globs migration (line 43-46).
 * - normalizeCursorKeys: glob vs description vs neither (manual) trigger.
 */

import { describe, it, expect } from 'vitest';
import { normalizeMdcToCanonical } from '../../../../src/install/manual/mdc-reader.js';

describe('normalizeMdcToCanonical — branch coverage', () => {
  it('cursor-style: alwaysApply true → root:true, removes alwaysApply key', () => {
    const result = normalizeMdcToCanonical(
      '---\nalwaysApply: true\ndescription: root\n---\n\nbody\n',
    );
    expect(result).toContain('root: true');
    expect(result).not.toContain('alwaysApply');
  });

  it('cursor-style: alwaysApply false + globs → trigger:glob', () => {
    const result = normalizeMdcToCanonical(
      '---\nalwaysApply: false\nglobs:\n  - "**/*.ts"\n---\n\nbody\n',
    );
    expect(result).toContain('trigger: glob');
  });

  it('cursor-style: alwaysApply false + description only → trigger:model_decision', () => {
    const result = normalizeMdcToCanonical(
      '---\nalwaysApply: false\ndescription: Foo\n---\n\nbody\n',
    );
    expect(result).toContain('trigger: model_decision');
  });

  it('cursor-style: alwaysApply false + no globs/description → trigger:manual', () => {
    const result = normalizeMdcToCanonical('---\nalwaysApply: false\n---\n\nbody\n');
    expect(result).toContain('trigger: manual');
  });

  it('windsurf-style: trigger:always → always_on', () => {
    const result = normalizeMdcToCanonical('---\ntrigger: always\ndescription: x\n---\n\nbody\n');
    expect(result).toContain('trigger: always_on');
  });

  it('windsurf-style: string `glob` migrates to globs array', () => {
    const result = normalizeMdcToCanonical('---\ntrigger: glob\nglob: "**/*.md"\n---\n\nbody\n');
    expect(result).toContain('globs:');
    expect(result).not.toMatch(/^glob:/m);
  });

  it('windsurf-style: existing globs array preferred over glob string', () => {
    const result = normalizeMdcToCanonical(
      '---\ntrigger: glob\nglob: "**/*.md"\nglobs:\n  - "src/**/*.ts"\n---\n\nbody\n',
    );
    expect(result).toContain('src/**/*.ts');
    expect(result).not.toMatch(/^glob:/m);
  });

  it('content without frontmatter passes through unchanged', () => {
    const content = 'no frontmatter\nplain body\n';
    expect(normalizeMdcToCanonical(content)).toBe(content);
  });

  it('empty frontmatter is preserved (no normalization branches taken)', () => {
    const content = '---\n---\n\nbody\n';
    const result = normalizeMdcToCanonical(content);
    expect(result).toContain('body');
  });
});
