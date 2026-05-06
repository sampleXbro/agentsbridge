import { describe, expect, it } from 'vitest';
import { renderInstall } from '../../../../src/cli/renderers/install.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderInstall', () => {
  const output = useCapturedOutput();

  it('emits nothing for an empty sync result', () => {
    renderInstall({
      exitCode: 0,
      data: { source: '', mode: 'sync', installed: [], skipped: [], dryRun: false },
    });

    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('');
  });

  it('summarizes installed kinds with singular and plural counts', () => {
    renderInstall({
      exitCode: 0,
      data: {
        source: 'pack',
        mode: 'install',
        dryRun: false,
        installed: [
          { kind: 'rule', name: 'root', path: '.agentsmesh/rules/root.md' },
          { kind: 'skill', name: 'a', path: '.agentsmesh/skills/a/SKILL.md' },
          { kind: 'skill', name: 'b', path: '.agentsmesh/skills/b/SKILL.md' },
        ],
        skipped: [],
      },
    });

    expect(output.stdout()).toContain('Installed 1 rule, 2 skills.');
  });

  it('suppresses installed summary during dry-run but still prints skipped items', () => {
    renderInstall({
      exitCode: 0,
      data: {
        source: 'pack',
        mode: 'install',
        dryRun: true,
        installed: [{ kind: 'rule', name: 'root', path: '.agentsmesh/rules/root.md' }],
        skipped: [{ kind: 'skill', name: 'existing', reason: 'already exists' }],
      },
    });

    expect(output.stdout()).not.toContain('Installed');
    expect(output.stderr()).toContain('Skipped skill "existing": already exists');
  });
});
