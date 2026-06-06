import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runLessons } from '../../../../src/cli/commands/lessons.js';
import { loadLessonsGraph, saveLessonsGraph } from '../../../../src/lessons/graph-store.js';
import type { LessonsGraph } from '../../../../src/lessons/graph-schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_FIXTURE = join(HERE, '../../../fixtures/lessons/legacy-input');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-cli-lessons-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seedSimpleGraph(): void {
  const graph: LessonsGraph = {
    version: 1,
    lessons: {
      'topic-x-rule-1': {
        rule: 'Normalize display paths.',
        topics: ['topic-x'],
        triggers: ['t-glob-src'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      },
    },
    topics: { 'topic-x': { summary: 'Topic X.' } },
    triggers: { 't-glob-src': { kind: 'file_glob', pattern: 'src/**/*.ts' } },
  };
  saveLessonsGraph(root, graph);
}

describe('runLessons — help / unknown', () => {
  it('returns showHelp when no subcommand is given', async () => {
    const r = await runLessons({}, [], root);
    expect(r.subcommand).toBe('help');
    expect(r.exitCode).toBe(0);
  });

  it('returns error + showHelp for an unknown subcommand', async () => {
    const r = await runLessons({}, ['banana'], root);
    expect(r.subcommand).toBe('help');
    expect(r.exitCode).toBe(2);
    expect(r.error).toContain('banana');
  });
});

describe('runLessons query', () => {
  it('returns matching lesson ids in alphabetical order', async () => {
    seedSimpleGraph();
    const r = await runLessons({ file: 'src/cli/lessons.ts' }, ['query'], root);
    expect(r.subcommand).toBe('query');
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons.map((l) => l.id)).toEqual(['topic-x-rule-1']);
    expect(r.data.lessons[0]?.rule).toBe('Normalize display paths.');
  });

  it('honors --format plain | md | json', async () => {
    seedSimpleGraph();
    const plain = await runLessons({ file: 'src/x.ts', format: 'plain' }, ['query'], root);
    const md = await runLessons({ file: 'src/x.ts', format: 'md' }, ['query'], root);
    const json = await runLessons({ file: 'src/x.ts', format: 'json' }, ['query'], root);
    if (plain.subcommand !== 'query' || md.subcommand !== 'query' || json.subcommand !== 'query')
      return;
    expect(plain.format).toBe('plain');
    expect(md.format).toBe('md');
    expect(json.format).toBe('json');
  });

  it('returns empty when no flag is supplied', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['query'], root);
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons).toEqual([]);
  });

  it('returns empty (not error) when lessons.json is missing and no legacy index exists', async () => {
    const r = await runLessons({ file: 'src/x.ts' }, ['query'], root);
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  it('auto-migrates from legacy index.yaml on first query and DELETES legacy artifacts', async () => {
    cpSync(LEGACY_FIXTURE, join(root, '.agentsmesh/lessons'), { recursive: true });
    expect(existsSync(join(root, '.agentsmesh/lessons/lessons.json'))).toBe(false);

    const r = await runLessons({ keyword: 'alpha' }, ['query'], root);
    expect(existsSync(join(root, '.agentsmesh/lessons/lessons.json'))).toBe(true);
    // Clean-break: legacy files are gone after auto-migration.
    expect(existsSync(join(root, '.agentsmesh/lessons/index.yaml'))).toBe(false);
    expect(existsSync(join(root, '.agentsmesh/lessons/journal.md'))).toBe(false);
    expect(existsSync(join(root, '.agentsmesh/lessons/topics'))).toBe(false);

    if (r.subcommand !== 'query') return;
    expect(r.data.autoMigrated).toBe(true);
    expect(r.data.lessons.length).toBeGreaterThan(0);
  });
});

describe('runLessons add', () => {
  it('adds a lesson and returns its id', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      {
        rule: 'Strip CRLF from emitted scripts.',
        topic: 'topic-x',
        'trigger-file': 'src/**/*.ts',
        evidence: 'commit:xyz',
      },
      ['add'],
      root,
    );
    expect(r.subcommand).toBe('add');
    if (r.subcommand !== 'add') return;
    expect(r.exitCode).toBe(0);
    expect(r.data.id).toMatch(/^topic-x-/);
    expect(r.data.isNewLesson).toBe(true);

    const graph = loadLessonsGraph(root);
    expect(graph.lessons[r.data.id]?.rule).toBe('Strip CRLF from emitted scripts.');
  });

  it('accepts the rule as a positional arg (the documented `add "<rule>" --topic` form)', async () => {
    seedSimpleGraph();
    const r = await runLessons({ topic: 'topic-x' }, ['add', 'Positional rule body.'], root);
    expect(r.subcommand).toBe('add');
    if (r.subcommand !== 'add') return;
    expect(r.exitCode).toBe(0);
    const graph = loadLessonsGraph(root);
    expect(graph.lessons[r.data.id]?.rule).toBe('Positional rule body.');
  });

  it('prefers --rule over the positional arg when both are supplied', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      { topic: 'topic-x', rule: 'Flag rule.' },
      ['add', 'Positional rule.'],
      root,
    );
    if (r.subcommand !== 'add') return;
    const graph = loadLessonsGraph(root);
    expect(graph.lessons[r.data.id]?.rule).toBe('Flag rule.');
  });

  it('errors when --rule or --topic is missing', async () => {
    seedSimpleGraph();
    const noRule = await runLessons({ topic: 'topic-x' }, ['add'], root);
    expect(noRule.exitCode).toBe(2);
    expect(noRule.error).toMatch(/rule/i);
    const noTopic = await runLessons({ rule: 'X.' }, ['add'], root);
    expect(noTopic.exitCode).toBe(2);
    expect(noTopic.error).toMatch(/topic/i);
  });

  it('surfaces a non-topic capture error (e.g. invalid command regex) with exit 1', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      { rule: 'Bad regex rule.', topic: 'topic-x', 'trigger-cmd': '(' },
      ['add'],
      root,
    );
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/INVALID_TRIGGER_PATTERN|invalid/i);
  });

  it('rejects unknown topic without --new-topic', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      { rule: 'R.', topic: 'nope', 'trigger-file': 'src/**' },
      ['add'],
      root,
    );
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/unknown topic/i);
  });

  it('creates a topic with --new-topic + --topic-summary', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      {
        rule: 'R.',
        topic: 'fresh-topic',
        'trigger-file': 'src/**',
        'new-topic': true,
        'topic-summary': 'Fresh topic.',
      },
      ['add'],
      root,
    );
    expect(r.exitCode).toBe(0);
    if (r.subcommand !== 'add') return;
    expect(r.data.isNewTopic).toBe(true);
  });

  it('treats a trigger value as opaque — commas in a glob/regex are NOT split', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      {
        rule: 'Brace glob trigger rule.',
        topic: 'topic-x',
        'trigger-file': 'src/{a,b}/**',
        'trigger-cmd': '^foo{1,3}$',
      },
      ['add'],
      root,
    );
    expect(r.exitCode).toBe(0);
    if (r.subcommand !== 'add') return;
    const graph = loadLessonsGraph(root);
    const lesson = graph.lessons[r.data.id];
    expect(lesson?.triggers.length).toBe(2);
    const patterns = lesson?.triggers.map((t) => graph.triggers[t]?.pattern).sort();
    expect(patterns).toEqual(['^foo{1,3}$', 'src/{a,b}/**']);
  });

  it('accepts repeated --trigger-file/--trigger-cmd/--trigger-kw and --evidence', async () => {
    seedSimpleGraph();
    const r = await runLessons(
      {
        rule: 'Multi-trigger rule.',
        topic: 'topic-x',
        'trigger-file': ['src/**', 'tests/**'],
        'trigger-cmd': '^pnpm test',
        'trigger-kw': ['display', 'path'],
        evidence: ['commit:a', 'commit:b'],
      } as unknown as Record<string, string | boolean>,
      ['add'],
      root,
    );
    expect(r.exitCode).toBe(0);
    if (r.subcommand !== 'add') return;
    const graph = loadLessonsGraph(root);
    expect(graph.lessons[r.data.id]?.triggers.length).toBe(5);
    expect(graph.lessons[r.data.id]?.evidence.length).toBe(2);
  });
});

describe('runLessons topics', () => {
  it('lists every topic with summary', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['topics'], root);
    if (r.subcommand !== 'topics') return;
    expect(r.data.topics).toEqual([{ id: 'topic-x', summary: 'Topic X.' }]);
  });

  it('sorts topics by id regardless of insertion order', async () => {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {},
      topics: { 'z-t': { summary: 'Z.' }, 'a-t': { summary: 'A.' }, 'm-t': { summary: 'M.' } },
      triggers: {},
    };
    saveLessonsGraph(root, graph);
    const r = await runLessons({}, ['topics'], root);
    if (r.subcommand !== 'topics') return;
    expect(r.data.topics.map((t) => t.id)).toEqual(['a-t', 'm-t', 'z-t']);
  });

  it('returns no topics on a project without a graph', async () => {
    const r = await runLessons({}, ['topics'], root);
    if (r.subcommand !== 'topics') return;
    expect(r.data.topics).toEqual([]);
  });
});

describe('runLessons journal', () => {
  it('returns no entries on a project without a graph', async () => {
    const r = await runLessons({}, ['journal'], root);
    if (r.subcommand !== 'journal') return;
    expect(r.data.entries).toEqual([]);
  });

  it('breaks createdAt ties by lesson id', async () => {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'b-two': {
          rule: 'B.',
          topics: ['t'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'a-one': {
          rule: 'A.',
          topics: ['t'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
      topics: { t: { summary: '.' } },
      triggers: {},
    };
    saveLessonsGraph(root, graph);
    const r = await runLessons({}, ['journal'], root);
    if (r.subcommand !== 'journal') return;
    expect(r.data.entries.map((e) => e.id)).toEqual(['a-one', 'b-two']);
  });
});

describe('runLessons show — multiple lessons', () => {
  it('renders active lessons in a topic sorted by id', async () => {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'topic-x-rule-2': {
          rule: 'Second.',
          topics: ['topic-x'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'topic-x-rule-1': {
          rule: 'First.',
          topics: ['topic-x'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'topic-x-rule-3': {
          rule: 'Deprecated.',
          topics: ['topic-x'],
          triggers: [],
          evidence: [],
          status: 'deprecated',
          createdAt: '2026-06-01',
        },
      },
      topics: { 'topic-x': { summary: 'Topic X.' } },
      triggers: {},
    };
    saveLessonsGraph(root, graph);
    const r = await runLessons({}, ['show', 'topic-x'], root);
    if (r.subcommand !== 'show') return;
    expect(r.data.markdown.indexOf('topic-x-rule-1')).toBeLessThan(
      r.data.markdown.indexOf('topic-x-rule-2'),
    );
    // Deprecated lessons are excluded from the rendered topic.
    expect(r.data.markdown).not.toContain('topic-x-rule-3');
  });
});

describe('runLessons show', () => {
  it('excludes lessons that belong to other topics', async () => {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'x-1': {
          rule: 'Belongs to X.',
          topics: ['topic-x'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'y-1': {
          rule: 'Belongs to Y.',
          topics: ['topic-y'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
      topics: { 'topic-x': { summary: 'X.' }, 'topic-y': { summary: 'Y.' } },
      triggers: {},
    };
    saveLessonsGraph(root, graph);
    const r = await runLessons({}, ['show', 'topic-x'], root);
    if (r.subcommand !== 'show') return;
    expect(r.data.markdown).toContain('Belongs to X.');
    expect(r.data.markdown).not.toContain('Belongs to Y.');
  });

  it('renders a topic as markdown listing its lessons', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['show', 'topic-x'], root);
    if (r.subcommand !== 'show') return;
    expect(r.data.topic).toBe('topic-x');
    expect(r.data.markdown).toContain('topic-x');
    expect(r.data.markdown).toContain('Normalize display paths.');
  });

  it('errors when topic is missing', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['show', 'nope'], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/unknown topic/i);
  });
});

describe('runLessons deprecate', () => {
  it('marks the lesson deprecated', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['deprecate', 'topic-x-rule-1'], root);
    if (r.subcommand !== 'deprecate') return;
    expect(r.exitCode).toBe(0);
    const graph = loadLessonsGraph(root);
    expect(graph.lessons['topic-x-rule-1']?.status).toBe('deprecated');
  });

  it('marks superseded with --superseded-by', async () => {
    seedSimpleGraph();
    const graph = loadLessonsGraph(root);
    graph.lessons['topic-x-rule-2'] = {
      ...graph.lessons['topic-x-rule-1']!,
      rule: 'Replacement rule.',
    };
    saveLessonsGraph(root, graph);

    const r = await runLessons(
      { 'superseded-by': 'topic-x-rule-2' },
      ['deprecate', 'topic-x-rule-1'],
      root,
    );
    expect(r.exitCode).toBe(0);
    const reloaded = loadLessonsGraph(root);
    expect(reloaded.lessons['topic-x-rule-1']?.status).toBe('superseded');
    expect(reloaded.lessons['topic-x-rule-1']?.supersededBy).toBe('topic-x-rule-2');
  });

  it('errors with usage when no lesson id is given', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['deprecate'], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toMatch(/usage/i);
  });

  it('errors on an unknown lesson id', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['deprecate', 'ghost'], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/unknown lesson/i);
  });

  it('errors when --superseded-by points at a missing lesson', async () => {
    seedSimpleGraph();
    const r = await runLessons({ 'superseded-by': 'ghost' }, ['deprecate', 'topic-x-rule-1'], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/unknown superseder/i);
  });
});

describe('runLessons query — ranking and caps', () => {
  function seedMany(): void {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'topic-x-1': {
          rule: 'Normalize windows path separators to forward slashes.',
          topics: ['topic-x'],
          triggers: ['t-broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'topic-x-2': {
          rule: 'Prefer interfaces over type aliases.',
          topics: ['topic-x'],
          triggers: ['t-broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'topic-x-3': {
          rule: 'Avoid default exports in shared modules.',
          topics: ['topic-x'],
          triggers: ['t-broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
      topics: { 'topic-x': { summary: 'X.' } },
      triggers: { 't-broad': { kind: 'file_glob', pattern: 'src/**' } },
    };
    saveLessonsGraph(root, graph);
  }

  it('caps results to --top and reports totalMatches', async () => {
    seedMany();
    const r = await runLessons({ file: 'src/a.ts', top: '2' }, ['query'], root);
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons.length).toBe(2);
    expect(r.data.totalMatches).toBe(3);
  });

  it('--all returns every match (no cap)', async () => {
    seedMany();
    const r = await runLessons({ file: 'src/a.ts', all: true }, ['query'], root);
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons.length).toBe(3);
  });

  it('ranks the rule whose text matches the keyword first', async () => {
    seedMany();
    const r = await runLessons({ file: 'src/a.ts', keyword: 'windows path' }, ['query'], root);
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons[0]?.id).toBe('topic-x-1');
  });

  it('rejects invalid --top with a usage error (exit 2)', async () => {
    seedMany();
    for (const top of ['-1', 'wat', '0']) {
      const r = await runLessons({ file: 'src/a.ts', top }, ['query'], root);
      expect(r.exitCode).toBe(2);
      expect(r.error).toMatch(/--top/);
    }
  });

  it('rejects a bare --top flag with no value (exit 2)', async () => {
    seedMany();
    const r = await runLessons({ file: 'src/a.ts', top: true }, ['query'], root);
    expect(r.exitCode).toBe(2);
  });

  it('rejects invalid --max-tokens with a usage error (exit 2)', async () => {
    seedMany();
    const r = await runLessons({ file: 'src/a.ts', 'max-tokens': '-2' }, ['query'], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toMatch(/--max-tokens/);
  });
});

describe('runLessons merge', () => {
  function seedTwoTopics(): void {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'a-keep': {
          rule: 'Canonical rule.',
          topics: ['topic-a'],
          triggers: ['t-a'],
          evidence: ['legacy:a'],
          status: 'active',
          createdAt: '2026-06-05',
        },
        'b-lose': {
          rule: 'Redundant rule.',
          topics: ['topic-b'],
          triggers: ['t-b'],
          evidence: ['legacy:b'],
          status: 'active',
          createdAt: '2026-06-05',
        },
      },
      topics: { 'topic-a': { summary: 'A.' }, 'topic-b': { summary: 'B.' } },
      triggers: {
        't-a': { kind: 'file_glob', pattern: 'src/a/**' },
        't-b': { kind: 'file_glob', pattern: 'src/b/**' },
      },
    };
    saveLessonsGraph(root, graph);
  }

  it('folds the loser into the keeper and supersedes it', async () => {
    seedTwoTopics();
    const r = await runLessons({}, ['merge', 'b-lose', 'a-keep'], root);
    expect(r.subcommand).toBe('merge');
    if (r.subcommand !== 'merge') return;
    expect(r.exitCode).toBe(0);
    expect(r.data).toEqual({ loserId: 'b-lose', keeperId: 'a-keep' });

    const graph = loadLessonsGraph(root);
    expect(graph.lessons['a-keep']?.triggers).toEqual(['t-a', 't-b']);
    expect(graph.lessons['a-keep']?.topics).toEqual(['topic-a', 'topic-b']);
    expect(graph.lessons['b-lose']?.status).toBe('superseded');
    expect(graph.lessons['b-lose']?.supersededBy).toBe('a-keep');
  });

  it('errors with usage when fewer than two ids are given', async () => {
    seedTwoTopics();
    const r = await runLessons({}, ['merge', 'b-lose'], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toMatch(/usage/i);
  });

  it('errors on an unknown lesson id', async () => {
    seedTwoTopics();
    const r = await runLessons({}, ['merge', 'ghost', 'a-keep'], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/ghost/);
  });
});

describe('runLessons strip-markers', () => {
  function seedMarkered(): void {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'topic-x-rule-1': {
          rule: 'Audit output maps. See L128',
          topics: ['topic-x'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-05',
        },
        'topic-x-rule-2': {
          rule: 'Already clean.',
          topics: ['topic-x'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-05',
        },
      },
      topics: { 'topic-x': { summary: 'X.' } },
      triggers: {},
    };
    saveLessonsGraph(root, graph);
  }

  it('strips legacy markers and reports the changed ids', async () => {
    seedMarkered();
    const r = await runLessons({}, ['strip-markers'], root);
    expect(r.subcommand).toBe('strip-markers');
    if (r.subcommand !== 'strip-markers') return;
    expect(r.exitCode).toBe(0);
    expect(r.data.changedIds).toEqual(['topic-x-rule-1']);
    expect(r.data.changedCount).toBe(1);
    expect(r.data.dryRun).toBe(false);
    expect(loadLessonsGraph(root).lessons['topic-x-rule-1']?.rule).toBe('Audit output maps.');
  });

  it('--dry-run reports without writing', async () => {
    seedMarkered();
    const r = await runLessons({ 'dry-run': true }, ['strip-markers'], root);
    if (r.subcommand !== 'strip-markers') return;
    expect(r.data.changedIds).toEqual(['topic-x-rule-1']);
    expect(r.data.dryRun).toBe(true);
    expect(loadLessonsGraph(root).lessons['topic-x-rule-1']?.rule).toBe(
      'Audit output maps. See L128',
    );
  });
});

describe('runLessons show / query edge branches', () => {
  it('show errors with usage when no topic arg is given', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['show'], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toMatch(/usage/i);
  });

  it('query accepts --command as an alias for --cmd', async () => {
    seedSimpleGraph();
    const graph = loadLessonsGraph(root);
    graph.triggers['t-cmd'] = { kind: 'command_pattern', pattern: '^pnpm test' };
    graph.lessons['topic-x-rule-1'].triggers = ['t-cmd'];
    saveLessonsGraph(root, graph);
    const r = await runLessons({ command: 'pnpm test' }, ['query'], root);
    if (r.subcommand !== 'query') return;
    expect(r.data.lessons.map((l) => l.id)).toEqual(['topic-x-rule-1']);
  });
});

describe('runLessons validate', () => {
  it('returns ok for a clean graph', async () => {
    seedSimpleGraph();
    const r = await runLessons({}, ['validate'], root);
    if (r.subcommand !== 'validate') return;
    expect(r.data.ok).toBe(true);
    expect(r.exitCode).toBe(0);
  });

  it('returns non-zero exit code when errors are found', async () => {
    seedSimpleGraph();
    const graph = loadLessonsGraph(root);
    graph.lessons['topic-x-rule-1'].topics = ['ghost'];
    saveLessonsGraph(root, graph);
    const r = await runLessons({}, ['validate'], root);
    expect(r.exitCode).toBe(1);
  });
});

describe('runLessons journal', () => {
  it('returns lessons sorted by createdAt then id', async () => {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'b-rule': {
          rule: 'B.',
          topics: ['t'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-02',
        },
        'a-rule': {
          rule: 'A.',
          topics: ['t'],
          triggers: [],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
      topics: { t: { summary: '.' } },
      triggers: {},
    };
    saveLessonsGraph(root, graph);
    const r = await runLessons({}, ['journal'], root);
    if (r.subcommand !== 'journal') return;
    expect(r.data.entries.map((e) => e.id)).toEqual(['a-rule', 'b-rule']);
  });
});

describe('runLessons import-md', () => {
  it('runs the migrator, reports counts, and removes legacy files', async () => {
    cpSync(LEGACY_FIXTURE, join(root, '.agentsmesh/lessons'), { recursive: true });
    const r = await runLessons({ 'migrated-at': '2026-06-05' }, ['import-md'], root);
    if (r.subcommand !== 'import-md') return;
    expect(r.exitCode).toBe(0);
    expect(r.data.topicCount).toBe(2);
    expect(r.data.lessonCount).toBe(5);
    expect(r.data.deletedPaths.length).toBeGreaterThan(0);
    expect(existsSync(join(root, '.agentsmesh/lessons/lessons.json'))).toBe(true);
    expect(existsSync(join(root, '.agentsmesh/lessons/index.yaml'))).toBe(false);
    expect(existsSync(join(root, '.agentsmesh/lessons/topics'))).toBe(false);
  });

  it('defaults the migrated-at stamp to today when --migrated-at is omitted', async () => {
    cpSync(LEGACY_FIXTURE, join(root, '.agentsmesh/lessons'), { recursive: true });
    const r = await runLessons({}, ['import-md'], root);
    if (r.subcommand !== 'import-md') return;
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(root, '.agentsmesh/lessons/lessons.json'))).toBe(true);
  });

  it('refuses to overwrite an existing lessons.json without --force', async () => {
    cpSync(LEGACY_FIXTURE, join(root, '.agentsmesh/lessons'), { recursive: true });
    seedSimpleGraph();
    const r = await runLessons({}, ['import-md'], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/already exists/i);
  });

  it('--force overwrites an existing lessons.json', async () => {
    cpSync(LEGACY_FIXTURE, join(root, '.agentsmesh/lessons'), { recursive: true });
    seedSimpleGraph();
    const r = await runLessons({ force: true, 'migrated-at': '2026-06-05' }, ['import-md'], root);
    expect(r.exitCode).toBe(0);
    const reloaded = readFileSync(join(root, '.agentsmesh/lessons/lessons.json'), 'utf8');
    expect(reloaded).not.toContain('topic-x'); // seed-graph topic is gone — replaced by migrated graph
  });
});
