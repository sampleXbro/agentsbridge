import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TARGET_IDS } from '../../../src/targets/catalog/target-ids.js';
import {
  findTargetIdLiterals,
  scanDirForTargetIdLiterals,
} from '../../helpers/target-id-literals.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('findTargetIdLiterals', () => {
  it('flags a planted single-quoted target-id literal', () => {
    expect(findTargetIdLiterals("if (target === 'gemini-cli') {}", TARGET_IDS)).toEqual([
      'gemini-cli',
    ]);
  });

  it('flags a planted double-quoted target-id literal', () => {
    expect(findTargetIdLiterals('return "cursor";', TARGET_IDS)).toEqual(['cursor']);
  });

  it('does not flag target ids mentioned in backtick-fenced prose comments', () => {
    expect(findTargetIdLiterals('/** e.g. `cursor` for `.mdc`. */', TARGET_IDS)).toEqual([]);
  });

  it('does not flag descriptor-free source', () => {
    expect(findTargetIdLiterals('const x = 1; // nothing here', TARGET_IDS)).toEqual([]);
  });
});

describe('src/install has no hardcoded target-id literals (arch §3.1 gate)', () => {
  it('finds zero offenders under src/install', () => {
    const offenders = scanDirForTargetIdLiterals(join(repoRoot, 'src', 'install'), TARGET_IDS);
    expect(offenders).toEqual({});
  });
});
