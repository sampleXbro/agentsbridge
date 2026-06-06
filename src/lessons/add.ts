import { makeLessonId, mergeTriggers, normalizeRule, todayIso, union } from './add-helpers.js';
import { maybeAutoMigrateLessons } from './auto-migrate.js';
import type { LessonsGraph } from './graph-schema.js';
import { mutateLessonsGraph } from './mutate.js';

export interface AddLessonTriggers {
  readonly files?: readonly string[];
  readonly commands?: readonly string[];
  readonly keywords?: readonly string[];
}

export interface AddLessonInput {
  readonly rule: string;
  readonly topic: string;
  readonly triggers: AddLessonTriggers;
  readonly evidence?: readonly string[];
  readonly rationale?: string;
  readonly createdAt?: string;
}

export interface AddLessonOptions {
  readonly allowNewTopic?: boolean;
  readonly topicSummary?: string;
  readonly retries?: number;
}

export interface AddLessonResult {
  readonly id: string;
  readonly isNewLesson: boolean;
  readonly isNewTopic: boolean;
  readonly newTriggerIds: string[];
}

export class UnknownTopicError extends Error {
  readonly code = 'UNKNOWN_TOPIC';
  constructor(public readonly topic: string) {
    super(`Unknown topic: ${topic}. Pass allowNewTopic + topicSummary to create it.`);
    this.name = 'UnknownTopicError';
  }
}

export async function addLesson(
  projectRoot: string,
  input: AddLessonInput,
  options: AddLessonOptions = {},
): Promise<AddLessonResult> {
  // Migrate a legacy store FIRST so the very first public capture cannot strand
  // it: creating lessons.json here would otherwise permanently block
  // auto-migration. No-op (one stat) when a graph already exists. See
  // maybeAutoMigrateLessons for the under-lock anti-clobber guarantee.
  await maybeAutoMigrateLessons(projectRoot);
  return mutateLessonsGraph(projectRoot, (graph) => addLessonInto(graph, input, options), {
    retries: options.retries,
  });
}

/**
 * Pure mutation over the loaded graph. Dedup is by normalized rule text across
 * ALL topics: a re-captured rule UPSERTS — its new triggers, evidence,
 * rationale, and topic are merged into the existing lesson rather than silently
 * dropped, and no duplicate is created (so the active-only DUPLICATE_RULE check
 * stays satisfied).
 */
function addLessonInto(
  graph: LessonsGraph,
  input: AddLessonInput,
  options: AddLessonOptions,
): AddLessonResult {
  const ruleKey = normalizeRule(input.rule);
  const trimmedRule = input.rule.trim();

  const isNewTopic = graph.topics[input.topic] === undefined;
  if (isNewTopic) {
    if (options.allowNewTopic !== true) throw new UnknownTopicError(input.topic);
    if (options.topicSummary === undefined || options.topicSummary.length === 0) {
      throw new Error(`addLesson: new topic "${input.topic}" requires topicSummary.`);
    }
    graph.topics[input.topic] = { summary: options.topicSummary };
  }

  const { triggerIds, newTriggerIds } = mergeTriggers(graph, input.triggers);
  const existingId = findExistingLessonByRule(graph, ruleKey);

  if (existingId !== null) {
    // existingId came from Object.entries(graph.lessons), so it is present.
    const existing = graph.lessons[existingId]!;
    graph.lessons[existingId] = {
      ...existing,
      topics: union(existing.topics, [input.topic]),
      triggers: union(existing.triggers, triggerIds),
      evidence: union(existing.evidence, input.evidence ?? []),
      ...(existing.rationale === undefined && input.rationale !== undefined
        ? { rationale: input.rationale }
        : {}),
    };
    return { id: existingId, isNewLesson: false, isNewTopic, newTriggerIds };
  }

  const id = makeLessonId(graph, input.topic, ruleKey);
  graph.lessons[id] = {
    rule: trimmedRule,
    topics: [input.topic],
    triggers: triggerIds,
    evidence: input.evidence === undefined ? [] : [...input.evidence],
    status: 'active',
    createdAt: input.createdAt ?? todayIso(),
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
  };
  return { id, isNewLesson: true, isNewTopic, newTriggerIds };
}

/**
 * Find an ACTIVE lesson with the same normalized rule. Inactive
 * (deprecated/superseded) lessons are ignored on purpose: re-capturing a rule
 * whose only match is dead must produce a fresh ACTIVE lesson (a live
 * replacement), not silently enrich a corpse that recall will never surface.
 */
function findExistingLessonByRule(graph: LessonsGraph, ruleKey: string): string | null {
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    if (normalizeRule(lesson.rule) === ruleKey) return id;
  }
  return null;
}
