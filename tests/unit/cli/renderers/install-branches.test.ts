/**
 * Branch coverage for `renderInstall` in `src/cli/renderers/install.ts` —
 * fills in the `brokenResources` (singular/plural) branches and the
 * non-dry-run installed-singular path missed by `install.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { renderInstall } from '../../../../src/cli/renderers/install.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderInstall — extra branches', () => {
  const output = useCapturedOutput();

  it('emits singular installed summary when only one item of one kind is installed', () => {
    renderInstall({
      exitCode: 0,
      data: {
        source: 'pack',
        mode: 'install',
        dryRun: false,
        installed: [{ kind: 'rule', name: 'root', path: '.agentsmesh/rules/root.md' }],
        skipped: [],
      },
    });

    expect(output.stdout()).toContain('Installed 1 rule.');
    expect(output.stdout()).not.toContain('rules.');
  });

  it('warns with singular wording when exactly one broken-resource is present', () => {
    renderInstall({
      exitCode: 0,
      data: {
        source: 'pack',
        mode: 'install',
        dryRun: false,
        installed: [],
        skipped: [],
        brokenResources: [{ path: '.agentsmesh/rules/bad.md', reason: 'invalid frontmatter' }],
      },
    });

    const err = output.stderr();
    expect(err).toContain('Skipped 1 file with invalid frontmatter');
    expect(err).not.toContain('Skipped 1 files');
  });

  it('warns with plural wording when more than one broken-resource is present', () => {
    renderInstall({
      exitCode: 0,
      data: {
        source: 'pack',
        mode: 'install',
        dryRun: false,
        installed: [],
        skipped: [],
        brokenResources: [
          { path: 'a.md', reason: 'bad' },
          { path: 'b.md', reason: 'bad' },
        ],
      },
    });

    expect(output.stderr()).toContain('Skipped 2 files with invalid frontmatter');
  });

  it('still renders an install (non-sync) result with empty installed and skipped (does not early-return)', () => {
    renderInstall({
      exitCode: 0,
      data: {
        source: 'pack',
        mode: 'install',
        dryRun: false,
        installed: [],
        skipped: [],
      },
    });
    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('');
  });
});
