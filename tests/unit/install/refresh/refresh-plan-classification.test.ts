import { describe, expect, it } from 'vitest';
import { classifyRefreshPlan } from '../../../../src/install/refresh/refresh-plan.js';
import type {
  RefreshCommandResult,
  RefreshedItem,
  UnchangedItem,
  SkippedItem,
  FailedItem,
} from '../../../../src/install/refresh/refresh-plan.js';

/**
 * Type-only smoke check: assert the Phase 4 result vocabulary compiles.
 * Remove once Phase 5+ orchestrator consumes these types directly.
 */
function _resultTypeChecks(): void {
  const _r: RefreshedItem = {
    name: 'p',
    oldRef: null,
    newRef: 'main',
    oldSha: null,
    newSha: 'abc',
    changedFiles: { added: [], removed: [], modified: [] },
  };
  const _u: UnchangedItem = { name: 'p', ref: 'main' };
  const _s: SkippedItem = { name: 'p', reason: 'user-declined' };
  const _f: FailedItem = { name: 'p', phase: 'plan', error: 'oops' };
  const _rc: RefreshCommandResult = {
    exitCode: 0,
    data: {
      scope: 'project',
      mode: 'refresh',
      refreshed: [_r],
      unchanged: [_u],
      skipped: [_s],
      failed: [_f],
      dryRun: false,
    },
  };
  void _rc;
}
void _resultTypeChecks;

describe('classifyRefreshPlan', () => {
  it('returns "unchanged" when no drift and SHAs equal', () => {
    expect(classifyRefreshPlan({ modifications: [], oldSha: 'abc', newSha: 'abc' })).toBe(
      'unchanged',
    );
  });

  it('returns "clean-update" when no drift but SHA differs', () => {
    expect(classifyRefreshPlan({ modifications: [], oldSha: 'abc', newSha: 'def' })).toBe(
      'clean-update',
    );
  });

  it('returns "needs-consent" when drift is present', () => {
    expect(
      classifyRefreshPlan({
        modifications: [{ relativePath: 'skills/x/SKILL.md', status: 'modified' }],
        oldSha: 'abc',
        newSha: 'def',
      }),
    ).toBe('needs-consent');
  });

  it('returns "needs-consent" even when SHAs match if drift exists', () => {
    // Local edits matter even if upstream hasn't moved
    expect(
      classifyRefreshPlan({
        modifications: [{ relativePath: 'rules/r.md', status: 'modified' }],
        oldSha: 'abc',
        newSha: 'abc',
      }),
    ).toBe('needs-consent');
  });
});
