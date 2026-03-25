import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyExtendPick } from '../../../src/canonical/extend-pick.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { logger } from '../../../src/utils/logger.js';

describe('applyExtendPick', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters skills by pick', () => {
    const c: CanonicalFiles = {
      rules: [],
      commands: [],
      agents: [],
      skills: [
        {
          source: '/a/skills/x/SKILL.md',
          name: 'x',
          description: 'd',
          body: '',
          supportingFiles: [],
        },
        {
          source: '/a/skills/y/SKILL.md',
          name: 'y',
          description: 'd',
          body: '',
          supportingFiles: [],
        },
      ],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };
    const out = applyExtendPick(c, ['skills'], { skills: ['x'] }, 'ext');
    expect(out.skills.map((s) => s.name)).toEqual(['x']);
  });

  it('filters rules by pick with case-insensitive .md stem', () => {
    const c: CanonicalFiles = {
      rules: [
        {
          source: '/p/rules/Doc.MD',
          root: false,
          targets: [],
          description: 'd',
          globs: [],
          body: '',
        },
      ],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };
    const out = applyExtendPick(c, ['rules'], { rules: ['Doc'] }, 'ext');
    expect(out.rules.length).toBe(1);
  });
});
