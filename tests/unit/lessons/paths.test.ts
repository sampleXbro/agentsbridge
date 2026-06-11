import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  ancestorAgentsmeshDir,
  lessonsActivated,
  lessonsPaths,
  toRelPath,
  LESSONS_PROCEDURAL_RULE,
} from '../../../src/lessons/paths.js';
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

describe('ancestorAgentsmeshDir', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'amesh-ancestor-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns null when no ancestor holds a .agentsmesh directory', () => {
    const sub = join(root, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    expect(ancestorAgentsmeshDir(sub)).toBeNull();
  });

  it('finds the nearest ancestor that holds .agentsmesh', () => {
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
    const sub = join(root, 'pkg', 'src');
    mkdirSync(sub, { recursive: true });
    expect(ancestorAgentsmeshDir(sub)).toBe(root);
  });

  it('ignores a .agentsmesh at the start dir itself (only ancestors count)', () => {
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
    expect(ancestorAgentsmeshDir(root)).toBeNull();
  });
});

describe('lessonsActivated', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'amesh-activated-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('is false when there is no lessons config (graph-only bootstrap or no init --lessons)', () => {
    mkdirSync(join(root, '.agentsmesh/lessons'), { recursive: true });
    writeFileSync(join(root, '.agentsmesh/lessons/lessons.json'), '{}');
    expect(lessonsActivated(root)).toBe(false);
  });

  it('is true once config.json exists (init --lessons / scaffoldLessons seeded it)', () => {
    mkdirSync(join(root, '.agentsmesh/lessons'), { recursive: true });
    writeFileSync(join(root, '.agentsmesh/lessons/config.json'), '{"recallLimit":10}');
    expect(lessonsActivated(root)).toBe(true);
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
  it('declares both Recall and Capture rituals under a BLOCKING header', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('Recall');
    expect(LESSONS_PROCEDURAL_RULE).toContain('Capture');
    expect(LESSONS_PROCEDURAL_RULE).toContain('BLOCKING');
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

  it('scopes recall to mutating actions and exempts pure-read commands + the query itself', () => {
    // Phase 1: recall fires before edits and STATE-CHANGING commands only.
    // Pure reads (cat/ls/grep/git-log) and the recall command itself are exempt
    // — removing the infinite regress and the most-flouted "read-only" clause.
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/state-changing command/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/exempt/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/pure[- ]read/i);
  });

  it('defines a failure broadly — a user correction or wrong assumption counts, not just red tests', () => {
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/user correction/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/regression/i);
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/wrong assumption/i);
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
    expect(LESSONS_PROCEDURAL_RULE).toMatch(/command/);
  });

  it('keeps a forceful BLOCKING frame the agent cannot rationalize away', () => {
    // The always-on block is binding AND forcefully framed: a "BLOCKING
    // REQUIREMENT — MUST run both" header, the accountability cue ("the user
    // will check"), and a hard closing ("the system does not exist") so the
    // ritual is not skipped. What stays OUT is the flouted "read-only included"
    // clause and the exhaustive rejected-excuse enumeration — those live in the
    // on-demand `lessons` skill, not the always-on block.
    expect(LESSONS_PROCEDURAL_RULE).toContain('BLOCKING REQUIREMENT');
    expect(LESSONS_PROCEDURAL_RULE).toContain('the user will check');
    expect(LESSONS_PROCEDURAL_RULE).toContain('the system does not exist');
    expect(LESSONS_PROCEDURAL_RULE).not.toContain('read-only included');
    expect(LESSONS_PROCEDURAL_RULE).not.toContain('Rejected excuses');
  });

  it('is compact — far smaller than the prior maximalist block', () => {
    // Forceful framing is restored, but the always-on per-session tax stays
    // bounded: this guards against regrowth toward the ~1450-char maximalist
    // V1/V2 block, not against the deliberate forceful frame.
    expect(LESSONS_PROCEDURAL_RULE.length).toBeLessThan(880);
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
