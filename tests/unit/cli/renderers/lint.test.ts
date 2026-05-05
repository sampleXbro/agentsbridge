import { describe, expect, it } from 'vitest';
import { renderLint } from '../../../../src/cli/renderers/lint.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderLint', () => {
  const output = useCapturedOutput();

  it('prints all-checks-passed for empty diagnostics', () => {
    renderLint({
      exitCode: 0,
      data: { diagnostics: [], summary: { errors: 0, warnings: 0 } },
    });

    expect(output.stdout()).toContain('All checks passed.');
  });

  it('prints errors before warnings and uses singular counts', () => {
    renderLint({
      exitCode: 1,
      data: {
        diagnostics: [
          { level: 'warning', file: 'rules/a.md', target: 'cursor', message: 'warn first' },
          { level: 'error', file: 'rules/b.md', target: 'claude-code', message: 'error second' },
        ],
        summary: { errors: 1, warnings: 1 },
      },
    });

    const stderr = output.stderr();
    expect(stderr.indexOf('rules/b.md')).toBeLessThan(stderr.indexOf('rules/a.md'));
    expect(stderr).toContain('rules/b.md (claude-code): error second');
    expect(stderr).toContain('rules/a.md (cursor): warn first');
    expect(output.stdout()).toContain('1 error, 1 warning');
  });

  it('pluralizes non-singular error and warning totals', () => {
    renderLint({
      exitCode: 1,
      data: {
        diagnostics: [
          { level: 'error', file: 'a.md', target: 'codex-cli', message: 'one' },
          { level: 'error', file: 'b.md', target: 'codex-cli', message: 'two' },
        ],
        summary: { errors: 2, warnings: 0 },
      },
    });

    expect(output.stdout()).toContain('2 errors, 0 warnings');
  });
});
