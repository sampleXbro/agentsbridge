import { createHash } from 'node:crypto';
import type { Lesson, LessonsGraph, Trigger, TriggerKind } from './graph-schema.js';
import { saveLessonsGraph, tryLoadLessonsGraph } from './graph-store.js';
import { acquireLessonsLock } from './lessons-lock.js';

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
  const release = await acquireLessonsLock(projectRoot, { retries: options.retries });
  try {
    return addLessonLocked(projectRoot, input, options);
  } finally {
    await release();
  }
}

function addLessonLocked(
  projectRoot: string,
  input: AddLessonInput,
  options: AddLessonOptions,
): AddLessonResult {
  const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  const ruleKey = normalizeRule(input.rule);
  const trimmedRule = input.rule.trim();

  const existingMatch = findExistingLessonByRule(graph, input.topic, ruleKey);
  if (existingMatch !== null) {
    return {
      id: existingMatch,
      isNewLesson: false,
      isNewTopic: false,
      newTriggerIds: [],
    };
  }

  const isNewTopic = graph.topics[input.topic] === undefined;
  if (isNewTopic) {
    if (options.allowNewTopic !== true) throw new UnknownTopicError(input.topic);
    if (options.topicSummary === undefined || options.topicSummary.length === 0) {
      throw new Error(`addLesson: new topic "${input.topic}" requires topicSummary.`);
    }
    graph.topics[input.topic] = { summary: options.topicSummary };
  }

  const { triggerIds, newTriggerIds } = mergeTriggers(graph, input.triggers);
  const id = makeLessonId(graph, input.topic, ruleKey);

  const lesson: Lesson = {
    rule: trimmedRule,
    topics: [input.topic],
    triggers: triggerIds,
    evidence: input.evidence === undefined ? [] : [...input.evidence],
    status: 'active',
    createdAt: input.createdAt ?? todayIso(),
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
  };
  graph.lessons[id] = lesson;

  saveLessonsGraph(projectRoot, graph);
  return { id, isNewLesson: true, isNewTopic, newTriggerIds };
}

function emptyGraph(): LessonsGraph {
  return { version: 1, lessons: {}, topics: {}, triggers: {} };
}

function findExistingLessonByRule(
  graph: LessonsGraph,
  topic: string,
  ruleKey: string,
): string | null {
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (!lesson.topics.includes(topic)) continue;
    if (normalizeRule(lesson.rule) === ruleKey) return id;
  }
  return null;
}

function normalizeRule(rule: string): string {
  return rule.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface TriggerSpec {
  readonly kind: TriggerKind;
  readonly pattern: string;
}

function mergeTriggers(
  graph: LessonsGraph,
  spec: AddLessonTriggers,
): { triggerIds: string[]; newTriggerIds: string[] } {
  const requested: TriggerSpec[] = [
    ...(spec.files ?? []).map((p): TriggerSpec => ({ kind: 'file_glob', pattern: p })),
    ...(spec.commands ?? []).map((p): TriggerSpec => ({ kind: 'command_pattern', pattern: p })),
    ...(spec.keywords ?? []).map((p): TriggerSpec => ({ kind: 'keyword', pattern: p })),
  ];

  const reverseLookup = new Map<string, string>();
  for (const [id, trigger] of Object.entries(graph.triggers)) {
    reverseLookup.set(triggerKey(trigger), id);
  }

  const triggerIds: string[] = [];
  const newTriggerIds: string[] = [];
  for (const spec of requested) {
    const key = triggerKey(spec);
    const existing = reverseLookup.get(key);
    if (existing !== undefined) {
      if (!triggerIds.includes(existing)) triggerIds.push(existing);
      continue;
    }
    const id = makeTriggerId(spec);
    graph.triggers[id] = { kind: spec.kind, pattern: spec.pattern };
    reverseLookup.set(key, id);
    triggerIds.push(id);
    newTriggerIds.push(id);
  }
  return { triggerIds, newTriggerIds };
}

function triggerKey(t: TriggerSpec | Trigger): string {
  return `${t.kind}|${t.pattern}`;
}

const TRIGGER_PREFIX: Record<TriggerKind, string> = {
  file_glob: 'glob',
  command_pattern: 'cmd',
  keyword: 'kw',
};

function makeTriggerId(spec: TriggerSpec): string {
  const hash = createHash('sha1').update(triggerKey(spec)).digest('hex').slice(0, 8);
  return `t-${TRIGGER_PREFIX[spec.kind]}-${hash}`;
}

function makeLessonId(graph: LessonsGraph, topic: string, ruleKey: string): string {
  const slug = ruleToSlug(ruleKey);
  const base =
    slug.length > 0
      ? `${topic}-${slug}`
      : `${topic}-${createHash('sha1').update(ruleKey).digest('hex').slice(0, 8)}`;
  let candidate = base;
  let i = 2;
  while (graph.lessons[candidate] !== undefined) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

function ruleToSlug(rule: string): string {
  const words = rule
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 5);
  return words.join('-').slice(0, 40).replace(/-+$/, '');
}

function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
