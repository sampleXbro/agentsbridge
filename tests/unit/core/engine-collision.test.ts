import { describe, expect, it } from 'vitest';
import {
  refreshResultStatus,
  resolveOutputCollisions,
} from '../../../src/core/generate/collision.js';
import type { GenerateResult } from '../../../src/core/types.js';

function makeResult(overrides: Partial<GenerateResult> = {}): GenerateResult {
  return {
    target: 'claude-code',
    path: '.claude/CLAUDE.md',
    content: '# Root',
    status: 'created',
    ...overrides,
  };
}

describe('engine collision helpers', () => {
  it('keeps the highest-ranked status when deduplicating identical outputs', () => {
    const results = resolveOutputCollisions([
      makeResult({ status: 'unchanged', currentContent: '# Root' }),
      makeResult({ status: 'updated', currentContent: '# Old root' }),
      makeResult({ status: 'skipped' }),
    ]);

    expect(results).toEqual([
      makeResult({
        status: 'updated',
        currentContent: '# Old root',
      }),
    ]);
  });

  it('refreshes created, updated, and unchanged statuses from current content', () => {
    expect(refreshResultStatus(makeResult())).toEqual(makeResult({ status: 'created' }));
    expect(
      refreshResultStatus(makeResult({ currentContent: '# Old root', status: 'created' })),
    ).toEqual(makeResult({ currentContent: '# Old root', status: 'updated' }));
    expect(
      refreshResultStatus(makeResult({ currentContent: '# Root', status: 'updated' })),
    ).toEqual(makeResult({ currentContent: '# Root', status: 'unchanged' }));
  });

  it('preserves existing currentContent when a higher-ranked duplicate omits it', () => {
    const results = resolveOutputCollisions([
      makeResult({ status: 'unchanged', currentContent: '# Root' }),
      makeResult({ status: 'created' }),
    ]);

    expect(results).toEqual([
      makeResult({
        status: 'created',
        currentContent: '# Root',
      }),
    ]);
  });
});
