import { describe, expect, it } from 'vitest';
import { renderConvert } from '../../../../src/cli/renderers/convert.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderConvert', () => {
  const output = useCapturedOutput();

  it('prints nothing-to-convert message when no files', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'convert',
        files: [],
        summary: { created: 0, updated: 0, unchanged: 0 },
      },
    });

    expect(output.stdout()).toContain('No files found to convert from claude-code');
  });

  it('prints created/updated files and summary', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'convert',
        files: [
          { path: '.cursor/rules/root.mdc', target: 'cursor', status: 'created' },
          { path: '.cursor/rules/ts.mdc', target: 'cursor', status: 'updated' },
        ],
        summary: { created: 1, updated: 1, unchanged: 0 },
      },
    });

    const out = output.stdout();
    expect(out).toContain('created .cursor/rules/root.mdc');
    expect(out).toContain('updated .cursor/rules/ts.mdc');
    expect(out).toContain('Converted from claude-code');
    expect(out).toContain('cursor');
    expect(out).toContain('1 created');
    expect(out).toContain('1 updated');
  });

  it('prefixes lines with [dry-run] in dry-run mode', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'dry-run',
        files: [{ path: '.cursor/rules/root.mdc', target: 'cursor', status: 'created' }],
        summary: { created: 1, updated: 0, unchanged: 0 },
      },
    });

    const out = output.stdout();
    expect(out).toContain('[dry-run]');
    expect(out).toContain('created');
    expect(out).toContain('.cursor/rules/root.mdc');
    expect(out).toContain('cursor');
  });

  it('skips unchanged files in normal mode', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'convert',
        files: [{ path: '.cursor/rules/root.mdc', target: 'cursor', status: 'unchanged' }],
        summary: { created: 0, updated: 0, unchanged: 1 },
      },
    });

    const out = output.stdout();
    expect(out).not.toContain('.cursor/rules/root.mdc');
    expect(out).toContain('Nothing changed');
  });
});
