import { describe, expect, it } from 'vitest';
import { renderCheck } from '../../../../src/cli/renderers/check.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderCheck', () => {
  const output = useCapturedOutput();

  it('prints a missing lock message', () => {
    renderCheck({
      exitCode: 1,
      data: {
        hasLock: false,
        canonicalDrift: false,
        outputDrift: false,
        inSync: false,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputModified: [],
        outputRemoved: [],
        outputStale: [],
      },
    });

    expect(output.stderr()).toContain("Run 'agentsmesh generate' first");
  });

  it('prints an in-sync success message for both drift checks', () => {
    renderCheck({
      exitCode: 0,
      data: {
        hasLock: true,
        canonicalDrift: false,
        outputDrift: false,
        inSync: true,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputModified: [],
        outputRemoved: [],
        outputStale: [],
      },
    });

    expect(output.stdout()).toContain('Lock file is in sync; generated outputs are in sync.');
  });

  it('prints every canonical conflict bucket and marks only locked violations', () => {
    renderCheck({
      exitCode: 1,
      data: {
        hasLock: true,
        canonicalDrift: true,
        outputDrift: false,
        inSync: false,
        extendsModified: ['pack-a'],
        modified: ['rules/root.md', 'rules/open.md'],
        added: ['commands/deploy.md', 'commands/open.md'],
        removed: ['skills/old/SKILL.md', 'skills/open/SKILL.md'],
        lockedViolations: ['rules/root.md', 'commands/deploy.md', 'skills/old/SKILL.md'],
        outputModified: [],
        outputRemoved: [],
        outputStale: [],
      },
    });

    const errors = output.stderr();
    expect(errors).toContain('Conflict detected:');
    expect(errors).toContain('extend "pack-a" was modified');
    expect(errors).toContain('rules/root.md was modified [LOCKED]');
    expect(errors).toContain('rules/open.md was modified\n');
    expect(errors).toContain('commands/deploy.md was added [LOCKED]');
    expect(errors).toContain('commands/open.md was added\n');
    expect(errors).toContain('skills/old/SKILL.md was removed [LOCKED]');
    expect(errors).toContain('skills/open/SKILL.md was removed\n');
    expect(output.stdout()).toContain("Run 'agentsmesh merge' to resolve");
  });

  it('prints modified, missing, and stale generated outputs with the regeneration fix', () => {
    renderCheck({
      exitCode: 1,
      data: {
        hasLock: true,
        canonicalDrift: false,
        outputDrift: true,
        inSync: false,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputModified: ['CLAUDE.md'],
        outputRemoved: ['.cursor/rules/general.mdc'],
        outputStale: ['.cursor/rules/orphaned.mdc'],
      },
    });

    const errors = output.stderr();
    expect(errors).toContain('Generated output drift detected:');
    expect(errors).toContain('CLAUDE.md was modified');
    expect(errors).toContain('.cursor/rules/general.mdc is missing');
    expect(errors).toContain('.cursor/rules/orphaned.mdc is stale (no longer generated)');
    expect(output.stdout()).toContain("Run 'agentsmesh generate' and commit the updated outputs.");
  });
});
