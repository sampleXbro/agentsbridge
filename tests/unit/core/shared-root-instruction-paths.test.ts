import { describe, expect, it } from 'vitest';
import { computeSharedRootInstructionPaths } from '../../../src/core/generate/engine.js';
import type { GenerateResult } from '../../../src/core/types.js';

function r(target: string, path: string, content = ''): GenerateResult {
  return { target, path, content, status: 'created' };
}

describe('computeSharedRootInstructionPaths', () => {
  it('returns empty set for empty results', () => {
    expect(computeSharedRootInstructionPaths([], 'project').size).toBe(0);
  });

  it('returns empty set when only one target emits a root-instruction path', () => {
    const shared = computeSharedRootInstructionPaths([r('amp', 'AGENTS.md')], 'project');
    expect(shared.size).toBe(0);
  });

  it('marks AGENTS.md as shared when multiple primary-root targets emit it', () => {
    const shared = computeSharedRootInstructionPaths(
      [r('amp', 'AGENTS.md'), r('factory-droid', 'AGENTS.md'), r('jules', 'AGENTS.md')],
      'project',
    );
    expect([...shared]).toEqual(['AGENTS.md']);
  });

  it('marks AGENTS.md as shared when one target uses it as primary and another as compat', () => {
    // windsurf: rootInstructionPath = 'AGENTS.md' (primary)
    // gemini-cli: rootInstructionPath = 'GEMINI.md', AGENTS.md in outputFamilies (compat)
    const shared = computeSharedRootInstructionPaths(
      [r('windsurf', 'AGENTS.md'), r('gemini-cli', 'AGENTS.md')],
      'project',
    );
    expect([...shared]).toEqual(['AGENTS.md']);
  });

  it('marks AGENTS.md as shared when two compat-only targets emit it (no primary)', () => {
    // cursor and gemini-cli both emit AGENTS.md as compat (additional output family)
    const shared = computeSharedRootInstructionPaths(
      [r('cursor', 'AGENTS.md'), r('gemini-cli', 'AGENTS.md')],
      'project',
    );
    expect([...shared]).toEqual(['AGENTS.md']);
  });

  it('does not mark content-file paths as shared even when emitted by 2+ targets', () => {
    // .agents/skills/X/SKILL.md is a content file (Codex owner + amp consumer mirror).
    // It is NOT a root-instruction path for either target, so it must be rewritten normally.
    const shared = computeSharedRootInstructionPaths(
      [
        r('codex-cli', '.agents/skills/api-gen/SKILL.md'),
        r('amp', '.agents/skills/api-gen/SKILL.md'),
      ],
      'project',
    );
    expect(shared.size).toBe(0);
  });

  it('does not mark a path emitted by 2+ targets as shared if neither treats it as root', () => {
    // Hypothetical: two targets both emit a settings file at the same path.
    // Not a root-instruction path → not shared.
    const shared = computeSharedRootInstructionPaths(
      [r('amp', '.somefile.json'), r('factory-droid', '.somefile.json')],
      'project',
    );
    expect(shared.size).toBe(0);
  });

  it('ignores root-path emissions from targets without any rootInstructionPath layout', () => {
    // An unknown target ID has no layout → returns empty root-path set → never shared.
    const shared = computeSharedRootInstructionPaths(
      [r('definitely-not-a-real-target', 'AGENTS.md'), r('amp', 'AGENTS.md')],
      'project',
    );
    expect(shared.size).toBe(0); // amp is alone among recognized root emitters
  });

  it('separately tracks shared paths per output (multiple shared paths)', () => {
    // amp + factory-droid share AGENTS.md as primary;
    // claude-code emits root CLAUDE.md alone (not shared);
    // codex-cli + windsurf both write AGENTS.md (shared).
    const shared = computeSharedRootInstructionPaths(
      [
        r('amp', 'AGENTS.md'),
        r('factory-droid', 'AGENTS.md'),
        r('claude-code', 'CLAUDE.md'),
        r('codex-cli', 'AGENTS.md'),
        r('windsurf', 'AGENTS.md'),
      ],
      'project',
    );
    expect([...shared]).toEqual(['AGENTS.md']);
  });

  it('respects scope: project vs global layouts may differ in root paths', () => {
    // gemini-cli project: rootInstructionPath = GEMINI.md, compat AGENTS.md
    // gemini-cli global: rootInstructionPath = ~/.gemini/GEMINI.md, compat .gemini/AGENTS.md
    // A "AGENTS.md" emission in global scope is NOT a gemini-cli root-instruction path.
    const sharedGlobal = computeSharedRootInstructionPaths(
      [r('gemini-cli', 'AGENTS.md'), r('amp', 'AGENTS.md')],
      'global',
    );
    expect(sharedGlobal.size).toBe(0);
  });

  it('does not mark single-target compat emission as shared', () => {
    // Only gemini-cli emits AGENTS.md (its compat). No other target writes there.
    const shared = computeSharedRootInstructionPaths(
      [r('gemini-cli', 'AGENTS.md'), r('gemini-cli', 'GEMINI.md')],
      'project',
    );
    expect(shared.size).toBe(0);
  });

  it('counts a target only once even when multiple results land at the same root path', () => {
    // Pathological: same target emits the same root path twice. Should not be marked shared.
    const shared = computeSharedRootInstructionPaths(
      [r('amp', 'AGENTS.md'), r('amp', 'AGENTS.md')],
      'project',
    );
    expect(shared.size).toBe(0);
  });
});
