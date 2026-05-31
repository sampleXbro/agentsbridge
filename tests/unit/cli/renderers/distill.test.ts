import { describe, it, expect } from 'vitest';
import { renderDistill } from '../../../../src/cli/renderers/distill.js';
import { useCapturedOutput } from './renderer-test-helpers.js';
import type { DistillCommandResult } from '../../../../src/cli/commands/distill.js';

describe('renderDistill', () => {
  const output = useCapturedOutput();

  it('propose mode — reports nothing to distill when proposalFile is null', () => {
    const result: DistillCommandResult = {
      exitCode: 0,
      data: { mode: 'propose', proposalCount: 0, proposalFile: null },
    };
    renderDistill(result);
    expect(output.stdout()).toContain('No new bullets to distill.');
  });

  it('propose mode — reports the proposal count and next-step hint', () => {
    const result: DistillCommandResult = {
      exitCode: 0,
      data: {
        mode: 'propose',
        proposalCount: 3,
        proposalFile: `${process.cwd()}/.agentsmesh/lessons/distill-proposal.md`,
      },
    };
    renderDistill(result);
    const stdout = output.stdout();
    expect(stdout).toContain('Wrote 3 proposal(s)');
    expect(stdout).toContain('.agentsmesh/lessons/distill-proposal.md');
    expect(stdout).toContain('agentsmesh distill --apply');
  });

  it('apply mode — reports routed + skipped counts', () => {
    const result: DistillCommandResult = {
      exitCode: 0,
      data: { mode: 'apply', routed: 4, skipped: 1 },
    };
    renderDistill(result);
    const stdout = output.stdout();
    expect(stdout).toContain('Applied. 4 bullet(s) routed, 1 skipped.');
    expect(stdout).toContain('author-maintained');
  });

  it('check mode — success path prints success line, no error output', () => {
    const result: DistillCommandResult = {
      exitCode: 0,
      data: { mode: 'check', checked: 205, unrouted: [] },
    };
    renderDistill(result);
    expect(output.stdout()).toContain('all 205 journal bullets routed');
    expect(output.stderr()).toBe('');
  });

  it('check mode — failure path lists every unrouted bullet on stderr', () => {
    const result: DistillCommandResult = {
      exitCode: 1,
      data: {
        mode: 'check',
        checked: 3,
        unrouted: [
          { hash: 'a'.repeat(16), lineNumber: 10, preview: '- **A**: bullet one' },
          { hash: 'b'.repeat(16), lineNumber: 20, preview: '- **B**: bullet two' },
        ],
      },
    };
    renderDistill(result);
    const stderr = output.stderr();
    expect(stderr).toContain('2 unrouted bullet(s)');
    expect(stderr).toContain('L10');
    expect(stderr).toContain('L20');
    expect(output.stdout()).toContain("Run 'agentsmesh distill'");
  });
});
