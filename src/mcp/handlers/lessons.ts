import type { McpContext } from '../context.js';
import {
  NoTriggerError,
  RuleTooLongError,
  UnknownTopicError,
  UnrecallableLessonError,
} from '../../lessons/add.js';
import { maybeAutoMigrateLessons } from '../../lessons/auto-migrate.js';
import { tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { captureLesson, recallLessons } from '../../lessons/recall.js';
import { lessonsDeprecate, lessonsShow } from './lessons-curation.js';

interface LessonsQueryInput {
  readonly file?: string;
  readonly command?: string;
  /** CLI-flag alias of `command` (--cmd); folded into `command` below. */
  readonly cmd?: string;
  readonly keyword?: string;
  readonly limit?: number;
  readonly max_tokens?: number;
  /** CLI-flag alias of `max_tokens` (--max-tokens); folded in below. */
  readonly 'max-tokens'?: number;
  readonly verbose?: boolean;
}

/** A list input the agent may pass as a bare string or an array (CLI parity). */
type ListInput = string | readonly string[] | undefined;

interface LessonsAddInput {
  readonly rule: string;
  readonly topic: string;
  readonly trigger_files?: ListInput;
  /** CLI-flag alias of `trigger_files` (--trigger-file); folded in below. */
  readonly trigger_file?: ListInput;
  readonly trigger_commands?: ListInput;
  /** CLI-flag alias of `trigger_commands` (--trigger-cmd); folded in below. */
  readonly trigger_cmd?: ListInput;
  readonly trigger_keywords?: ListInput;
  /** CLI-flag alias of `trigger_keywords` (--trigger-kw); folded in below. */
  readonly trigger_kw?: ListInput;
  readonly evidence?: ListInput;
  readonly rationale?: string;
  readonly new_topic?: boolean;
  readonly topic_summary?: string;
}

/**
 * Trigger parity with the CLI `repeatedFlag`: a scalar becomes a single value and
 * commas are NEVER split — globs (`src/{a,b}/**`) and regexes (`^a{1,3}$`)
 * legitimately contain commas, so splitting would forge broken triggers.
 */
function toTriggerList(v: ListInput): string[] {
  if (v === undefined) return [];
  if (typeof v === 'string') return v.length > 0 ? [v] : [];
  return v.filter((s) => s.length > 0);
}

/**
 * Evidence parity with the CLI `listFlag`: arrays pass through; a scalar is
 * comma-split (evidence refs like `commit:SHA` / `lesson:id` never contain commas).
 */
function toEvidenceList(v: ListInput): string[] {
  if (v === undefined) return [];
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return v.filter((s) => s.length > 0);
}

export const lessonsHandlers = {
  async query(
    ctx: McpContext,
    input: LessonsQueryInput,
  ): Promise<{
    lessons: Array<{
      id: string;
      rule: string;
      topics?: string[];
      triggers?: string[];
      evidence?: string[];
      score?: number;
    }>;
    totalMatches: number;
  }> {
    // Migration-aware recall; applies the default token budget when the caller
    // omits max_tokens so mandatory recall stays token-lean. Fold the CLI-flag
    // aliases (`cmd`, `max-tokens`) into their canonical fields so agents coming
    // from the CLI docs are not tripped by the name difference.
    const query = {
      file: input.file,
      command: input.command ?? input.cmd,
      keyword: input.keyword,
    };
    if (query.file === undefined && query.command === undefined && query.keyword === undefined) {
      throw new Error(
        'lessons_query: provide at least one of file, command, or keyword to recall against.',
      );
    }
    if (query.file === undefined && query.command === undefined) {
      process.stderr.write(
        'agentsmesh: keyword-only recall misses file_glob/command_pattern lessons — ' +
          'pass file and/or command for complete recall.\n',
      );
    }
    const {
      lessons: ranked,
      totalMatches,
      suppressed,
      corrupt,
      newerVersion,
    } = await recallLessons(ctx.projectRoot, query, {
      limit: input.limit,
      maxTokens: input.max_tokens ?? input['max-tokens'],
    });
    if (corrupt === true) {
      // Recall degrades to empty rather than throwing; surface the reason on
      // stderr (stdout is the MCP protocol channel) so the server log shows it.
      process.stderr.write(
        'agentsmesh: lessons.json is unreadable (corrupt) — recall returned no lessons. Run `agentsmesh lessons validate`.\n',
      );
    } else if (newerVersion !== undefined) {
      process.stderr.write(
        `agentsmesh: lessons.json is version ${newerVersion}, newer than this build supports — recall returned no lessons. Upgrade agentsmesh to read it.\n`,
      );
    }
    // Compact by default — return only id + rule to keep recall token-cheap.
    // Metadata (topics/triggers/evidence/score) is opt-in via `verbose`.
    const verbose = input.verbose === true;
    return {
      lessons: ranked.map(({ id, lesson, score }) =>
        verbose
          ? {
              id,
              rule: lesson.rule,
              topics: [...lesson.topics],
              triggers: [...lesson.triggers],
              evidence: [...lesson.evidence],
              score,
            }
          : { id, rule: lesson.rule },
      ),
      totalMatches,
      ...(suppressed > 0 ? { suppressed } : {}),
    };
  },

  async topics(ctx: McpContext): Promise<{ topics: Array<{ id: string; summary: string }> }> {
    await maybeAutoMigrateLessons(ctx.projectRoot);
    const graph = tryLoadLessonsGraph(ctx.projectRoot);
    if (graph === null) return { topics: [] };
    return {
      topics: Object.entries(graph.topics)
        .map(([id, t]) => ({ id, summary: t.summary }))
        .sort((a, b) => (a.id < b.id ? -1 : 1)),
    };
  },

  show: lessonsShow,

  deprecate: lessonsDeprecate,

  async add(
    ctx: McpContext,
    input: LessonsAddInput,
  ): Promise<{
    id: string;
    isNewLesson: boolean;
    isNewTopic: boolean;
    newTriggerIds: string[];
    warnings: Array<{ code: string; message: string }>;
    autoPruned?: { removedTriggers: number; removedTopics: number; detachedDeadGlobs: number };
  }> {
    // captureLesson migrates any legacy store first so capture enriches the real
    // graph instead of creating lessons.json and stranding the legacy lessons.
    try {
      return await captureLesson(
        ctx.projectRoot,
        {
          rule: input.rule,
          topic: input.topic,
          // Fold the CLI-flag aliases (singular) into the canonical plural field;
          // the canonical field wins when both are present (parity with query's
          // `command ?? cmd`). Each value is coerced from string-or-array.
          triggers: {
            files: toTriggerList(input.trigger_files ?? input.trigger_file),
            commands: toTriggerList(input.trigger_commands ?? input.trigger_cmd),
            keywords: toTriggerList(input.trigger_keywords ?? input.trigger_kw),
          },
          evidence: toEvidenceList(input.evidence),
          rationale: input.rationale,
        },
        {
          allowNewTopic: input.new_topic === true,
          topicSummary: input.topic_summary,
        },
      );
    } catch (err) {
      if (err instanceof UnknownTopicError) {
        throw new Error(
          `lessons_add: unknown topic "${err.topic}". Pass new_topic=true + topic_summary to create it.`,
          { cause: err },
        );
      }
      if (
        err instanceof NoTriggerError ||
        err instanceof UnrecallableLessonError ||
        err instanceof RuleTooLongError
      ) {
        throw new Error(`lessons_add: ${err.message}`, { cause: err });
      }
      throw err;
    }
  },
};
