import { describe, expect, it } from 'vitest';
import { errorClass } from '../../../src/lessons/error-class.js';

describe('errorClass', () => {
  it('returns undefined for absent or blank text', () => {
    expect(errorClass(undefined)).toBeUndefined();
    expect(errorClass('')).toBeUndefined();
    expect(errorClass('  \n  \t ')).toBeUndefined();
  });

  it('takes the first non-empty line, lowercased', () => {
    expect(errorClass('\nTypeError: boom\n  at foo (x.ts)')).toBe('typeerror: boom');
  });

  it('collapses volatile line:col numbers so the class is stable run to run', () => {
    expect(errorClass('Error at 42:7')).toBe(errorClass('Error at 9:1'));
  });

  it('collapses quoted paths and hex addresses so two runs share one class', () => {
    expect(errorClass("Cannot find module '/abs/a.ts'")).toBe(
      errorClass("Cannot find module '/other/b.ts'"),
    );
    expect(errorClass('segfault at 0x7ffee1a2')).toBe(errorClass('segfault at 0xdeadbeef'));
  });

  it('caps the class length', () => {
    expect(errorClass('e'.repeat(500))!.length).toBeLessThanOrEqual(MAX_ERROR_CLASS_FOR_TEST);
  });
});

const MAX_ERROR_CLASS_FOR_TEST = 120;
