import { z } from 'zod';

/** Schema version this build reads/writes. A graph stamped higher is from a newer CLI. */
export const CURRENT_GRAPH_VERSION = 1;

const IdSchema = z.string().regex(/^[a-z0-9-]+$/, 'id must be kebab-case');
const DateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?$/,
    'createdAt must be ISO-8601 date or datetime',
  );

const TopicSchema = z
  .object({
    summary: z.string().min(1, 'topic summary must not be empty'),
  })
  .strict();

const TriggerKindSchema = z.enum(['file_glob', 'command_pattern', 'keyword']);

const TriggerSchema = z
  .object({
    kind: TriggerKindSchema,
    pattern: z.string().min(1, 'trigger pattern must not be empty'),
  })
  .strict();

const LessonStatusSchema = z.enum(['active', 'deprecated', 'superseded']);

const LessonSchema = z
  .object({
    rule: z.string().min(1, 'lesson rule must not be empty'),
    rationale: z.string().min(1).optional(),
    topics: z.array(IdSchema).min(1, 'lesson must reference at least one topic'),
    triggers: z.array(IdSchema),
    evidence: z.array(z.string().min(1)),
    status: LessonStatusSchema,
    supersededBy: IdSchema.optional(),
    createdAt: DateSchema,
  })
  .strict();

export const LessonsGraphSchema = z
  .object({
    version: z.literal(CURRENT_GRAPH_VERSION),
    lessons: z.record(IdSchema, LessonSchema),
    topics: z.record(IdSchema, TopicSchema),
    triggers: z.record(IdSchema, TriggerSchema),
  })
  .strict();

export type LessonsGraph = z.infer<typeof LessonsGraphSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type TriggerKind = z.infer<typeof TriggerKindSchema>;
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export function parseGraph(raw: unknown): LessonsGraph {
  return LessonsGraphSchema.parse(raw);
}
