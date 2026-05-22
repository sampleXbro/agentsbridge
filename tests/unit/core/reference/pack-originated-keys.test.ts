/**
 * Branch coverage for src/core/reference/pack-originated-keys.ts:
 * - Lines 22-23: rule.root true vs false (named rule).
 * - Lines 40-41: ruleNameFromSource with non-.md extension.
 * - Non-pack source paths are excluded.
 */

import { describe, it, expect } from 'vitest';
import { buildPackOriginatedKeys } from '../../../../src/core/reference/pack-originated-keys.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function emptyCanonical(): CanonicalFiles {
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

describe('buildPackOriginatedKeys', () => {
  it('returns rules/_root for root rules under packs/', () => {
    const keys = buildPackOriginatedKeys({
      ...emptyCanonical(),
      rules: [
        {
          source: '/proj/.agentsmesh/packs/foo/rules/_root.md',
          name: '_root',
          root: true,
          description: '',
          globs: [],
          body: '',
        },
      ],
    });
    expect(Array.from(keys)).toContain('rules/_root');
  });

  it('returns rules/<name> for non-root rules using filename basename', () => {
    const keys = buildPackOriginatedKeys({
      ...emptyCanonical(),
      rules: [
        {
          source: '/proj/.agentsmesh/packs/foo/rules/style.md',
          name: 'style',
          root: false,
          description: '',
          globs: [],
          body: '',
        },
      ],
    });
    expect(Array.from(keys)).toContain('rules/style');
  });

  it('handles non-.md rule source filenames (no extension strip)', () => {
    const keys = buildPackOriginatedKeys({
      ...emptyCanonical(),
      rules: [
        {
          source: '/proj/.agentsmesh/packs/foo/rules/legacy',
          name: 'legacy',
          root: false,
          description: '',
          globs: [],
          body: '',
        },
      ],
    });
    expect(Array.from(keys)).toContain('rules/legacy');
  });

  it('aggregates keys across agents, commands, and skills', () => {
    const keys = buildPackOriginatedKeys({
      ...emptyCanonical(),
      agents: [
        {
          source: '/proj/.agentsmesh/packs/foo/agents/r.md',
          name: 'r',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: '',
        },
      ],
      commands: [
        {
          source: '/proj/.agentsmesh/packs/foo/commands/build.md',
          name: 'build',
          description: '',
          argumentHint: '',
          allowedTools: [],
          body: '',
        },
      ],
      skills: [
        {
          source: '/proj/.agentsmesh/packs/foo/skills/qa/SKILL.md',
          name: 'qa',
          description: '',
          body: '',
          supportingFiles: [],
        },
      ],
    });
    expect(new Set(keys)).toEqual(new Set(['agents/r', 'commands/build', 'skills/qa']));
  });

  it('excludes entities whose source path is NOT under packs/', () => {
    const keys = buildPackOriginatedKeys({
      ...emptyCanonical(),
      rules: [
        {
          source: '/proj/.agentsmesh/rules/style.md',
          name: 'style',
          root: false,
          description: '',
          globs: [],
          body: '',
        },
      ],
    });
    expect(keys.size).toBe(0);
  });
});
