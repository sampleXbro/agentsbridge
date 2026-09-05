import {
  BroadCommandPatternError,
  EmptyRuleError,
  NoTriggerError,
  RuleTooLongError,
  UnrecallableLessonError,
} from './add-errors.js';
import type { AddLessonInput, AddLessonOptions } from './add.js';
import { isBroadCommandPattern } from './command-pattern-breadth.js';
import { MAX_RULE_LENGTH, type LessonsGraph } from './graph-schema.js';
import { blockingDeadTriggers } from './trigger-effectiveness.js';

/**
 * Blocking capture gates for {@link addLessonInto}. Each throws a dedicated
 * rejection error BEFORE the transactional write barrier, so a rejected capture
 * persists nothing and surfaces a precise, actionable reason (CLI exit 2 with
 * the add hint; MCP VALIDATION_FAILED with the machine code).
 */

/** Trim the rule, rejecting an empty or over-long one (a malformed capture). */
export function assertRuleShape(rule: string): string {
  const trimmed = rule.trim();
  if (trimmed.length === 0) throw new EmptyRuleError();
  // A rule far longer than one sentence is a malformed capture; block it before
  // it can bloat every recall that surfaces it (the hook also truncates as a
  // last-resort defense for already-stored / hostile graphs).
  if (trimmed.length > MAX_RULE_LENGTH) throw new RuleTooLongError(trimmed.length, MAX_RULE_LENGTH);
  return trimmed;
}

/**
 * An ALWAYS-ON lesson (scope:'always') is delivered on every task, not matched
 * by triggers, so it needs none — the trigger gates are skipped for it (as
 * legacy-merge recovery also does).
 */
export function skipsTriggerGates(input: AddLessonInput, options: AddLessonOptions): boolean {
  return options.allowNoTrigger === true || input.scope === 'always';
}

function countInputTriggers(triggers: AddLessonInput['triggers']): number {
  return (
    (triggers.files?.length ?? 0) +
    (triggers.commands?.length ?? 0) +
    (triggers.keywords?.length ?? 0)
  );
}

/**
 * Gates on the INPUT triggers, before any trigger node is created.
 * - A lesson with no trigger can never be recalled: enforce ≥1 trigger on the
 *   RESULTING lesson (an upsert keeps the existing lesson's triggers, so it may
 *   pass no new ones).
 * - A command pattern that matches nearly every command is a leak, not a
 *   trigger. Legacy-merge recovery folds historical lessons as-is (`validate`
 *   surfaces them as BROAD_COMMAND_PATTERN).
 */
export function assertTriggerInputs(
  input: AddLessonInput,
  options: AddLessonOptions,
  existingTriggerCount: number,
): void {
  if (
    !skipsTriggerGates(input, options) &&
    countInputTriggers(input.triggers) === 0 &&
    existingTriggerCount === 0
  ) {
    throw new NoTriggerError();
  }
  if (options.allowNoTrigger !== true) {
    const broad = (input.triggers.commands ?? []).find(isBroadCommandPattern);
    if (broad !== undefined) throw new BroadCommandPatternError(broad);
  }
}

/**
 * A lesson whose RESULTING triggers are ALL dead on the mandatory --file/--cmd
 * recall path is unrecallable — block it (the symmetric, blocking counterpart
 * to the warn-only guardrails). Computed on the merged set, so an upsert that
 * adds a dead trigger to an already-effective lesson is fine. command_pattern
 * deadness is deferred to the write barrier (see blockingDeadTriggers), so this
 * block adds the keyword-dead case the barrier passes. A throw here aborts the
 * transactional write, so nothing is persisted.
 */
export function assertRecallable(graph: LessonsGraph, resultingTriggers: readonly string[]): void {
  const blockingDead = blockingDeadTriggers(graph, resultingTriggers);
  if (resultingTriggers.length > 0 && blockingDead.length === resultingTriggers.length) {
    throw new UnrecallableLessonError(blockingDead);
  }
}
