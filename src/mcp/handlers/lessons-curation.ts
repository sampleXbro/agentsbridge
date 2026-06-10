import type { McpContext } from '../context.js';
import { maybeAutoMigrateLessons } from '../../lessons/auto-migrate.js';
import { deprecateLesson } from '../../lessons/deprecate.js';
import type { LessonStatus } from '../../lessons/graph-schema.js';
import { tryLoadLessonsGraph } from '../../lessons/graph-store.js';

export interface LessonsShowInput {
  readonly topic: string;
}

export interface LessonsDeprecateInput {
  readonly id: string;
  readonly superseded_by?: string;
}

export interface LessonsShowResult {
  readonly topic: string;
  readonly summary: string;
  readonly lessons: Array<{
    id: string;
    rule: string;
    status: LessonStatus;
    topics: string[];
    triggers: string[];
    evidence: string[];
  }>;
}

/** Inspect a topic: return its summary and every lesson under it (all statuses). */
export async function lessonsShow(
  ctx: McpContext,
  input: LessonsShowInput,
): Promise<LessonsShowResult> {
  await maybeAutoMigrateLessons(ctx.projectRoot);
  const graph = tryLoadLessonsGraph(ctx.projectRoot);
  const topic = graph?.topics[input.topic];
  if (graph === null || topic === undefined) {
    throw new Error(`lessons_show: unknown topic "${input.topic}".`);
  }
  const lessons = Object.entries(graph.lessons)
    .filter(([, l]) => l.topics.includes(input.topic))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, l]) => ({
      id,
      rule: l.rule,
      status: l.status,
      topics: [...l.topics],
      triggers: [...l.triggers],
      evidence: [...l.evidence],
    }));
  return { topic: input.topic, summary: topic.summary, lessons };
}

/** Retire a lesson (deprecated, or superseded when `superseded_by` is given). */
export async function lessonsDeprecate(
  ctx: McpContext,
  input: LessonsDeprecateInput,
): Promise<{ id: string; status: LessonStatus; supersededBy: string | null }> {
  try {
    return await deprecateLesson(ctx.projectRoot, input.id, input.superseded_by ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Normalize the core's "Unknown lesson:" / "Unknown superseder:" into the
    // tool-namespaced phrasing the agent sees.
    throw new Error(`lessons_deprecate: ${message}`, { cause: err });
  }
}
