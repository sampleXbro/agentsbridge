/**
 * Branch coverage for `src/targets/gemini-cli/command-namespace.ts`.
 * The file has two helpers — convert canonical command name to nested
 * `.toml` path and back. Lines 28-31 (the round-trip helper plus the
 * `parts.length > 0` ternary edge in the forward helper) are unhit by
 * existing tests.
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalCommandNameToGeminiTomlPath,
  geminiTomlPathToCanonicalCommandName,
} from '../../../../src/targets/gemini-cli/command-namespace.js';

describe('canonicalCommandNameToGeminiTomlPath', () => {
  it('maps a flat name to a single .toml file', () => {
    expect(canonicalCommandNameToGeminiTomlPath('commit', '.gemini/commands')).toBe(
      '.gemini/commands/commit.toml',
    );
  });
  it('maps a colon-namespaced name to a nested .toml path', () => {
    expect(canonicalCommandNameToGeminiTomlPath('git:commit', '.gemini/commands')).toBe(
      '.gemini/commands/git/commit.toml',
    );
  });
  it('drops empty segments produced by repeated colons', () => {
    expect(canonicalCommandNameToGeminiTomlPath('git::push', '.gemini/commands')).toBe(
      '.gemini/commands/git/push.toml',
    );
  });
  it('falls back to the raw name when split produces no segments', () => {
    expect(canonicalCommandNameToGeminiTomlPath('', '.gemini/commands')).toBe(
      '.gemini/commands/.toml',
    );
  });
});

describe('geminiTomlPathToCanonicalCommandName', () => {
  it('round-trips a single-file command path to its canonical name', () => {
    expect(
      geminiTomlPathToCanonicalCommandName(
        '/abs/.gemini/commands/commit.toml',
        '/abs/.gemini/commands',
      ),
    ).toBe('commit');
  });
  it('round-trips a nested command path to a colon-namespaced canonical name', () => {
    expect(
      geminiTomlPathToCanonicalCommandName(
        '/abs/.gemini/commands/git/commit.toml',
        '/abs/.gemini/commands',
      ),
    ).toBe('git:commit');
  });
  it('strips the .md extension as well as .toml', () => {
    expect(
      geminiTomlPathToCanonicalCommandName(
        '/abs/.gemini/commands/git/commit.md',
        '/abs/.gemini/commands',
      ),
    ).toBe('git:commit');
  });
});
