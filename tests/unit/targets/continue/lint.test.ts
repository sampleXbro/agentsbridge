/**
 * Tests for continue-specific lint hooks.
 * Covers lintCommands (both branches) and confirms that the module no longer
 * exports lintIgnore (ignore is native — generation handles it; no lint warning).
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import * as continueLint from '../../../../src/targets/continue/lint.js';

function baseCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('lintCommands (continue)', () => {
  it('returns [] when no commands have allowedTools', () => {
    const canonical: CanonicalFiles = {
      ...baseCanonical(),
      commands: [
        {
          source: '/x/commands/deploy.md',
          name: 'deploy',
          description: 'Deploy',
          argumentHint: '',
          allowedTools: [],
          body: 'Deploy.',
        },
      ],
    };
    expect(continueLint.lintCommands(canonical)).toEqual([]);
  });

  it('returns one warning per command that has allowedTools', () => {
    const canonical: CanonicalFiles = {
      ...baseCanonical(),
      commands: [
        {
          source: '/x/commands/review.md',
          name: 'review',
          description: 'Review',
          argumentHint: '',
          allowedTools: ['Read', 'Bash(git diff)'],
          body: 'Review it.',
        },
      ],
    };
    const diags = continueLint.lintCommands(canonical);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.level).toBe('warning');
  });

  it('returns warnings for each command that has allowedTools (multiple)', () => {
    const canonical: CanonicalFiles = {
      ...baseCanonical(),
      commands: [
        {
          source: '/x/commands/a.md',
          name: 'a',
          description: '',
          argumentHint: '',
          allowedTools: ['Read'],
          body: 'a',
        },
        {
          source: '/x/commands/b.md',
          name: 'b',
          description: '',
          argumentHint: '',
          allowedTools: ['Bash'],
          body: 'b',
        },
      ],
    };
    const diags = continueLint.lintCommands(canonical);
    expect(diags).toHaveLength(2);
  });
});

describe('lintIgnore (continue) — module contract', () => {
  it('does not export lintIgnore (ignore is native — no lint warning needed)', () => {
    expect((continueLint as Record<string, unknown>)['lintIgnore']).toBeUndefined();
  });
});
