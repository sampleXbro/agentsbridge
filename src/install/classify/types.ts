/**
 * Types for the install-source classifier.
 *
 * A classifier inspects a fetched filesystem tree and decides which import
 * strategy to dispatch: canonical agentsmesh layout, Anthropic-style skill
 * pack, tool-native config, or unknown (fall-through to existing partial-
 * slice loader). Each anthropic-skill-pack decision is supported by a
 * weighted bundle of signals so the decision is auditable in logs and JSON
 * output.
 */

/** Stable names for the five signals scored by the classifier. */
export type SignalName =
  | 'skill-pack-layout'
  | 'agents-dir'
  | 'references-dir'
  | 'multi-tool-rules'
  | 'per-target-commands';

/** Result of evaluating a single signal against a contentRoot. */
export interface Signal {
  readonly name: SignalName;
  readonly weight: number;
  readonly matched: boolean;
}

/** The four mutually exclusive source types the install command dispatches on. */
export type SourceType =
  | 'canonical-agentsmesh'
  | 'anthropic-skill-pack'
  | 'tool-native'
  | 'unknown';

/** Verdict of `classifySource()` plus the evidence it stood on. */
export interface Classification {
  readonly type: SourceType;
  readonly score: number;
  readonly signals: readonly Signal[];
}

/**
 * Per-signal weights. The `skill-pack-layout` signal is mandatory (PRIMARY);
 * the remaining four are evidence multipliers. A source is classified as
 * `anthropic-skill-pack` iff `skill-pack-layout` matches AND the sum of all
 * matched weights is `>= SKILL_PACK_THRESHOLD`.
 */
export const SIGNAL_WEIGHTS: Readonly<Record<SignalName, number>> = {
  'skill-pack-layout': 1.0,
  'agents-dir': 0.4,
  'references-dir': 0.3,
  'multi-tool-rules': 0.3,
  'per-target-commands': 0.4,
};

/**
 * Minimum total signal score required to classify a source as
 * `anthropic-skill-pack` (assuming `skill-pack-layout` matches).
 * With the weights above this requires the primary signal plus AT LEAST
 * one secondary signal, ruling out drive-by repos that happen to have a
 * single `skills/<x>/SKILL.md` for unrelated reasons.
 */
export const SKILL_PACK_THRESHOLD = 1.4;
