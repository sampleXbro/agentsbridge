import { describe, expect, it } from 'vitest';
import { renderMerge } from '../../../../src/cli/renderers/merge.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderMerge', () => {
  const output = useCapturedOutput();

  it('prints a no-conflicts message', () => {
    renderMerge({ exitCode: 0, data: { hadConflict: false, resolved: false } });

    expect(output.stdout()).toContain('No conflicts to resolve.');
  });

  it('prints a resolved message when there was a conflict', () => {
    renderMerge({ exitCode: 0, data: { hadConflict: true, resolved: true } });

    expect(output.stdout()).toContain('Lock file conflict resolved.');
  });
});
