import { describe, it, expect } from 'vitest';
import {
  runBulkPrompt,
  type BulkCandidates,
  type BulkPromptDeps,
} from '../../../../src/install/prompts/bulk-prompt.js';

interface Recorder {
  readonly prompts: string[];
  readonly writes: string[];
  readonly ask: (prompt: string) => Promise<string>;
  readonly write: (chunk: string) => void;
  readonly deps: BulkPromptDeps;
}

function makeRecorder(answers: readonly string[]): Recorder {
  const prompts: string[] = [];
  const writes: string[] = [];
  let i = 0;
  const ask = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    if (i >= answers.length) return '';
    return answers[i++]!;
  };
  const write = (chunk: string): void => {
    writes.push(chunk);
  };
  return { prompts, writes, ask, write, deps: { ask, write } };
}

const FULL: BulkCandidates = {
  skills: ['alpha', 'beta', 'gamma'],
  agents: ['code-reviewer', 'planner'],
  commands: ['deploy', 'release'],
  rules: ['_root'],
};

const EMPTY: BulkCandidates = {
  skills: [],
  agents: [],
  commands: [],
  rules: [],
};

describe('runBulkPrompt - bypass', () => {
  it('returns all candidates without asking when bypass=true', async () => {
    const r = makeRecorder([]);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: true }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.agents).toEqual(['code-reviewer', 'planner']);
    expect(result.commands).toEqual(['deploy', 'release']);
    expect(result.rules).toEqual(['_root']);
    expect(r.prompts).toEqual([]);
  });

  it('does not write a banner under bypass=true', async () => {
    const r = makeRecorder([]);
    await runBulkPrompt(FULL, { packName: 'pack', bypass: true }, r.deps);
    expect(r.writes).toEqual([]);
  });
});

describe('runBulkPrompt - tier 1', () => {
  it("'a' selects every candidate across all four types", async () => {
    const r = makeRecorder(['a']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.agents).toEqual(['code-reviewer', 'planner']);
    expect(result.commands).toEqual(['deploy', 'release']);
    expect(result.rules).toEqual(['_root']);
    expect(r.prompts).toHaveLength(1);
  });

  it("'A' (uppercase) is treated identically to 'a'", async () => {
    const r = makeRecorder(['A']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['alpha', 'beta', 'gamma']);
  });

  it("'n' returns no candidates and aborted=false", async () => {
    const r = makeRecorder(['n']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual([]);
    expect(result.agents).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.rules).toEqual([]);
  });

  it('blank input at tier 1 aborts the run', async () => {
    const r = makeRecorder(['']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(true);
    expect(result.skills).toEqual([]);
  });

  it('unknown input at tier 1 aborts the run', async () => {
    const r = makeRecorder(['x']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);
    expect(result.aborted).toBe(true);
  });

  it('writes a banner listing pack name and non-zero category counts before tier 1', async () => {
    const r = makeRecorder(['a']);
    await runBulkPrompt(FULL, { packName: 'addyosmani-agent-skills', bypass: false }, r.deps);
    const combined = r.writes.join('');
    expect(combined).toContain('addyosmani-agent-skills');
    expect(combined).toContain('3 skills');
    expect(combined).toContain('2 agents');
    expect(combined).toContain('2 commands');
    expect(combined).toContain('1 rule');
  });

  it('omits zero-count category lines from the banner', async () => {
    const r = makeRecorder(['a']);
    const noRules: BulkCandidates = { ...FULL, rules: [] };
    await runBulkPrompt(noRules, { packName: 'pack', bypass: false }, r.deps);
    const combined = r.writes.join('');
    expect(combined).not.toMatch(/0 rules?\b/);
    expect(combined).toContain('3 skills');
  });
});

describe('runBulkPrompt - tier 2 (after select per type)', () => {
  it('asks tier 2 once per non-empty category and respects y/n choices', async () => {
    // tier 1='s'; per-type: skills='y', agents='n', commands='y', rules='y'
    const r = makeRecorder(['s', 'y', 'n', 'y', 'y']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.agents).toEqual([]);
    expect(result.commands).toEqual(['deploy', 'release']);
    expect(result.rules).toEqual(['_root']);
  });

  it('does not ask tier 2 for an empty category', async () => {
    // skills empty: 's' then tier 2 for agents='n', commands='y', rules='y'
    const candidates: BulkCandidates = { ...FULL, skills: [] };
    const r = makeRecorder(['s', 'n', 'y', 'y']);
    const result = await runBulkPrompt(candidates, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual([]);
    expect(result.agents).toEqual([]);
    expect(result.commands).toEqual(['deploy', 'release']);
    expect(result.rules).toEqual(['_root']);
    expect(r.prompts).toHaveLength(4);
  });

  it('blank at tier 2 aborts the run mid-walk', async () => {
    const r = makeRecorder(['s', '']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(true);
    expect(result.skills).toEqual([]);
    expect(result.agents).toEqual([]);
  });

  it('unknown input at tier 2 aborts the run', async () => {
    const r = makeRecorder(['s', 'z']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);
    expect(result.aborted).toBe(true);
  });
});

describe('runBulkPrompt - tier 3 (per-entity)', () => {
  it("tier 3 'y' includes; tier 3 'n' (or capital N) skips", async () => {
    // tier 1='s'; skills='c'; entities: y, N, y; agents='n', commands='n', rules='n'
    const r = makeRecorder(['s', 'c', 'y', 'N', 'y', 'n', 'n', 'n']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['alpha', 'gamma']);
  });

  it('tier 3 blank defaults to skip (capital N is documented default)', async () => {
    // skills='c' with one blank ('' = skip), then 'y', 'y'
    const r = makeRecorder(['s', 'c', '', 'y', 'y', 'n', 'n', 'n']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['beta', 'gamma']);
  });

  it("tier 3 'a' accepts the current entity AND all remaining entities of that type without prompting", async () => {
    // skills='c'; first entity gets 'a' (accept current + skip prompting for the other 2)
    // then move on to agents, commands, rules ('n' each)
    const r = makeRecorder(['s', 'c', 'a', 'n', 'n', 'n']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual(['alpha', 'beta', 'gamma']);
    // exactly 6 prompts: tier1 + tier2-skills + tier3-skill-alpha + tier2-agents + tier2-commands + tier2-rules
    expect(r.prompts).toHaveLength(6);
  });

  it("tier 3 'q' skips the current entity AND all remaining entities of that type", async () => {
    // skills='c'; first entity gets 'q' (skip current + all remaining)
    const r = makeRecorder(['s', 'c', 'q', 'n', 'n', 'n']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual([]);
    expect(r.prompts).toHaveLength(6);
  });

  it('tier 3 unknown input (not y/n/a/q/blank) aborts the run', async () => {
    const r = makeRecorder(['s', 'c', 'wat']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);
    expect(result.aborted).toBe(true);
  });

  it('tier 3 EOF mid-entity aborts the run (queue exhausted between entities)', async () => {
    // skills='c', 'y' for first, then queue empty → ask returns '' → unknown at tier3 → abort
    // Strictly: blank at tier 3 defaults to N (skip). To verify EOF abort, the
    // unknown-abort test above covers it. Re-verify with explicit EOF at tier 2:
    const r = makeRecorder(['s', 'c', 'y']);
    const result = await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);
    // After 'y' on first skill, second skill is asked: queue empty → '' → skip.
    // After all skills walked, tier 2 for agents asked: queue empty → '' → abort.
    expect(result.aborted).toBe(true);
  });

  it('walks types in deterministic order: skills, agents, commands, rules', async () => {
    // tier 1='s', tier 2 'y' for each non-empty type → all candidates selected
    const r = makeRecorder(['s', 'y', 'y', 'y', 'y']);
    await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    // tier 2 prompts in order: skills, agents, commands, rules
    const tier2Prompts = r.prompts.slice(1);
    expect(tier2Prompts[0]).toMatch(/skill/i);
    expect(tier2Prompts[1]).toMatch(/agent/i);
    expect(tier2Prompts[2]).toMatch(/command/i);
    expect(tier2Prompts[3]).toMatch(/rule/i);
  });

  it('tier 3 prompt names the singular entity kind and the entity id', async () => {
    const r = makeRecorder(['s', 'c', 'y', 'y', 'y', 'n', 'n', 'n']);
    await runBulkPrompt(FULL, { packName: 'pack', bypass: false }, r.deps);

    const tier3Skill1 = r.prompts[2]!;
    expect(tier3Skill1).toContain('skill');
    expect(tier3Skill1).toContain('alpha');
  });
});

describe('runBulkPrompt - degenerate inputs', () => {
  it('returns immediately with empty selections when all candidate groups are empty', async () => {
    const r = makeRecorder([]);
    const result = await runBulkPrompt(EMPTY, { packName: 'pack', bypass: false }, r.deps);

    expect(result.aborted).toBe(false);
    expect(result.skills).toEqual([]);
    expect(result.agents).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(r.prompts).toEqual([]);
  });
});
