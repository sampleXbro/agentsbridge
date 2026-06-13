import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force loadLessonsGraph to throw a NON-Error value so the diagnostic message
// path that stringifies a non-Error (`String(err)`) is exercised. Errors thrown
// in practice (ENOENT, SyntaxError, ZodError) are all `Error` instances, so this
// defensive branch is otherwise unreachable from real inputs.
vi.mock('../../../../src/lessons/graph-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lessons/graph-store.js')>();
  return {
    ...actual,
    loadLessonsGraph: () => {
      throw 'not-an-error-object';
    },
  };
});

import { lintLessonsSubsystem } from '../../../../src/core/lint/shared/lessons.js';

let ROOT: string;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'agentsmesh-lessons-lint-err-'));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('lintLessonsSubsystem — non-Error load failure', () => {
  it('stringifies a non-Error throw into the diagnostic message', () => {
    const graphRel = '.agentsmesh/lessons/lessons.json';
    const abs = join(ROOT, graphRel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, '{}', 'utf8'); // present, so the load is attempted (then throws a string)

    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ level: 'error', file: graphRel, target: 'lessons' });
    expect(diags[0]!.message).toContain('not-an-error-object');
  });
});
