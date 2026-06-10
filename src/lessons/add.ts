import { makeLessonId, mergeTriggers, normalizeRule, todayIso, union } from './add-helpers.js';
import { type GuardrailWarning, inspectCapturedLesson } from './capture-guardrails.js';
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
  /**
   * Skip the "a lesson needs at least one trigger" guard. Set only by the
   * legacy-merge recovery path, which folds historical lessons that may predate
   * the requirement; interactive capture (CLI/MCP) always enforces it so a fresh
   * agent cannot create an unreachable lesson.
   */
  readonly allowNoTrigger?: boolean;
}

export interface AddLessonResult {
  readonly id: string;
  readonly isNewLesson: boolean;
  readonly isNewTopic: boolean;
  readonly newTriggerIds: string[];
  /** Non-blocking capture guardrail warnings for the resulting (merged) lesson. */
  readonly warnings: GuardrailWarning[];
}

export class UnknownTopicError extends Error {
  readonly code = 'UNKNOWN_TOPIC';
  constructor(public readonly topic: string) {
    super(`Unknown topic: ${topic}. Pass allowNewTopic + topicSummary to create it.`);
    this.name = 'UnknownTopicError';
  }
}

/** Thrown when a capture would leave a lesson with no trigger (unrecallable). */
export class NoTriggerError extends Error {
  readonly code = 'NO_TRIGGER';
  constructor() {
    super(
      'A lesson needs at least one trigger to be recallable. Pass --trigger-file <glob> ' +
        '(preferred), --trigger-cmd <regex>, or --trigger-kw <text>.',
    );
    this.name = 'NoTriggerError';
  }
}

function countInputTriggers(triggers: AddLessonInput['triggers']): number {
  return (
    (triggers.files?.length ?? 0) +
    (triggers.commands?.length ?? 0) +
    (triggers.keywords?.length ?? 0)
  );
}

export async function addLesson(
  projectRoot: string,
  input: AddLessonInput,
  options: AddLessonOptions = {},
): Promise<AddLessonResult> {
  // mutateLessonsGraph migrates a legacy store first, so the very first capture
  // cannot create lessons.json over an unmigrated index.yaml and strand it.
  return mutateLessonsGraph(projectRoot, (graph) => addLessonInto(graph, input, options), {
    retries: options.retries,
  });
}

/**
 * Pure mutation over the loaded graph. Dedup is by normalized rule text across
 * ALL topics: a re-captured rule UPSERTS — its new triggers, evidence,
 * rationale, and topic are merged into the existing lesson rather than silently
 * dropped, and no duplicate is created (so the active-only DUPLICATE_RULE check
 * stays satisfied). Exported so legacy MERGE recovery can fold each legacy
 * lesson into an existing graph through the same dedup + content-addressing path.
 */
export function addLessonInto(
  graph: LessonsGraph,
  input: AddLessonInput,
  options: AddLessonOptions,
): AddLessonResult {
  const ruleKey = normalizeRule(input.rule);
  const trimmedRule = input.rule.trim();
  const existingId = findExistingLessonByRule(graph, ruleKey);

  // Topic validity is checked first so an unknown-topic / missing-summary error
  // takes precedence over the trigger guard below (clearer, and stable for the
  // documented exit codes).
  const isNewTopic = graph.topics[input.topic] === undefined;
  if (isNewTopic) {
    if (options.allowNewTopic !== true) throw new UnknownTopicError(input.topic);
    if (options.topicSummary === undefined || options.topicSummary.length === 0) {
      throw new Error(`addLesson: new topic "${input.topic}" requires topicSummary.`);
    }
    graph.topics[input.topic] = { summary: options.topicSummary };
  }

  // A lesson with no trigger can never be recalled. Enforce ≥1 trigger on the
  // RESULTING lesson (an upsert keeps the existing lesson's triggers, so it may
  // pass no new ones). Skipped only by legacy-merge recovery.
  if (options.allowNoTrigger !== true) {
    const existingTriggers =
      existingId !== null ? (graph.lessons[existingId]?.triggers.length ?? 0) : 0;
    if (countInputTriggers(input.triggers) === 0 && existingTriggers === 0) {
      throw new NoTriggerError();
    }
  }

  const { triggerIds, newTriggerIds } = mergeTriggers(graph, input.triggers);

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
    return {
      id: existingId,
      isNewLesson: false,
      isNewTopic,
      newTriggerIds,
      warnings: inspectCapturedLesson(graph, existingId),
    };
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
  return {
    id,
    isNewLesson: true,
    isNewTopic,
    newTriggerIds,
    warnings: inspectCapturedLesson(graph, id),
  };
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
