import { describe, expect, it } from 'vitest';
import * as lessons from '../../../src/public/lessons.js';
import { LessonsGraphExistsError } from '../../../src/lessons/import-legacy.js';

describe('public/lessons surface', () => {
  it('re-exports LessonsGraphExistsError so consumers can instanceof it', () => {
    expect(lessons.LessonsGraphExistsError).toBe(LessonsGraphExistsError);
    const err = new lessons.LessonsGraphExistsError();
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('LESSONS_GRAPH_EXISTS');
  });
});
