import { describe, expect, it } from 'vitest';
import { mergeCanonicalFiles } from '../../../src/canonical/load/merge.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function emptyFiles(): CanonicalFiles {
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

describe('mergeCanonicalFiles permissions dedup', () => {
  it('deduplicates repeated allow and deny permissions across extends and local overlays', () => {
    const base: CanonicalFiles = {
      ...emptyFiles(),
      permissions: {
        allow: ['Read', 'Bash(pnpm test:*)', 'Bash(git add:*)'],
        deny: ['WebFetch', 'Bash(curl:*)'],
      },
    };
    const overlay: CanonicalFiles = {
      ...emptyFiles(),
      permissions: {
        allow: ['Bash(pnpm test:*)', 'Bash(git add:*)', 'Bash(pnpm build:*)'],
        deny: ['Bash(curl:*)', 'Read(./secrets/**)'],
      },
    };

    const result = mergeCanonicalFiles(base, overlay);

    expect(result.permissions).toEqual({
      allow: ['Read', 'Bash(pnpm test:*)', 'Bash(git add:*)', 'Bash(pnpm build:*)'],
      deny: ['WebFetch', 'Bash(curl:*)', 'Read(./secrets/**)'],
    });
  });
});
