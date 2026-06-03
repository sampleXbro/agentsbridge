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

  it('surfaces marketplace sub-pack failures as warnings (no silent partial-install)', () => {
    // Regression for `rsmdt/the-startup --all`: a sub-pack failure left
    // `subPackFailures` populated in the report but the renderer never
    // printed it, so partial marketplace installs looked clean.
    renderInstall({
      exitCode: 0,
      data: {
        source: 'github:org/repo',
        mode: 'install',
        dryRun: false,
        installed: [{ kind: 'skill', name: 'demo', path: '.agentsmesh/skills/demo/SKILL.md' }],
        skipped: [],
        subPackFailures: [
          {
            name: 'org-repo-plugins-team',
            path: 'plugins/team',
            error: 'No supported resources found to install (skills, rules, commands, agents).',
          },
        ],
      },
    });

    expect(output.stderr()).toContain('Sub-pack "org-repo-plugins-team" (plugins/team) failed');
    expect(output.stderr()).toContain('No supported resources');
  });
});
