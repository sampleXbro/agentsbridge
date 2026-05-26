import { describe, expect, it } from 'vitest';
import { classifyRefreshPlan } from '../../../../src/install/refresh/refresh-plan.js';

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
