/**
 * Bare-path tokens in canonical bodies (e.g. `SPEC.md` mentioned in prose)
 * must not be rewritten to a canonical-relative path when the on-disk file
 * is lowercase (`spec.md`). On macOS / Windows the FS resolves case-
 * insensitively, which previously fooled the link rebaser into committing
 * a "savedFallback" canonical path — leaking `../../.agentsmesh/.../SPEC.md`
 * into generated `.claude/commands/`, `.gemini/commands/`, etc.
 *
 * The fix swapped `existsSync` → `existsWithExactCase` in the rewriter's
 * `pathExists` callback, so the case-mismatched candidate is treated as
 * non-existent on every platform. This test pins that behavior end-to-end
 * by driving `rewriteGeneratedReferences` against a fixture with the
 * exact case mismatch.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rewriteGeneratedReferences } from '../../../src/core/reference/rewriter.js';
import type { CanonicalFiles, GenerateResult } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const ROOT = join(tmpdir(), 'am-rewriter-case-mismatch');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(join(ROOT, '.agentsmesh', 'commands'), { recursive: true });
  // Canonical command is lowercase `spec.md` on disk.
  writeFileSync(
    join(ROOT, '.agentsmesh', 'commands', 'spec.md'),
    '---\ndescription: spec\n---\n# spec\n',
  );
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('rewriteGeneratedReferences — case-mismatched bare tokens', () => {
  it('leaves `SPEC.md` (uppercase prose mention) untouched when the file is `spec.md`', () => {
    const canonical: CanonicalFiles = {
      rules: [
        {
          source: join(ROOT, '.agentsmesh', 'rules', '_root.md'),
          root: true,
          targets: [],
          description: 'r',
          globs: [],
          body: '# Root',
        },
      ],
      commands: [
        {
          source: join(ROOT, '.agentsmesh', 'commands', 'planning.md'),
          name: 'planning',
          description: 'Plan work',
          allowedTools: [],
          outputStyle: false,
          // Body mentions SPEC.md in prose — documentary token, not a real link.
          body: 'Read the existing spec (SPEC.md or equivalent) before planning.\n',
        },
      ],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };

    const config = {
      targets: ['claude-code'],
      features: ['commands'],
    } as unknown as ValidatedConfig;

    // Emulate the generator's output for the `planning` command.
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/commands/planning.md',
        content:
          '---\ndescription: Plan work\n---\nRead the existing spec (SPEC.md or equivalent) before planning.\n',
        status: 'created' as const,
      },
    ];

    const rewritten = rewriteGeneratedReferences(results, canonical, config, ROOT);
    const body = rewritten[0]!.content;

    // The buggy behavior emitted `../../.agentsmesh/commands/SPEC.md` here.
    expect(body).not.toContain('.agentsmesh/commands/SPEC.md');
    expect(body).not.toContain('.agentsmesh/commands/spec.md');
    // The token is left as the original `SPEC.md` (no rewrite — file not found at exact case).
    expect(body).toContain('(SPEC.md or equivalent)');
  });
});
