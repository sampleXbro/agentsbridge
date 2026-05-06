import { describe, expect, it } from 'vitest';
import { renderDiff } from '../../../../src/cli/renderers/diff.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderDiff', () => {
  const output = useCapturedOutput();

  it('prints a no-files message when there is no diffable output', () => {
    renderDiff({
      exitCode: 0,
      data: {
        files: [],
        patches: [],
        summary: { created: 0, updated: 0, unchanged: 0, deleted: 0 },
      },
    });

    expect(output.stdout()).toContain('No files to generate');
  });

  it('writes every patch before the summary', () => {
    renderDiff({
      exitCode: 0,
      data: {
        files: [{ path: 'AGENTS.md', target: 'codex-cli', status: 'updated' }],
        patches: [
          { path: 'AGENTS.md', patch: 'patch-one\n' },
          { path: 'README.md', patch: 'patch-two\n' },
        ],
        summary: { created: 1, updated: 1, unchanged: 2, deleted: 0 },
      },
    });

    const stdout = output.stdout();
    expect(stdout.indexOf('patch-one')).toBeLessThan(stdout.indexOf('1 files would be created'));
    expect(stdout.indexOf('patch-two')).toBeLessThan(stdout.indexOf('1 files would be created'));
    expect(stdout).toContain('1 files would be created, 1 updated, 2 unchanged, 0 deleted');
  });

  it('prints a summary when only deletions changed the total', () => {
    renderDiff({
      exitCode: 0,
      data: {
        files: [{ path: 'old.md', target: 'codex-cli', status: 'deleted' }],
        patches: [],
        summary: { created: 0, updated: 0, unchanged: 0, deleted: 1 },
      },
    });

    expect(output.stdout()).toContain(
      '0 files would be created, 0 updated, 0 unchanged, 1 deleted',
    );
  });
});
