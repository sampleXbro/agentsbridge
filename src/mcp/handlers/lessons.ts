import type { McpContext } from '../context.js';
import { addLesson, UnknownTopicError } from '../../lessons/add.js';
import { tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { queryLessons } from '../../lessons/query.js';

interface LessonsQueryInput {
  readonly file?: string;
  readonly command?: string;
  readonly keyword?: string;
}

interface LessonsAddInput {
  readonly rule: string;
  readonly topic: string;
  readonly trigger_files?: readonly string[];
  readonly trigger_commands?: readonly string[];
  readonly trigger_keywords?: readonly string[];
  readonly evidence?: readonly string[];
  readonly rationale?: string;
  readonly new_topic?: boolean;
  readonly topic_summary?: string;
}

export const lessonsHandlers = {
  async query(
    ctx: McpContext,
    input: LessonsQueryInput,
  ): Promise<{
    lessons: Array<{ id: string; rule: string; topics: string[]; evidence: string[] }>;
  }> {
    const graph = tryLoadLessonsGraph(ctx.projectRoot);
    if (graph === null) return { lessons: [] };
    const matches = queryLessons(graph, input);
    return {
      lessons: matches.map(({ id, lesson }) => ({
        id,
        rule: lesson.rule,
        topics: [...lesson.topics],
        evidence: [...lesson.evidence],
      })),
    };
  },

  async add(
    ctx: McpContext,
    input: LessonsAddInput,
  ): Promise<{
    id: string;
    isNewLesson: boolean;
    isNewTopic: boolean;
    newTriggerIds: string[];
  }> {
    try {
      return await addLesson(
        ctx.projectRoot,
        {
          rule: input.rule,
          topic: input.topic,
          triggers: {
            files: input.trigger_files === undefined ? [] : [...input.trigger_files],
            commands: input.trigger_commands === undefined ? [] : [...input.trigger_commands],
            keywords: input.trigger_keywords === undefined ? [] : [...input.trigger_keywords],
          },
          evidence: input.evidence === undefined ? [] : [...input.evidence],
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
      throw err;
    }
  },
};
