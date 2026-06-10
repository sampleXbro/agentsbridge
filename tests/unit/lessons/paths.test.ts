import { describe, it, expect } from 'vitest';
import { lessonsPaths, toRelPath, LESSONS_PROCEDURAL_RULE } from '../../../src/lessons/paths.js';
import { toPosixPath } from '../../helpers/posix-path.js';

describe('lessonsPaths', () => {
  it('derives the canonical graph + legacy migrator paths under .agentsmesh/lessons/', () => {
    const p = lessonsPaths('/proj');
    expect(toPosixPath(p.base)).toBe('/proj/.agentsmesh/lessons');
    expect(toPosixPath(p.graph)).toBe('/proj/.agentsmesh/lessons/lessons.json');
    // Legacy paths are exposed only so the one-shot migrator can read them.
    expect(toPosixPath(p.journal)).toBe('/proj/.agentsmesh/lessons/journal.md');
    expect(toPosixPath(p.index)).toBe('/proj/.agentsmesh/lessons/index.yaml');
    expect(toPosixPath(p.topicsDir)).toBe('/proj/.agentsmesh/lessons/topics');
  });
});

describe('toRelPath', () => {
  it('returns project-relative forward-slash path', () => {
    expect(toRelPath('/proj', '/proj/.agentsmesh/lessons/lessons.json')).toBe(
      '.agentsmesh/lessons/lessons.json',
    );
  });
});

describe('LESSONS_PROCEDURAL_RULE', () => {
  it('declares both Recall and Capture rituals as non-negotiable', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('Recall');
    expect(LESSONS_PROCEDURAL_RULE).toContain('Capture');
    expect(LESSONS_PROCEDURAL_RULE).toContain('process violation');
    expect(LESSONS_PROCEDURAL_RULE).toContain('MUST');
  });

  it('names both CLI primitives so the agent has the exact recall + capture commands', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('agentsmesh lessons query --file');
    expect(LESSONS_PROCEDURAL_RULE).toContain('agentsmesh lessons add');
  });

  it('delegates the expansive manual to the lessons skill rather than inlining it', () => {
    // Tier 1 is the minimal always-on trigger; the full how-to (command set,
    // topic workflow, trigger-flag mechanics, exhaustive excuse list) lives in
    // the `lessons` skill so it can grow without bloating always-on context.
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/`lessons` skill/);
    expect(LESSONS_PROCEDURAL_RULE).not.toContain('import-md');
    expect(LESSONS_PROCEDURAL_RULE).not.toContain('deprecate');
    expect(LESSONS_PROCEDURAL_RULE).not.toContain('--trigger-cmd');
    expect(LESSONS_PROCEDURAL_RULE).not.toContain('--trigger-kw');
  });

  it('closes the read-only / just-investigating loophole so recall fires on every command', () => {
    // The exact rationalization that lets an agent skip recall during a
    // "read-only" investigation. Naming it (and confirming git/test/coverage
    // still count) is the highest-value recall tweak.
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/read-only/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/still count/i);
  });

  it('defines a failure broadly — a user correction or self-noticed mistake counts, not just red tests', () => {
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/user correction/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/not limited to/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/had to redo|surprised|wrong assumption/i);
  });

  it('names the canonical graph path so init scaffolding stays consistent', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('.agentsmesh/lessons/lessons.json');
  });

  it('directs the agent at the CLI primitives, not at hand-editing files', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('agentsmesh lessons query');
    expect(LESSONS_PROCEDURAL_RULE).toContain('agentsmesh lessons add');
  });

  it('uses tool-agnostic action verbs so the rule works in any harness', () => {
    // Universal verbs the agent can map to its own toolset.
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/file edit/);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/shell command/);
  });

  it('keeps the forcing language that turns the rule binding rather than advisory', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('BLOCKING REQUIREMENT');
    expect(LESSONS_PROCEDURAL_RULE).toContain('no exceptions');
    expect(LESSONS_PROCEDURAL_RULE).toContain('the user will check');
    expect(LESSONS_PROCEDURAL_RULE).toContain('the system does not exist');
  });

  it('does NOT bake in any Claude Code-specific tool names as required actions', () => {
    // These would couple the rule to one harness. Codex (apply_patch / shell),
    // Cline (write_to_file / replace_in_file / execute_command), Cursor (IDE),
    // Gemini CLI, Aider, Goose, etc. all use different tool names.
    expect(LESSONS_PROCEDURAL_RULE).not.toMatch(/\bEdit\b/);
    expect(LESSONS_PROCEDURAL_RULE).not.toMatch(/\bWrite\b/);
    expect(LESSONS_PROCEDURAL_RULE).not.toMatch(/\bBash\b/);
  });

  it('does NOT reference any package-manager-specific tooling (universal across targets)', () => {
    expect(LESSONS_PROCEDURAL_RULE).not.toMatch(/pnpm /);
    expect(LESSONS_PROCEDURAL_RULE).not.toMatch(/npm run/);
    expect(LESSONS_PROCEDURAL_RULE).not.toMatch(/agentsmesh distill/);
  });
});
