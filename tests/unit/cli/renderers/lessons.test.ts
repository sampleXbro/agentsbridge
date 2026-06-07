import { describe, expect, it } from 'vitest';
import { renderLessons } from '../../../../src/cli/renderers/lessons.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderLessons — query', () => {
  const output = useCapturedOutput();

  it('plain format prints one rule per line', () => {
    renderLessons({
      subcommand: 'query',
      exitCode: 0,
      format: 'plain',
      data: {
        lessons: [
          { id: 'a', rule: 'Rule one.', topics: ['t'], triggers: [], evidence: [] },
          { id: 'b', rule: 'Rule two.', topics: ['t'], triggers: [], evidence: [] },
        ],
        query: {},
        autoMigrated: false,
      },
    });
    const out = output.stdout();
    expect(out).toContain('Rule one.');
    expect(out).toContain('Rule two.');
  });

  it('md format prints a numbered list', () => {
    renderLessons({
      subcommand: 'query',
      exitCode: 0,
      format: 'md',
      data: {
        lessons: [{ id: 'a', rule: 'Rule.', topics: ['t'], triggers: [], evidence: [] }],
        query: {},
        autoMigrated: false,
      },
    });
    expect(output.stdout()).toContain('1. Rule.');
  });

  it('json format prints the data block', () => {
    renderLessons({
      subcommand: 'query',
      exitCode: 0,
      format: 'json',
      data: {
        lessons: [{ id: 'a', rule: 'R.', topics: [], triggers: [], evidence: [] }],
        query: {},
        autoMigrated: false,
      },
    });
    const out = output.stdout();
    const parsed = JSON.parse(out) as { lessons: Array<{ id: string }> };
    expect(parsed.lessons[0]?.id).toBe('a');
  });

  it('prints an auto-migration notice on stderr when applicable', () => {
    renderLessons({
      subcommand: 'query',
      exitCode: 0,
      format: 'plain',
      data: { lessons: [], query: {}, autoMigrated: true },
    });
    expect(output.stderr()).toMatch(/auto-migrated/i);
  });

  it('prints "(no matches)" when query result is empty in plain format', () => {
    renderLessons({
      subcommand: 'query',
      exitCode: 0,
      format: 'plain',
      data: { lessons: [], query: { file: 'src/x.ts' }, autoMigrated: false },
    });
    expect(output.stdout()).toMatch(/no matches/i);
  });
});

describe('renderLessons — add', () => {
  const output = useCapturedOutput();

  it('prints the new lesson id and any new triggers', () => {
    renderLessons({
      subcommand: 'add',
      exitCode: 0,
      data: {
        id: 'topic-x-rule-1',
        isNewLesson: true,
        isNewTopic: false,
        newTriggerIds: ['t-glob-abc'],
        warnings: [],
      },
    });
    expect(output.stdout()).toContain('topic-x-rule-1');
    expect(output.stdout()).toMatch(/new triggers?/i);
  });

  it('signals a no-change re-capture when lesson already existed with no new triggers', () => {
    renderLessons({
      subcommand: 'add',
      exitCode: 0,
      data: { id: 'x', isNewLesson: false, isNewTopic: false, newTriggerIds: [], warnings: [] },
    });
    expect(output.stdout()).toMatch(/existing|no change/i);
  });

  it('reports an upsert when re-capture merged new triggers onto an existing lesson', () => {
    renderLessons({
      subcommand: 'add',
      exitCode: 0,
      data: {
        id: 'x',
        isNewLesson: false,
        isNewTopic: false,
        newTriggerIds: ['t-glob-new'],
        warnings: [],
      },
    });
    expect(output.stdout()).toMatch(/updated lesson: x/i);
    expect(output.stdout()).toMatch(/\+1 trigger/i);
  });

  it('routes errors to stderr', () => {
    renderLessons({
      subcommand: 'add',
      exitCode: 1,
      error: 'Unknown topic: nope',
      data: { id: '', isNewLesson: false, isNewTopic: false, newTriggerIds: [], warnings: [] },
    });
    expect(output.stderr()).toContain('Unknown topic: nope');
  });

  it('does not print a bogus "Existing lesson" line on the error path', () => {
    renderLessons({
      subcommand: 'add',
      exitCode: 2,
      error: 'Missing --rule',
      data: { id: '', isNewLesson: false, isNewTopic: false, newTriggerIds: [], warnings: [] },
    });
    expect(output.stdout()).not.toMatch(/existing lesson/i);
    expect(output.stderr()).toContain('Missing --rule');
  });

  it('prints guardrail warnings (stderr) after a successful capture', () => {
    renderLessons({
      subcommand: 'add',
      exitCode: 0,
      data: {
        id: 'topic-x-rule-1',
        isNewLesson: true,
        isNewTopic: false,
        newTriggerIds: ['t-glob-abc'],
        warnings: [{ code: 'BROAD_GLOB_TRIGGER', message: 'broad glob.' }],
      },
    });
    expect(output.stdout()).toContain('topic-x-rule-1');
    expect(output.stderr()).toContain('BROAD_GLOB_TRIGGER');
  });
});

describe('renderLessons — prune', () => {
  const output = useCapturedOutput();

  it('dry run reports the plan and flags that nothing was written', () => {
    renderLessons({
      subcommand: 'prune',
      exitCode: 0,
      data: {
        applied: false,
        cap: 8,
        removedTriggerIds: ['t-dead', 't-orphan'],
        trimmedLessons: [{ id: 'big', removedCount: 2, keptCount: 8 }],
      },
    });
    expect(output.stdout()).toMatch(/would prune/i);
    expect(output.stdout()).toMatch(/big: -2 . 8 kept/i);
    expect(output.stderr()).toMatch(/dry run/i);
  });

  it('apply reports what was pruned', () => {
    renderLessons({
      subcommand: 'prune',
      exitCode: 0,
      data: { applied: true, cap: 8, removedTriggerIds: ['t-dead'], trimmedLessons: [] },
    });
    expect(output.stdout()).toMatch(/pruned:/i);
    expect(output.stderr()).not.toMatch(/dry run/i);
  });

  it('reports a clean graph as nothing to prune', () => {
    renderLessons({
      subcommand: 'prune',
      exitCode: 0,
      data: { applied: false, cap: 8, removedTriggerIds: [], trimmedLessons: [] },
    });
    expect(output.stdout()).toMatch(/nothing to prune/i);
  });
});

describe('renderLessons — topics / show / journal / validate / import-md / help', () => {
  const output = useCapturedOutput();

  it('topics prints id and summary per row', () => {
    renderLessons({
      subcommand: 'topics',
      exitCode: 0,
      data: { topics: [{ id: 't1', summary: 'Summary 1.' }] },
    });
    expect(output.stdout()).toContain('t1');
    expect(output.stdout()).toContain('Summary 1.');
  });

  it('show prints the rendered markdown to stdout', () => {
    renderLessons({
      subcommand: 'show',
      exitCode: 0,
      data: { topic: 't1', markdown: '# t1\n\nbody\n' },
    });
    expect(output.stdout()).toContain('# t1');
    expect(output.stdout()).toContain('body');
  });

  it('deprecate prints a plain deprecation line', () => {
    renderLessons({
      subcommand: 'deprecate',
      exitCode: 0,
      data: { id: 'rule-a', supersededBy: null },
    });
    expect(output.stdout()).toMatch(/deprecated rule-a/i);
  });

  it('deprecate prints a supersede line when supersededBy is set', () => {
    renderLessons({
      subcommand: 'deprecate',
      exitCode: 0,
      data: { id: 'rule-a', supersededBy: 'rule-b' },
    });
    expect(output.stdout()).toMatch(/superseded rule-a → rule-b/i);
  });

  it('import-md without deletions omits the removed-legacy line', () => {
    renderLessons({
      subcommand: 'import-md',
      exitCode: 0,
      data: {
        topicCount: 1,
        lessonCount: 1,
        triggerCount: 1,
        wroteGraphPath: '/abs/.agentsmesh/lessons/lessons.json',
        deletedPaths: [],
      },
    });
    expect(output.stdout()).not.toMatch(/removed legacy/i);
  });

  it('journal prints chronological entries with createdAt', () => {
    renderLessons({
      subcommand: 'journal',
      exitCode: 0,
      data: {
        entries: [
          { id: 'a', rule: 'A.', createdAt: '2026-06-01', topics: ['t'] },
          { id: 'b', rule: 'B.', createdAt: '2026-06-02', topics: ['t'] },
        ],
      },
    });
    const out = output.stdout();
    expect(out.indexOf('2026-06-01')).toBeGreaterThan(-1);
    expect(out.indexOf('A.')).toBeGreaterThan(-1);
    expect(out.indexOf('2026-06-02')).toBeGreaterThan(out.indexOf('2026-06-01'));
  });

  it('topics prints a placeholder when there are no topics', () => {
    renderLessons({ subcommand: 'topics', exitCode: 0, data: { topics: [] } });
    expect(output.stdout()).toMatch(/no topics/i);
  });

  it('validate prints warning-level findings to stderr', () => {
    renderLessons({
      subcommand: 'validate',
      exitCode: 0,
      data: {
        ok: true,
        findings: [{ level: 'warning', code: 'ORPHAN_TRIGGER', message: 'Trigger t-x unused.' }],
      },
    });
    expect(output.stderr()).toMatch(/warning/i);
    expect(output.stderr()).toContain('ORPHAN_TRIGGER');
  });

  it('import-md reports a singular removed-legacy line for exactly one deletion', () => {
    renderLessons({
      subcommand: 'import-md',
      exitCode: 0,
      data: {
        topicCount: 1,
        lessonCount: 1,
        triggerCount: 1,
        wroteGraphPath: '/abs/.agentsmesh/lessons/lessons.json',
        deletedPaths: ['/abs/.agentsmesh/lessons/index.yaml'],
      },
    });
    expect(output.stdout()).toMatch(/removed legacy: 1 path(?!s)/);
  });

  it('validate ok prints a success line to stdout', () => {
    renderLessons({
      subcommand: 'validate',
      exitCode: 0,
      data: { ok: true, findings: [] },
    });
    expect(output.stdout()).toMatch(/ok/i);
  });

  it('validate findings print to stderr with level prefix', () => {
    renderLessons({
      subcommand: 'validate',
      exitCode: 1,
      data: {
        ok: false,
        findings: [
          { level: 'error', code: 'DANGLING_TOPIC', message: 'Lesson x → topic y missing.' },
        ],
      },
    });
    expect(output.stderr()).toMatch(/error/i);
    expect(output.stderr()).toContain('DANGLING_TOPIC');
  });

  it('import-md prints migration counts', () => {
    renderLessons({
      subcommand: 'import-md',
      exitCode: 0,
      data: {
        topicCount: 2,
        lessonCount: 5,
        triggerCount: 7,
        wroteGraphPath: '/abs/.agentsmesh/lessons/lessons.json',
        deletedPaths: ['/abs/.agentsmesh/lessons/index.yaml'],
      },
    });
    const out = output.stdout();
    expect(out).toContain('2');
    expect(out).toContain('5');
    expect(out).toContain('7');
  });

  it('help prints usage and known subcommands', () => {
    renderLessons({ subcommand: 'help', exitCode: 0 });
    const out = output.stdout();
    expect(out).toMatch(/usage/i);
    expect(out).toContain('query');
    expect(out).toContain('add');
  });
});

describe('renderLessons — stats', () => {
  const output = useCapturedOutput();

  const report = {
    totalRecalls: 4,
    noMatchRate: 0.5,
    matchCountHistogram: [
      { bucket: '0', count: 2 },
      { bucket: '1', count: 2 },
    ],
    returnedTokens: { p50: 20, p90: 80, max: 90 },
    cumulativeRecallTokens: 120,
    wholeActiveSetTokens: 300,
    preloadBreakEven: { perActionCheaper: true, ratio: 0.4 },
    reachability: { keywordOnlyRecallRate: 0.25, keywordOnlyUnreachableLessons: 3 },
  };

  it('prints the human summary including break-even and reachability', () => {
    renderLessons({
      subcommand: 'stats',
      exitCode: 0,
      format: 'text',
      data: { report, hasLog: true },
    });
    const out = output.stdout();
    expect(out).toContain('recalls: 4');
    expect(out).toContain('no-match: 50.0%');
    expect(out).toContain('per-action cheaper');
    expect(out).toContain('keyword-only-unreachable lessons 3');
  });

  it('prints a hint when no telemetry log exists', () => {
    renderLessons({
      subcommand: 'stats',
      exitCode: 0,
      format: 'text',
      data: { report, hasLog: false },
    });
    expect(output.stdout()).toContain('AGENTSMESH_LESSONS_TELEMETRY=1');
  });

  it('reports preload as cheaper when per-action recall exceeds the baseline', () => {
    const heavy = { ...report, preloadBreakEven: { perActionCheaper: false, ratio: 2.5 } };
    renderLessons({
      subcommand: 'stats',
      exitCode: 0,
      format: 'text',
      data: { report: heavy, hasLog: true },
    });
    expect(output.stdout()).toContain('preload cheaper');
  });

  it('json format emits the raw report', () => {
    renderLessons({
      subcommand: 'stats',
      exitCode: 0,
      format: 'json',
      data: { report, hasLog: true },
    });
    const parsed = JSON.parse(output.stdout());
    expect(parsed.totalRecalls).toBe(4);
    expect(parsed.preloadBreakEven.ratio).toBe(0.4);
  });
});
