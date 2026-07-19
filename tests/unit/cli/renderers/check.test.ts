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
        inSync: false,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputsModified: [],
        outputsRemoved: [],
        outputsChecked: false,
      },
    });

    expect(output.stderr()).toContain("Run 'agentsmesh generate' first");
  });

  it('prints an in-sync success message', () => {
    renderCheck({
      exitCode: 0,
      data: {
        hasLock: true,
        inSync: true,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputsModified: [],
        outputsRemoved: [],
        outputsChecked: true,
      },
    });

    expect(output.stdout()).toContain('Lock file is in sync.');
  });

  it('prints every conflict bucket and marks only locked violations', () => {
    renderCheck({
      exitCode: 1,
      data: {
        hasLock: true,
        inSync: false,
        extendsModified: ['pack-a'],
        modified: ['rules/root.md', 'rules/open.md'],
        added: ['commands/deploy.md', 'commands/open.md'],
        removed: ['skills/old/SKILL.md', 'skills/open/SKILL.md'],
        lockedViolations: ['rules/root.md', 'commands/deploy.md', 'skills/old/SKILL.md'],
        outputsModified: [],
        outputsRemoved: [],
        outputsChecked: true,
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

  it('renders generated-output drift with forward-slash paths', () => {
    renderCheck({
      exitCode: 1,
      data: {
        hasLock: true,
        inSync: false,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputsModified: ['.cursor/rules/_root.mdc', 'AGENTS.md'],
        outputsRemoved: ['.claude/CLAUDE.md'],
        outputsChecked: true,
      },
    });

    const errors = output.stderr();
    expect(errors).toContain('Conflict detected:');
    expect(errors).toContain('generated output ".cursor/rules/_root.mdc" was modified');
    expect(errors).toContain('generated output "AGENTS.md" was modified');
    expect(errors).toContain('generated output ".claude/CLAUDE.md" was removed');
    // Forward slashes only — never backslashes.
    expect(errors).not.toContain('\\');
  });

  it('notes skipped output verification when hasLock but outputsChecked is false', () => {
    renderCheck({
      exitCode: 0,
      data: {
        hasLock: true,
        inSync: true,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputsModified: [],
        outputsRemoved: [],
        outputsChecked: false,
      },
    });

    expect(output.stdout()).toContain('Generated-output verification skipped');
    expect(output.stdout()).toContain('agentsmesh generate');
  });

  it('does not print the skipped-verification note when outputsChecked is true', () => {
    renderCheck({
      exitCode: 0,
      data: {
        hasLock: true,
        inSync: true,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputsModified: [],
        outputsRemoved: [],
        outputsChecked: true,
      },
    });

    expect(output.stdout()).not.toContain('Generated-output verification skipped');
  });
});
